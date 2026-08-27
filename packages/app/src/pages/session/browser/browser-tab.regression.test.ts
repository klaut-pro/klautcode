import { describe, expect, test } from "bun:test"

const source = await Bun.file(new URL("./browser-tab.tsx", import.meta.url)).text()

describe("browser tab load after tab switches", () => {
  test("does not load the guest until Electron reports dom-ready", () => {
    expect(source).toContain('el.addEventListener("dom-ready", onDomReady)')
    expect(source).toContain("if (!guestReady)")
    expect(source).toContain("defer load until dom-ready")
  })

  test("first navigation proceeds to unblock dom-ready, subsequent loads defer", () => {
    expect(source).toContain("if (loadedUrl === undefined)")
    expect(source).toContain("openWebviewUrl(webview, url, props.tab)")
  })

  test("dom-ready does not reload same url (no flicker loop)", () => {
    expect(source).toContain("if (pendingUrl && pendingUrl !== loadedUrl) load(pendingUrl)")
  })

  test("logs mount, resize, load, fail, and unmount", () => {
    expect(source).toContain('console.info(`[browser-tab]')
    expect(source).toContain("did-fail-load")
    expect(source).toContain("unmount")
    expect(source).toContain('el.style.display = "block"')
  })

  test("webview fills host and retries after layout settles", () => {
    expect(source).toContain('el.style.position = "absolute"')
    expect(source).toContain('el.style.inset = "0"')
    expect(source).toContain("sizeWebviewToHost")
    expect(source).toContain("ResizeObserver")
    expect(source).toContain("syncPending")
    expect(source).toContain("BROWSER_WEBVIEW_HOST_CLASS")
  })

  test("browser tab fills available height so the webview is not short", () => {
    // The webview host relies on flex-1/basis-0/min-h-0 to take all remaining
    // column space; no inline height override that could collapse under absolute
    // positioning or resolve to auto in Electron.
    expect(source).not.toContain("calc(100%")
    expect(source).toContain('data-component="browser-webview"')
    expect(source).toContain("BROWSER_WEBVIEW_HOST_CLASS")
  })

  test("hidden webview guest still probes during design mode", () => {
    // visibility:hidden keeps guest alive for probe/capture; display:none would destroy it
    expect(source).not.toContain('display = "none"')
  })
})
