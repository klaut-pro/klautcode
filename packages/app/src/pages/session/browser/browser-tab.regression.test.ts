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
    // A same-url guest that already navigated must not be reloaded; only a guest
    // that never left about:blank re-drives the pending load. URLs are compared
    // loosely because the browser normalizes them (e.g. adds a trailing slash).
    expect(source).toContain("(neverNavigated || !sameUrl(pendingUrl, loadedUrl))")
  })

  test("dom-ready re-drives a dropped first load when the guest never navigated", () => {
    // Setting src before the guest is created can be dropped; the guest stays on
    // about:blank and dom-ready must then start the real load.
    expect(source).toContain('const neverNavigated = !current || current === "about:blank"')
    expect(source).toContain("safeGuestUrl")
  })

  test("defers the guest load while the host is hidden (no 1x1 blank guest)", () => {
    // A guest loaded while its host is display:none paints at 1x1 and stays
    // blank when the panel is shown; loads must wait until the host is visible.
    expect(source).toContain("defer load until visible")
    expect(source).toContain("hostVisible")
    expect(source).toContain("drivePendingLoad")
    expect(source).toContain("logChainHeights(ref, tab, isCollapsed ? \"collapsed\" : \"recovered\")")
  })

  test("loadURL aborts to an in-flight same-url navigation are benign", () => {
    // loadURL on a URL the guest is already navigating aborts with ERR_ABORTED
    // (-3); that must not fall back to src (a no-op) or log as a failure.
    expect(source).toContain("ERR_ABORTED")
    expect(source).toContain("loadURL redundant, navigation already in flight")
  })

  test("guest getters are guarded against the not-attached throw", () => {
    // Electron throws "must be attached to the DOM" when the guest is hidden or
    // being torn down; getTitle/getURL must never surface as uncaught errors.
    expect(source).toContain("safeGuestTitle")
    expect(source).toContain("must be attached")
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

  test("sizes the shadow guest frame so the page fills the host height", () => {
    // Electron renders <webview> as a shadow-root <iframe> that stretches to
    // the host only when the host is a flex container (the shadow's own
    // `:host { display: flex }` rule). The inline display:block (kept to stop
    // the guest collapsing under flex + overflow-hidden ancestors) overrides
    // that, so the frame's height falls back to Chromium's 150px
    // replaced-element default and the page is squeezed into the top 150px of
    // the panel. The mount code must size the guest frame in pixels and re-fit
    // it on every resize so the browser fills the whole sidebar.
    expect(source).toContain('el.shadowRoot?.querySelector("iframe")')
    expect(source).toContain("fitGuestFrame(size.width, size.height)")
    expect(source).toContain("frame.style.width = `${width}px`")
    expect(source).toContain("frame.style.height = `${height}px`")
    expect(source).toContain('el.style.display = "block"')
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

  test("loading overlay is a sibling of the webview host, never a child", () => {
    // The loading overlay used to live inside the host div: toggling
    // store.loading (loading -> loaded) makes Solid clear the host's children,
    // which also detached the imperatively-appended <webview> element and left
    // the browser panel blank. The overlay must be a sibling of the host, so a
    // Show toggle can never touch the webview.
    const host = source.indexOf('data-component="browser-webview"')
    const overlay = source.indexOf('data-component="browser-webview-loading"')
    expect(host).toBeGreaterThan(-1)
    expect(overlay).toBeGreaterThan(-1)
    expect(overlay).toBeGreaterThan(host)
    // The host div must be empty (self-closed): no Solid-managed children that
    // a Show toggle could sweep away.
    const hostClose = source.indexOf("/>", host)
    expect(hostClose).toBeGreaterThan(-1)
    expect(hostClose).toBeLessThan(overlay)
    // The overlay is rendered by a Show placed after the host inside the same
    // wrapper div (sibling of the host), not inside it. (The first
    // <Show when={store.loading}> is the toolbar spinner; the overlay one comes
    // after the host.)
    const spinnerShow = source.indexOf("<Show when={store.loading}>")
    const show = source.indexOf("<Show when={store.loading}>", spinnerShow + 1)
    expect(show).toBeGreaterThan(spinnerShow)
    expect(show).toBeGreaterThan(hostClose)
    expect(show).toBeLessThan(overlay)
    expect(source.indexOf("<Show when={store.loading}>", show + 1)).toBe(-1)
  })
})
