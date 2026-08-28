// @refresh reload

import {
  ACCEPTED_FILE_EXTENSIONS,
  AppBaseProviders,
  AppInterface,
  loadLocaleDict,
  normalizeLocale,
  type Locale,
  type Platform,
  PlatformProvider,
  createDraftStore,
  ServerConnection,
  useCommand,
  useWslServers,
  useLanguage,
} from "@klautcode/app"
import type { UpdaterState } from "@klautcode/app/updater"
import * as Sentry from "@sentry/solid"
import type { AsyncStorage } from "@solid-primitives/storage"
import { createMemoryHistory, MemoryRouter, type BaseRouterProps } from "@solidjs/router"
import { createEffect, createMemo, createResource, createSignal, onCleanup, Show } from "solid-js"
import { render } from "solid-js/web"
import pkg from "../../package.json"
import { t } from "./i18n"
import { initializationData } from "./initialization"
import { DesktopFirstLaunchOnboarding } from "./onboarding"
import { resetZoom, setPinchZoomEnabled, webviewZoom, zoomIn, zoomOut } from "./webview-zoom"
import { windowFullscreen } from "./window-fullscreen"
import { availableStartupServer, readyWslConnections } from "./wsl/connections"
import "./styles.css"
import { Splash } from "@klautcode/ui/logo"
import { useTheme } from "@klautcode/ui/theme/context"

// Inline prod diagnostics setup to avoid cross-package import cycle
// Chromium dispatches benign "ResizeObserver loop" warnings through the window
// error event; they are not real renderer errors, so don't record them.
const BENIGN_ERROR_PATTERNS = [/ResizeObserver loop (?:completed with undelivered notifications|limit exceeded)/]
function setupGlobalDiagnostics() {
  if (typeof window === "undefined") return
  const seen = new Set<string>()
  const report = (kind: string, error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    if (BENIGN_ERROR_PATTERNS.some((pattern) => pattern.test(message))) return
    const key = `${kind}:${message.slice(0, 200)}`
    if (seen.has(key)) return
    seen.add(key)
    if (seen.size > 50) seen.clear()
    console.error(`[diagnostics] ${kind}`, error)
    try {
      const api = (window as unknown as { api?: { recordFatalRendererError?: (p: unknown) => Promise<void> } }).api
      const stack = error instanceof Error ? (error.stack ?? String(error)) : String(error)
      void api?.recordFatalRendererError?.({
        error: `[diagnostics] ${kind}: ${stack.slice(0, 4000)}`,
        url: location.href,
        version: "diagnostic",
        platform: "desktop",
        os: undefined,
      } as never)
    } catch {}
  }
  window.addEventListener("error", (event) => report("window.onerror", event.error ?? event.message))
  window.addEventListener("unhandledrejection", (event) => report("unhandledrejection", event.reason))
}
setupGlobalDiagnostics()

const root = document.getElementById("root")
if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(t("desktop.error.dev.rootNotFound"))
}

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT ?? import.meta.env.MODE,
    release: import.meta.env.VITE_SENTRY_RELEASE ?? `desktop@${pkg.version}`,
    initialScope: {
      tags: {
        platform: "desktop",
      },
    },
    integrations: (integrations) => {
      return integrations.filter(
        (i) =>
          i.name !== "Breadcrumbs" &&
          !(
            import.meta.env.KLAUTCODE_CHANNEL === "prod" &&
            (i.name === "GlobalHandlers" || i.name === "BrowserApiErrors")
          ),
      )
    },
  })
}

const [updaterState, setUpdaterState] = createSignal<UpdaterState>({ status: "disabled" })
void window.api.updater.subscribe(setUpdaterState)

const deepLinkEvent = "klautcode:deep-link"

type DesktopWindowState = {
  id?: string
  initialUrl?: string
}

const emitDeepLinks = (urls: string[]) => {
  if (urls.length === 0) return
  window.__KLAUTCODE__ ??= {}
  const pending = window.__KLAUTCODE__.deepLinks ?? []
  window.__KLAUTCODE__.deepLinks = [...pending, ...urls]
  window.dispatchEvent(new CustomEvent(deepLinkEvent, { detail: { urls } }))
}

