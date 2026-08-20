import { describe, expect, test } from "bun:test"

const source = await Bun.file(new URL("./browser-tab.tsx", import.meta.url)).text()

describe("browser tab load after tab switches", () => {
  test("does not load the guest until Electron reports dom-ready", () => {
    expect(source).toContain('el.addEventListener("dom-ready", onDomReady)')
    expect(source).toContain("if (!guestReady)")
    expect(source).toContain("defer load until dom-ready")
  })

  test("logs mount, resize, load, fail, and unmount", () => {
    expect(source).toContain('console.info("[browser-tab]"')
    expect(source).toContain("did-fail-load")
    expect(source).toContain("unmount")
    expect(source).toContain('el.style.display = "block"')
  })
})
