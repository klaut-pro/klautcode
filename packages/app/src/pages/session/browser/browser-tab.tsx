import { createEffect, createMemo, For, onCleanup, onMount, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { Icon } from "@klautcode/ui/icon"
import { IconButtonV2 } from "@klautcode/ui/v2/icon-button-v2"
import { Icon as IconV2 } from "@klautcode/ui/v2/icon"
import { MenuV2 } from "@klautcode/ui/v2/menu-v2"
import { TooltipV2 } from "@klautcode/ui/v2/tooltip-v2"
import { useLanguage } from "@/context/language"
import { useLayout } from "@/context/layout"
import { usePlatform } from "@/context/platform"
import { useDesignMode } from "@/components/design-mode/controller"
import { browserUrlFromTab } from "@/pages/session/helpers"
import { BROWSER_HOME_URL } from "./browser-state"
import { BROWSER_WEBVIEW_HOST_CLASS, sizeWebviewToHost } from "./webview-layout"

// Minimal surface of Electron's <webview> guest element used by the internal
// browser. It only exists in the desktop shell; the web build shows a fallback.
interface WebviewTag extends HTMLElement {
  loadURL(url: string): Promise<void>
  reload(): void
  goBack(): void
  goForward(): void
  stop(): void
  getURL(): string
  getTitle(): string
  canGoBack(): boolean
  canGoForward(): boolean
  src: string
}

const SEARCH_URL = (query: string) => `https://www.google.com/search?q=${encodeURIComponent(query)}`

function normalizeUrl(input: string): string | undefined {
  const trimmed = input.trim()
  if (!trimmed) return undefined
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return trimmed
  if (trimmed.includes(" ") || !trimmed.includes(".")) return SEARCH_URL(trimmed)
  return `https://${trimmed}`
}

// The guest normalizes URLs (adds a trailing slash, lowercases the host), so
// compare loosely when deciding whether a load is redundant.
function comparableUrl(url: string): string {
  return url.trim().replace(/\/+$/, "").toLowerCase()
}
function sameUrl(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return a === b
  return comparableUrl(a) === comparableUrl(b)
}

function logBrowser(event: string, data?: Record<string, unknown>) {
  // Serialize to a single JSON string: electron-log's renderer console spy
  // stringifies object args to "[object Object]", losing the size data.
  console.info(`[browser-tab] ${event} ${JSON.stringify(data ?? {})}`)
}

function webviewSnapshot(host?: HTMLElement, webview?: WebviewTag) {
  const box = host?.getBoundingClientRect()
  const style = webview ? getComputedStyle(webview) : undefined
  return {
    host: box ? { width: Math.round(box.width), height: Math.round(box.height) } : undefined,
    webview: webview
      ? {
          width: webview.style.width,
          height: webview.style.height,
          display: style?.display,
          visibility: style?.visibility,
          src: webview.src,
        }
      : undefined,
    designMode: typeof document !== "undefined" && document.documentElement.hasAttribute("data-design-mode"),
  }
}

function logChainHeights(origin: HTMLElement | undefined, tab: string, state: string) {
  if (!origin) return
  const chain: Record<string, unknown>[] = []
  let el: Element | null = origin
  let depth = 0
  while (el && depth < 16) {
    const rect = el.getBoundingClientRect()
    const style = getComputedStyle(el)
    chain.push({
      d: depth,
      tag: el.tagName.toLowerCase(),
      id: el.id || undefined,
      comp: el.getAttribute("data-component") || undefined,
      cls: el.getAttribute("class") ?? "",
      w: Math.round(rect.width),
      h: Math.round(rect.height),
      height: style.height,
      flex: style.flex,
      display: style.display,
      position: style.position,
      overflow: style.overflowY,
    })
    el = el.parentElement
    depth++
  }
  logBrowser("chain", { tab, state, chain })
}

function openWebviewUrl(webview: WebviewTag, url: string, tab: string) {
  if (!webview || !url) return
  logBrowser("load", { tab, url, src: webview.src })
  const onReject = (error: unknown) => {
    const message = String(error)
    if (message.includes("-3") || message.includes("ERR_ABORTED") || sameUrl(url, webview.src)) {
      // The guest is already navigating to this URL (the src attribute or an
      // earlier loadURL started it); the redundant call is aborted with -3.
      logBrowser("loadURL redundant, navigation already in flight", { tab, url, error: message })
      return
    }
    logBrowser("loadURL failed, falling back to src", { tab, url, error: message })
    webview.src = url
  }
  try {
    void webview.loadURL(url).catch(onReject)
  } catch (error) {
    const message = String(error)
    if (message.includes("must be attached")) {
      // Guest not attached yet (still being created); the dom-ready or
      // visibility-recovery path drives this load instead.
      logBrowser("loadURL deferred, guest not attached", { tab, url, error: message })
      return
    }
    logBrowser("loadURL threw, falling back to src", { tab, url, error: message })
    webview.src = url
  }
}

export function BrowserTab(props: { tab: string }) {
  const language = useLanguage()
  const platform = usePlatform()
  const layout = useLayout()
  const design = useDesignMode()
  const initialUrl = createMemo(() => {
    const state = layout.browser.get(props.tab)
    if (state?.url) return state.url
    const url = browserUrlFromTab(props.tab)
    if (url) return url
    return BROWSER_HOME_URL
  })
  const [store, setStore] = createStore({
    input: initialUrl(),
    loading: false,
  })
  let ref: HTMLDivElement | undefined
  let webview: WebviewTag | undefined
  let loadedUrl: string | undefined
  let guestReady = false
  let pendingUrl: string | undefined
  // A guest created while its host is hidden (display:none ancestor) paints at
  // 1x1 and never repaints when the panel is shown; defer loads until visible.
  let hostVisible = false

  const safeGuestUrl = () => {
    if (!webview) return ""
    try {
      return webview.getURL() ?? ""
    } catch {
      return ""
    }
  }
  const safeGuestTitle = () => {
    if (!webview) return ""
    try {
      return webview.getTitle() ?? ""
    } catch {
      return ""
    }
  }

  const load = (url: string) => {
    if (!webview) {
      logBrowser("load skipped, webview missing", { tab: props.tab, url })
      pendingUrl = url
      return
    }
    pendingUrl = url
    if (!hostVisible) {
      logBrowser("defer load until visible", { tab: props.tab, url, ...webviewSnapshot(ref, webview) })
      return
    }
    if (!guestReady) {
      if (loadedUrl === undefined) {
        loadedUrl = url
        webview.src = url
        logBrowser("defer loadURL until dom-ready", { tab: props.tab, url, ...webviewSnapshot(ref, webview) })
        return
      }
      logBrowser("defer load until dom-ready", { tab: props.tab, url, ...webviewSnapshot(ref, webview) })
      return
    }
    loadedUrl = url
    openWebviewUrl(webview, url, props.tab)
  }

  const drivePendingLoad = () => {
    if (!webview || !hostVisible) return
    if (!pendingUrl || pendingUrl === "about:blank") return
    const current = safeGuestUrl()
    const neverNavigated = !current || current === "about:blank"
    // Load if the guest never navigated (the initial src can be dropped while
    // the guest is created) or if the pending URL differs from what the guest
    // actually loaded (the browser normalizes URLs, e.g. adds a trailing slash).
    if (neverNavigated || !sameUrl(pendingUrl, loadedUrl)) {
      load(pendingUrl)
    }
  }

  const recordVisit = (url: string) => {
    if (!url || url === "about:blank") return
    layout.browser.set(props.tab, { url })
    layout.browser.pushHistory(props.tab, url)
  }

  const syncTitle = () => {
    if (!webview || !guestReady || !hostVisible) return
    const url = safeGuestUrl()
    const title = safeGuestTitle()
    layout.browser.set(props.tab, { url: url || store.input, title: title || undefined })
  }

  onMount(() => {
    if (!ref || platform.platform !== "desktop") return
    const tab = props.tab
    logBrowser("mount", { tab, url: initialUrl(), ...webviewSnapshot(ref) })
    logChainHeights(ref, tab, "mount")
    const el = document.createElement("webview") as WebviewTag
    el.setAttribute("partition", "persist:klautcode-browser")
    el.setAttribute("allowpopups", "false")
    // Native guest views collapse under `display:flex` + overflow-hidden ancestors.
    el.style.display = "block"
    el.style.position = "absolute"
    el.style.inset = "0"
    let syncPending = false
    let collapsed = false
    const syncBox = () => {
      if (syncPending) return
      syncPending = true
      requestAnimationFrame(() => {
        syncPending = false
        try {
          const size = sizeWebviewToHost(ref, el)
          fitGuestFrame(size.width, size.height)
          logBrowser("resize", { tab, ...size, ...webviewSnapshot(ref, el) })
          const isCollapsed = size.width < 2 || size.height < 2
          const wasVisible = hostVisible
          hostVisible = !isCollapsed
          if (hostVisible !== wasVisible) {
            collapsed = isCollapsed
            logChainHeights(ref, tab, isCollapsed ? "collapsed" : "recovered")
          }
          if (hostVisible && !wasVisible) {
            // The host just became visible; start any load that was deferred
            // while it was hidden so the guest paints at full size.
            drivePendingLoad()
          }
          return size
        } catch (error) {
          logBrowser("resize error", { tab, error: String(error) })
        }
      })
    }
    ref.appendChild(el)
    webview = el
    // Electron renders <webview> as a shadow-root <iframe> that stretches to
    // the host only when the host is a flex container (the shadow's own
    // `:host { display: flex }` rule). Our inline `display: block` above
    // (needed so the guest doesn't collapse under flex + overflow-hidden
    // ancestors) overrides that, so the frame's height falls back to
    // Chromium's 150px replaced-element default and the page gets squeezed
    // into the top 150px of the panel. Size the guest frame in pixels to
    // match the host instead. Guarded: without a frame (older Electron, or
    // the frame not created yet) this is a no-op and behavior is unchanged.
    const fitGuestFrame = (width: number, height: number) => {
      const frame = el.shadowRoot?.querySelector("iframe")
      if (!frame) return
      frame.style.width = `${width}px`
      frame.style.height = `${height}px`
    }
    syncBox()
    fitGuestFrame(ref.getBoundingClientRect().width, ref.getBoundingClientRect().height)
    const observer = new ResizeObserver(syncBox)
    observer.observe(ref)

    guestReady = false
    pendingUrl = initialUrl()

    const onNavigate = () => {
      const url = safeGuestUrl()
      logBrowser("navigate", { tab, url, ...webviewSnapshot(ref, el) })
      if (design.active()) design.exit()
      if (url) {
        loadedUrl = url
        setStore("input", url)
        recordVisit(url)
      }
      if (guestReady) syncTitle()
    }
    const onLoadingStart = () => {
      logBrowser("loading-start", { tab, src: el.src })
      setStore("loading", true)
    }
    const onLoadingStop = () => {
      logBrowser("loading-stop", { tab, url: safeGuestUrl() || el.src, ...webviewSnapshot(ref, el) })
      setStore("loading", false)
      if (guestReady) syncTitle()
    }
    const onTitle = () => syncTitle()
    const onFail = (event: Event) => {
      const detail = event as Event & {
        errorCode?: number
        errorDescription?: string
        validatedURL?: string
        isMainFrame?: boolean
      }
      console.error("[browser-tab] did-fail-load", {
        tab,
        errorCode: detail.errorCode,
        errorDescription: detail.errorDescription,
        validatedURL: detail.validatedURL,
        isMainFrame: detail.isMainFrame,
        ...webviewSnapshot(ref, el),
      })
      // A failed main-frame load does not emit did-stop-loading, so clear the
      // loading state here or the opaque skeleton stays up forever.
      if (detail.isMainFrame) setStore("loading", false)
    }
    const onDomReady = () => {
      guestReady = true
      logBrowser("dom-ready", { tab, pendingUrl, ...webviewSnapshot(ref, el) })
      // Setting `src` before the guest finished creating can be dropped, leaving
      // the guest on about:blank; and a guest loaded while its host is hidden
      // paints at 1x1 and never repaints. Drive the pending load now that the
      // guest exists and the host is (or becomes) visible.
      drivePendingLoad()
      syncBox()
    }
    const onFinish = () => {
      logBrowser("finish-load", { tab, url: safeGuestUrl() || el.src, ...webviewSnapshot(ref, el) })
    }

    el.addEventListener("dom-ready", onDomReady)
    el.addEventListener("did-finish-load", onFinish)
    el.addEventListener("did-navigate", onNavigate)
    el.addEventListener("did-navigate-in-page", onNavigate)
    el.addEventListener("did-start-loading", onLoadingStart)
    el.addEventListener("did-stop-loading", onLoadingStop)
    el.addEventListener("page-title-updated", onTitle)
    el.addEventListener("did-fail-load", onFail)
    el.addEventListener("did-fail-provisional-load", onFail)

    load(initialUrl())
    onCleanup(() => {
      logBrowser("unmount", { tab, loadedUrl, ...webviewSnapshot(ref, el) })
      el.removeEventListener("dom-ready", onDomReady)
      el.removeEventListener("did-finish-load", onFinish)
      el.removeEventListener("did-navigate", onNavigate)
      el.removeEventListener("did-navigate-in-page", onNavigate)
      el.removeEventListener("did-start-loading", onLoadingStart)
      el.removeEventListener("did-stop-loading", onLoadingStop)
      el.removeEventListener("page-title-updated", onTitle)
      el.removeEventListener("did-fail-load", onFail)
      el.removeEventListener("did-fail-provisional-load", onFail)
      observer.disconnect()
      el.remove()
      webview = undefined
      if (!document.querySelector("[data-component=browser-webview]")) {
        document.documentElement.removeAttribute("data-design-mode")
      }
    })
  })

  createEffect(() => {
    if (!webview || platform.platform !== "desktop") return
    const url = layout.browser.get(props.tab)?.url
    if (url && !sameUrl(url, loadedUrl)) {
      logBrowser("store url changed", { tab: props.tab, url, loadedUrl })
      load(url)
    }
  })

  const submit = (event: SubmitEvent) => {
    event.preventDefault()
    if (!webview) return
    const url = normalizeUrl(store.input)
    if (!url) return
    setStore("input", url)
    load(url)
    recordVisit(url)
  }

  const reload = () => {
    if (!webview) return
    webview.reload()
  }
  const goBack = () => webview?.goBack()
  const goForward = () => webview?.goForward()
  const goHome = () => {
    if (!webview) return
    setStore("input", BROWSER_HOME_URL)
    load(BROWSER_HOME_URL)
    recordVisit(BROWSER_HOME_URL)
  }

  const navigateTo = (url: string) => {
    if (!webview) return
    setStore("input", url)
    load(url)
    recordVisit(url)
  }

  return (
    <div class="flex h-full min-h-0 flex-col bg-background-base">
      <form class="flex shrink-0 items-center gap-1 px-2 py-1.5" onSubmit={submit}>
        <TooltipV2 placement="bottom" value={language.t("browser.back")}>
          <IconButtonV2
            type="button"
            variant="ghost-muted"
            size="small"
            icon={<Icon name="arrow-left" />}
            onClick={goBack}
            aria-label={language.t("browser.back")}
          />
        </TooltipV2>
        <TooltipV2 placement="bottom" value={language.t("browser.forward")}>
          <IconButtonV2
            type="button"
            variant="ghost-muted"
            size="small"
            icon={<Icon name="arrow-right" />}
            onClick={goForward}
            aria-label={language.t("browser.forward")}
          />
        </TooltipV2>
        <TooltipV2 placement="bottom" value={language.t("browser.reload")}>
          <IconButtonV2
            type="button"
            variant="ghost-muted"
            size="small"
            icon={<IconV2 name="reset" />}
            onClick={reload}
            aria-label={language.t("browser.reload")}
          />
        </TooltipV2>
        <input
          class="min-w-0 flex-1 rounded-md border border-border-weak-base bg-background-stronger px-2 py-1 text-12-regular text-text-base outline-none focus:border-border-base"
          value={store.input}
          onInput={(event) => setStore("input", event.currentTarget.value)}
          placeholder={language.t("browser.url.placeholder")}
          spellcheck={false}
        />
        <Show when={store.loading}>
          <span class="size-3 shrink-0 animate-spin rounded-full border border-text-weak border-t-transparent" aria-hidden="true" />
        </Show>
        <TooltipV2 placement="bottom" value={language.t("browser.home")}>
          <IconButtonV2
            type="button"
            variant="ghost-muted"
            size="small"
            icon={<IconV2 name="monitor" />}
            onClick={goHome}
            aria-label={language.t("browser.home")}
          />
        </TooltipV2>
        <MenuV2 gutter={4} placement="bottom-end">
          <MenuV2.Trigger
            as={IconButtonV2}
            type="button"
            variant="ghost-muted"
            size="small"
            icon={<IconV2 name="reset" />}
            aria-label={language.t("browser.history")}
          />
          <MenuV2.Portal>
            <MenuV2.Content>
              <Show
                when={layout.browser.get(props.tab)?.history?.length}
                fallback={
                  <MenuV2.Item disabled>
                    <span class="text-12-regular text-text-weak">{language.t("browser.history.empty")}</span>
                  </MenuV2.Item>
                }
              >
                <For each={[...(layout.browser.get(props.tab)?.history ?? [])].reverse()}>
                  {(url) => (
                    <MenuV2.Item onSelect={() => navigateTo(url)}>
                      <span class="block max-w-64 truncate">{url}</span>
                    </MenuV2.Item>
                  )}
                </For>
              </Show>
            </MenuV2.Content>
          </MenuV2.Portal>
        </MenuV2>
      </form>
      <Show
        when={platform.platform === "desktop"}
        fallback={
          <div
            class="flex flex-1 items-center justify-center px-6 text-center text-12-regular text-text-weak"
            data-component="browser-content"
          >
            <button
              type="button"
              class="text-text-base transition-colors hover:text-text-strong"
              onClick={() => platform.openExternal(store.input)}
            >
              {language.t("browser.webFallback")}
            </button>
          </div>
        }
      >
        <div class="relative flex min-h-0 flex-1 flex-col">
          <div
            ref={ref}
            class={BROWSER_WEBVIEW_HOST_CLASS}
            data-component="browser-webview"
          />
          {/* The loading overlay must not live inside the host div: toggling it
              (loading -> loaded) makes Solid clear the host's children, which
              also detaches the imperatively-appended <webview> element and
              leaves the browser blank. Overlay the host from a sibling. */}
          <Show when={store.loading}>
            <div
              class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-background-base"
              data-component="browser-webview-loading"
            >
              <div class="h-40 max-h-full w-4/5 max-w-md animate-pulse rounded-lg bg-surface-raised-base opacity-60" />
            </div>
          </Show>
        </div>
      </Show>
    </div>
  )
}