const listenForDeepLinks = () => {
  void window.api.consumeInitialDeepLinks().then((urls) => emitDeepLinks(urls))
  return window.api.onDeepLink((urls) => emitDeepLinks(urls))
}

// The last-active-url must survive app quit, so it is committed through the
// synchronous window-store IPC (the same path used for open tabs, whose async
// writes would otherwise be dropped on teardown). DOM localStorage flushes
// asynchronously and can lose the final navigation on quit/crash, which made
// session restore flaky (boot to home instead of the last session).
const LAST_ACTIVE_URL_KEY = "last-active-url"

function windowLastActiveStore(windowID: string) {
  const safe = (windowID || "browser").replace(/[^a-zA-Z0-9._-]/g, "-")
  return `klautcode.window.${safe}.dat`
}

// Legacy key used by older builds (DOM localStorage); migrated on first read.
function legacyLastActiveUrlKey(windowID: string) {
  return `klautcode.desktop.window.${windowID}.last-active-url`
}

function readLegacyLastActiveUrl(windowID: string) {
  if (typeof localStorage !== "object") return "/"
  try {
    const value = localStorage.getItem(legacyLastActiveUrlKey(windowID))
    if (value?.startsWith("/") && !value.startsWith("//")) return value
  } catch {}
  return "/"
}

async function loadLastActiveUrl(windowID: string) {
  try {
    const value = await window.api.storeGet(windowLastActiveStore(windowID), LAST_ACTIVE_URL_KEY)
    if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//")) return value
  } catch {}
  const legacy = readLegacyLastActiveUrl(windowID)
  if (legacy !== "/") setLastActiveUrl(windowID, legacy)
  return legacy
}

function setLastActiveUrl(windowID: string, value: string) {
  try {
    window.api.storeSetSync(windowLastActiveStore(windowID), LAST_ACTIVE_URL_KEY, value)
  } catch {}
  // Keep the legacy DOM-localStorage key in sync so older builds (or a
  // downgrade) still restore the same URL.
  if (typeof localStorage === "object") {
    try {
      localStorage.setItem(legacyLastActiveUrlKey(windowID), value)
    } catch {}
  }
}

function DesktopMemoryRouter(props: BaseRouterProps & { windowID: string; initialUrl: string }) {
  const history = createMemoryHistory()
  if (props.initialUrl !== "/") history.set({ value: props.initialUrl, replace: true, scroll: false })
  onCleanup(history.listen((value) => setLastActiveUrl(props.windowID, value)))
  return <MemoryRouter {...props} history={history} />
}

