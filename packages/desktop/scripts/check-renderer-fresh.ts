#!/usr/bin/env bun
/**
 * Fails when the electron-vite build output (out/) is missing or older than the
 * renderer sources it should bundle.
 *
 * electron-builder packages `out/**` as-is, so a stale out/ ships a stale app.
 * Wire this up:
 *   - as a `beforePack` hook in electron-builder.config.ts (guards direct
 *     electron-builder invocations too), and
 *   - as `bun run check:renderer-fresh` for CI / local checks.
 */
import { existsSync, readdirSync, statSync } from "node:fs"
import path from "node:path"

const packageDir = path.resolve(import.meta.dir, "..")

const INPUT_ROOTS = [
  path.join(packageDir, "src"),
  path.join(packageDir, "..", "app", "src"),
  path.join(packageDir, "..", "ui", "src"),
]
const OUTPUT_ROOT = path.join(packageDir, "out")

// Test/storybook files are never bundled into the renderer, so they must not
// trip the freshness check on their own.
const SKIP_FILE_RE = /\.(test|spec|stories)\.[cm]?[jt]sx?$/

interface Newest {
  mtime: number
  file?: string
}

function newestMtime(dir: string, acc: Newest = { mtime: 0 }): Newest {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue
    if (entry.name.startsWith(".")) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      newestMtime(full, acc)
    } else if (SKIP_FILE_RE.test(entry.name)) {
      continue
    } else {
      const st = statSync(full)
      if (st.mtimeMs > acc.mtime) {
        acc.mtime = st.mtimeMs
        acc.file = full
      }
    }
  }
  return acc
}

/**
 * Returns the source files that are newer than the newest build output, or an
 * empty array when the build is fresh (or out/ is missing, which is reported
 * separately by `hasBuildOutput`).
 */
export function checkRendererFresh(): {
  fresh: boolean
  missingOutput: boolean
  staleFiles: string[]
} {
  if (!existsSync(path.join(OUTPUT_ROOT, "renderer")) || !existsSync(path.join(OUTPUT_ROOT, "main"))) {
    return { fresh: false, missingOutput: true, staleFiles: [] }
  }

  let input = { mtime: 0 }
  for (const root of INPUT_ROOTS) {
    if (existsSync(root)) input = newestMtime(root, input)
  }
  const output = newestMtime(OUTPUT_ROOT)

  const staleFiles: string[] = []
  const collectStale = (dir: string, cutoff: number, out: string[]): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules") continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        collectStale(full, cutoff, out)
      } else if (SKIP_FILE_RE.test(entry.name)) {
        continue
      } else {
        const st = statSync(full)
        if (st.mtimeMs > cutoff) out.push(full)
      }
    }
  }
  for (const root of INPUT_ROOTS) {
    if (existsSync(root)) collectStale(root, output.mtime, staleFiles)
  }

  return { fresh: staleFiles.length === 0, missingOutput: false, staleFiles }
}

if (import.meta.main) {
  const { fresh, missingOutput, staleFiles } = checkRendererFresh()
  if (missingOutput) {
    console.error("check-renderer-fresh: no build output at packages/desktop/out (missing out/renderer or out/main).")
    console.error("Run `bun run build` (or `bun run package`, which builds first) before packaging.")
    process.exit(1)
  }
  if (!fresh) {
    console.error(
      `check-renderer-fresh: out/ is stale — ${staleFiles.length} source file(s) are newer than the build output:`,
    )
    for (const file of staleFiles.slice(0, 5)) console.error(`  - ${path.relative(packageDir, file)}`)
    console.error("Run `bun run build` (or `bun run package`, which builds first) before packaging.")
    process.exit(1)
  }
  console.log("check-renderer-fresh: out/ is up to date.")
  process.exit(0)
}
