import { createEffect, createMemo, onCleanup, onMount, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { Icon } from "@klautcode/ui/icon"
import { IconButtonV2 } from "@klautcode/ui/v2/icon-button-v2"
import { Icon as IconV2 } from "@klautcode/ui/v2/icon"
import { TooltipV2 } from "@klautcode/ui/v2/tooltip-v2"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { browserUrlFromTab } from "@/pages/session/helpers"
import { getBrowserTabState, setBrowserTabState, BROWSER_HOME_URL } from "./browser-state"

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

function openWebviewUrl(webview: WebviewTag, url: string) {
  if (!webview || !url) return
  try {
    void webview.loadURL(url).catch(() => {})
  } catch {
    webview.src = url
  }
}

export function BrowserTab(props: { tab: string }) {
  const language = useLanguage()
  const platform = usePlatform()
  const initialUrl = createMemo(() => {
    const url = browserUrlFromTab(props.tab)
    if (url) return url
    return getBrowserTabState(props.tab)?.url ?? BROWSER_HOME_URL
  })
  const [store, setStore] = createStore({
    input: initialUrl(),
    loading: false,
  })
  let ref: HTMLDivElement | undefined
  let webview: WebviewTag | undefined
  let loadedUrl: string | undefined

  const load = (url: string) => {
    if (!webview) return
    loadedUrl = url
    openWebviewUrl(webview, url)
  }

  const syncTitle = () => {
    if (!webview) return
    const title = webview.getTitle()
    setBrowserTabState(props.tab, { url: webview.getURL() || store.input, title: title || undefined })
  }

  onMount(() => {
    if (!ref || platform.platform !== "desktop") return
    const el = document.createElement("webview") as WebviewTag
    el.setAttribute("partition", "persist:klautcode-browser")
    el.setAttribute("allowpopups", "false")
    el.style.display = "block"
    el.style.width = "100%"
    el.style.flex = "1"
    el.style.minHeight = "0"
    ref.appendChild(el)
    webview = el

    const onNavigate = () => {
      const url = webview?.getURL() ?? ""
      if (url) {
        loadedUrl = url
        setStore("input", url)
      }
      syncTitle()
    }
    const onLoadingStart = () => setStore("loading", true)
    const onLoadingStop = () => {
      setStore("loading", false)
      syncTitle()
    }
    const onTitle = () => syncTitle()

    el.addEventListener("did-navigate", onNavigate)
    el.addEventListener("did-navigate-in-page", onNavigate)
    el.addEventListener("did-start-loading", onLoadingStart)
    el.addEventListener("did-stop-loading", onLoadingStop)
    el.addEventListener("page-title-updated", onTitle)

    load(initialUrl())
    onCleanup(() => {
      el.removeEventListener("did-navigate", onNavigate)
      el.removeEventListener("did-navigate-in-page", onNavigate)
      el.removeEventListener("did-start-loading", onLoadingStart)
      el.removeEventListener("did-stop-loading", onLoadingStop)
      el.removeEventListener("page-title-updated", onTitle)
      el.remove()
      webview = undefined
    })
  })

  createEffect(() => {
    if (!webview || platform.platform !== "desktop") return
    const url = getBrowserTabState(props.tab)?.url
    if (url && url !== loadedUrl) load(url)
  })

  const submit = (event: SubmitEvent) => {
    event.preventDefault()
    if (!webview) return
    const url = normalizeUrl(store.input)
    if (!url) return
    setBrowserTabState(props.tab, { url })
    setStore("input", url)
    load(url)
  }

  const reload = () => {
    if (!webview) return
    webview.reload()
  }
  const goBack = () => webview?.goBack()
  const goForward = () => webview?.goForward()
  const goHome = () => {
    if (!webview) return
    setBrowserTabState(props.tab, { url: BROWSER_HOME_URL })
    setStore("input", BROWSER_HOME_URL)
    load(BROWSER_HOME_URL)
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
      </form>
      <Show
        when={platform.platform === "desktop"}
        fallback={
          <div class="flex flex-1 items-center justify-center px-6 text-center text-12-regular text-text-weak">
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
        <div ref={ref} class="flex min-h-0 flex-1 flex-col" data-component="browser-webview" />
      </Show>
    </div>
  )
}