const createPlatform = (windowState: DesktopWindowState): Platform => {
  const [sidecarStatus, setSidecarStatus] = createSignal<"connected" | "reconnecting" | "failed">("connected")
  void window.api.onSidecarStatus(setSidecarStatus)
  const attachmentPaths = new WeakMap<File, string>()
  const os = (() => {
    const ua = navigator.userAgent
    if (ua.includes("Mac")) return "macos"
    if (ua.includes("Windows")) return "windows"
    if (ua.includes("Linux")) return "linux"
    return undefined
  })()

  const runDesktopMenuAction: Platform["runDesktopMenuAction"] = (action) => {
    switch (action) {
      case "view.resetZoom":
        resetZoom()
        return
      case "view.zoomIn":
        zoomIn()
        return
      case "view.zoomOut":
        zoomOut()
        return
    }

    return window.api.runDesktopMenuAction(action)
  }

  const storage = (() => {
    const cache = new Map<string, AsyncStorage>()

    const createStorage = (name: string) => {
      // Window-scoped state (open tabs, tab metadata, recently closed) must be
      // committed to disk before the window is torn down on quit, so those
      // writes go through a synchronous IPC round-trip.
      const syncWrite = name.startsWith("klautcode.window")
      const api: AsyncStorage = {
        getItem: (key: string) => window.api.storeGet(name, key),
        setItem: (key: string, value: string) =>
          syncWrite ? Promise.resolve(window.api.storeSetSync(name, key, value)) : window.api.storeSet(name, key, value),
        removeItem: (key: string) => window.api.storeDelete(name, key),
        clear: () => window.api.storeClear(name),
        key: async (index: number) => (await window.api.storeKeys(name))[index],
        getLength: () => window.api.storeLength(name),
        get length() {
          return api.getLength()
        },
      }
      return api
    }

    return (name = "default.dat") => {
      const cached = cache.get(name)
      if (cached) return cached
      const api = createStorage(name)
      cache.set(name, api)
      return api
    }
  })()

  const wslServersApi = os === "windows" ? window.api.wslServers : undefined

  return {
    platform: "desktop",
    os,
    version: pkg.version,
    windowID: windowState.id,
    sidecarStatus,

    async openDirectoryPickerDialog(opts) {
      return window.api.openDirectoryPicker({
        multiple: opts?.multiple ?? false,
        title: opts?.title,
      })
    },

    async openAttachmentPickerDialog(opts, onFile) {
      const result = await window.api.openFilePicker({
        multiple: opts?.multiple ?? false,
        title: opts?.title,
        defaultPath: opts?.defaultPath,
        extensions: opts?.extensions ?? ACCEPTED_FILE_EXTENSIONS,
      })
      if (!result) return
      try {
        for (const file of result.files) {
          const selected = new File([await window.api.readPickedFile(result.token, file.path)], file.name)
          attachmentPaths.set(selected, file.path)
          await onFile(selected)
        }
      } finally {
        await window.api.releasePickedFiles(result.token)
      }
    },

    getPathForFile(file) {
      return attachmentPaths.get(file) ?? window.api.getPathForFile(file)
    },

    async saveFilePickerDialog(opts) {
      return window.api.saveFilePicker({
        title: opts?.title,
        defaultPath: opts?.defaultPath,
      })
    },

    openExternal(url: string) {
      window.api.openExternal(url)
    },
    openLocalFile(url: string) {
      window.api.openLocalFile(url)
    },
    async openPath(path: string, app?: string) {
      if (os === "windows") {
        const resolvedApp = app ? await window.api.resolveAppPath(app).catch(() => null) : null
        return window.api.openPath(path, resolvedApp ?? undefined)
      }
      return window.api.openPath(path, app)
    },
    async revealPath(path: string) {
      return window.api.revealPath(path)
    },

    storage,
    draftStore: createDraftStore({
      get: window.api.draftGet,
      set: window.api.draftSet,
      remove: window.api.draftDelete,
      putBlob: (blob) => blob.arrayBuffer().then(window.api.draftBlobPut),
      getBlob: (id) => window.api.draftBlobGet(id).then((data) => data && new Blob([data])),
    }),

    updater: {
      state: updaterState,
      check: () => window.api.updater.check(),
      install: () => window.api.updater.install(),
    },

    exportDebugLogs: () => window.api.exportDebugLogs(),

    setForceFocus: (enabled) => window.api.setForceFocus(enabled),

    recordFatalRendererError: (error) => window.api.recordFatalRendererError(error),

    captureWindow: () => window.api.captureWindow(),

    runProbeScript: (script) => window.api.runProbeScript(script),

    opencodeImport: {
      scan: (directory) => window.api.opencodeScan(directory),
      run: (directory, projectIds) => window.api.opencodeImport(directory, projectIds),
    },

    restart: async () => {
      await window.api.killSidecar().catch(() => undefined)
      window.api.relaunch()
    },

    notify: async (title, description, onClick) => {
      const focused = await window.api.getWindowFocused().catch(() => document.hasFocus())
      if (focused) return

      const notification = new Notification(title, {
        body: description ?? "",
        icon: "https://code.klaut.pro/favicon-96x96-v3.png",
      })
      notification.onclick = () => {
        void window.api.showWindow()
        void window.api.setWindowFocus()
        onClick?.()
        notification.close()
      }
    },

    fetch: (input, init) => {
      if (input instanceof Request) return fetch(input)
      return fetch(input, init)
    },

    getDefaultServer: async () => {
      const url = await window.api.getDefaultServerUrl().catch(() => null)
      if (!url) return null
      return ServerConnection.Key.make(url)
    },

    setDefaultServer: async (url: string | null) => {
      await window.api.setDefaultServerUrl(url)
    },

    wslServers: wslServersApi,

    getDisplayBackend: async () => {
      return window.api.getDisplayBackend().catch(() => null)
    },

    setDisplayBackend: async (backend) => {
      await window.api.setDisplayBackend(backend)
    },

    webviewZoom,

    windowFullscreen,

    getPinchZoomEnabled: () => window.api.getPinchZoomEnabled(),

    setPinchZoomEnabled,

    runDesktopMenuAction,

    checkAppExists: async (appName: string) => {
      return window.api.checkAppExists(appName)
    },

    async readClipboardImage() {
      const image = await window.api.readClipboardImage().catch(() => null)
      if (!image) return null
      const blob = new Blob([image.buffer], { type: "image/png" })
      return new File([blob], `pasted-image-${Date.now()}.png`, {
        type: "image/png",
      })
    },
  }
}

