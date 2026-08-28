import { describe, expect, test } from "bun:test"
import { readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const appSrc = join(__dirname, "../..", "src")
const sessionUiSrc = join(__dirname, "../../../session-ui/src")
const uiSrc = join(__dirname, "../../../ui/src")

const RAW_PX_TSX = /text-\[(\d+)px\]/
const RAW_PX_CSS = /font-size:\s*\d+px/

function walk(dir: string): string[] {
  return readdirSync(dir, { recursive: true })
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => join(dir, entry))
}

function sourceFiles(dir: string, ext: string): string[] {
  return walk(dir).filter((p) => p.endsWith(ext))
}

describe("design tokens drive every font size", () => {
  test("no TSX file uses a raw px font-size class (text-[Npx])", async () => {
    // The font-size setting maps --font-size-scale on the root; raw px classes
    // like text-[13px] bypass it, so text stays fixed while everything else
    // scales. The composer prompt input was the reported offender (stuck at
    // 13px while the body scaled 12 -> 18.2px).
    const offenders: string[] = []
    const files = sourceFiles(appSrc, ".tsx").concat(sourceFiles(sessionUiSrc, ".tsx"), sourceFiles(uiSrc, ".tsx"))
    for (const file of files) {
      const src = await Bun.file(file).text()
      if (RAW_PX_TSX.test(src)) offenders.push(file)
    }
    expect(offenders).toEqual([])
  })

  test("no CSS file uses a raw px font-size (font-size: Npx)", async () => {
    // Same root cause on the CSS side: raw px font-sizes never see the scale.
    const offenders: string[] = []
    const files = sourceFiles(appSrc, ".css").concat(sourceFiles(sessionUiSrc, ".css"), sourceFiles(uiSrc, ".css"))
    for (const file of files) {
      const src = await Bun.file(file).text()
      if (RAW_PX_CSS.test(src)) offenders.push(file)
    }
    expect(offenders).toEqual([])
  })

  test("the composer prompt input uses the font-size token", async () => {
    const src = await Bun.file(new URL("../../../session-ui/src/v2/components/prompt-input/index.tsx", import.meta.url)).text()
    expect(src).toContain("text-(--font-size-base)")
    expect(src).not.toContain("text-[13px]")
  })

  test("the v1 prompt input uses the font-size token", async () => {
    const src = await Bun.file(new URL("./prompt-input.tsx", import.meta.url)).text()
    expect(src).not.toMatch(RAW_PX_TSX)
  })

  test("the Tailwind theme maps text-xs to a scalable token", async () => {
    // Tailwind's default --text-xs resolves to rem against the unscaled root;
    // mapping it to --font-size-small keeps 12px at scale 1 but scales it with
    // the setting like text-sm/base/lg/xl already do.
    const theme = await Bun.file(new URL("../../../ui/src/styles/tailwind/index.css", import.meta.url)).text()
    expect(theme).toContain("--text-xs: var(--font-size-small)")
  })
})