let menuTrigger = null as null | ((id: string) => void)
window.api.onMenuCommand((id) => {
  menuTrigger?.(id)
})
listenForDeepLinks()

function LoadingSplash() {
  return (
    <div class="h-dvh w-screen flex flex-col items-center justify-center bg-background-base">
      <Splash class="w-16 h-20 opacity-50 animate-pulse" />
    </div>
  )
}

function DesktopRoot(props: { windowState: DesktopWindowState }) {
  const platform = createPlatform(props.windowState)
  const loadLocale = async () => {
    const current = await platform.storage?.("klautcode.global.dat").getItem("language")
    const legacy = current ? undefined : await platform.storage?.().getItem("language.v1")
    const raw = current ?? legacy
    if (!raw) return
    const locale = raw.match(/"locale"\s*:\s*"([^"]+)"/)?.[1]
    if (!locale) return
    const next = normalizeLocale(locale)
    if (next !== "en") await loadLocaleDict(next)
    return next satisfies Locale
  }

  // Fetch sidecar credentials (available immediately, before health check)
  const [sidecar] = createResource(() => window.api.awaitInitialization())

  const [defaultServer] = createResource(() => platform.getDefaultServer?.())
  const [locale] = createResource(loadLocale)
  const router = (routerProps: BaseRouterProps) => (
    <DesktopMemoryRouter
      {...routerProps}
      windowID={platform.windowID ?? "browser"}
      initialUrl={props.windowState.initialUrl ?? "/"}
    />
  )
  const onboarding = Promise.withResolvers<void>()

  function Inner() {
    const cmd = useCommand()
    menuTrigger = (id) => cmd.trigger(id)

    const theme = useTheme()

    createEffect(() => {
      theme.themeId()
      theme.mode()
      const bg = getComputedStyle(document.documentElement).getPropertyValue("--background-base").trim()
      if (bg) {
        void window.api.setBackgroundColor(bg)
      }
    })

    return null
  }

  function DiagnosticFallback(props: { title: string; details: string }) {
    return (
      <div class="h-dvh w-screen flex flex-col items-center justify-center bg-v2-background-bg-deep gap-6 p-6 text-center">
        <Splash class="w-12 h-15 opacity-30" />
        <div class="flex flex-col gap-2 max-w-lg">
          <p class="text-sm font-medium text-v2-text-text-base">{props.title}</p>
          <pre class="whitespace-pre-wrap break-all text-left text-[11px] leading-4 font-mono bg-v2-background-bg-base rounded-lg p-3 max-h-[40vh] overflow-auto text-v2-text-text-muted">
            {props.details}
          </pre>
        </div>
        <button
          type="button"
          class="text-xs text-v2-text-text-muted underline"
          onClick={() => window.api.exportDebugLogs?.()}
        >
          Export debug logs
        </button>
      </div>
    )
  }

  function App() {
    const wslServers = useWslServers()
    const language = useLanguage()
    const ready = createMemo(
      () => !defaultServer.loading && !sidecar.loading && !locale.loading && !wslServers.isLoading,
    )
    const servers = createMemo(() => {
      const data = initializationData(sidecar)
      const list: ServerConnection.Any[] = []
      if (data) {
        list.push({
          displayName: language.t("desktop.server.local"),
          type: "sidecar",
          variant: "base",
          http: {
            url: data.url,
            username: data.username ?? undefined,
            password: data.password ?? undefined,
          },
        })
      }
      list.push(...readyWslConnections(wslServers.data, language.t("wsl.server.label")))
      return list
    })
    const effectiveDefaultServer = createMemo(() =>
      ServerConnection.Key.make(availableStartupServer(defaultServer.latest, wslServers.data)),
    )
    // Diagnostics: capture startup state for prod white-screen debugging.
    // When effectiveDefaultServer is falsy after ready, the inner Show would
    // previously render nothing (white screen). Now we log and show fallback.
    createEffect(() => {
      if (!ready()) return
      const key = effectiveDefaultServer()
      if (key) return
      const snapshot = {
        defaultServer: { loading: defaultServer.loading, latest: defaultServer.latest, error: String(defaultServer.error ?? "") },
        sidecar: { loading: sidecar.loading, error: String((sidecar as { error?: unknown }).error ?? ""), data: sidecar() ? "present" : "missing" },
        wslServers: { isLoading: wslServers.isLoading, error: String((wslServers as { error?: unknown }).error ?? "") },
        availableStartup: availableStartupServer(defaultServer.latest, wslServers.data),
        effectiveKey: String(key ?? ""),
      }
      console.error("[desktop] effectiveDefaultServer empty after ready", snapshot)
      void window.api
        .exportDebugLogs?.()
        .catch(() => undefined)
      // Also persist to main log via fatal renderer error for export bundle
      void (window.api as unknown as { recordFatalRendererError?: (p: unknown) => Promise<void> }).recordFatalRendererError?.({
        error: `[diagnostic] effectiveDefaultServer empty: ${JSON.stringify(snapshot, null, 2)}`,
        url: location.href,
        version: platform.version,
        platform: platform.platform,
        os: platform.os,
      } as never)
    })
    return (
      <Show when={ready()} fallback={<LoadingSplash />}>
        <Show
          when={effectiveDefaultServer()}
          keyed
          fallback={
            <DiagnosticFallback
              title="Startup failed: no server available"
              details={JSON.stringify(
                {
                  defaultServer: { loading: defaultServer.loading, latest: defaultServer.latest, error: String(defaultServer.error ?? "") },
                  sidecar: { loading: sidecar.loading, error: String((sidecar as { error?: unknown }).error ?? "") },
                  wsl: { isLoading: wslServers.isLoading },
                },
                null,
                2,
              )}
            />
          }
        >
          {(key) => (
            <AppInterface
              defaultServer={key}
              servers={servers()}
              router={router}
              startup={onboarding.promise}
              serverScoped={
                <DesktopFirstLaunchOnboarding
                  initialUrl={props.windowState.initialUrl ?? "/"}
                  onLoaded={onboarding.resolve}
                />
              }
            >
              <Inner />
            </AppInterface>
          )}
        </Show>
      </Show>
    )
  }

  return (
    <PlatformProvider value={platform}>
      <AppBaseProviders
        locale={locale.latest}
        onNativeTranslations={(bundle) => void window.api.setNativeTranslations(bundle).catch(() => undefined)}
      >
        <Show when={true}>{(_) => <App />}</Show>
      </AppBaseProviders>
    </PlatformProvider>
  )
}

render(() => {
  const [windowState] = createResource(async () => {
    const api = window.api as typeof window.api & {
      getWindowID?: () => Promise<string>
    }
    const id = (await api.getWindowID?.()) ?? "browser"
    return { id, initialUrl: await loadLastActiveUrl(id) }
  })

  return (
    <Show when={windowState.latest} fallback={<LoadingSplash />} keyed>
      {(state) => <DesktopRoot windowState={state} />}
    </Show>
  )
}, root!)
