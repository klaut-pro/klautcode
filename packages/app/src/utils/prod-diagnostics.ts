import { useLanguage } from "@/context/language"

type LayoutMeasurement = {
  sidebar: number | null
  middle: number | null
  right: number | null
  delta: number | null
  aligned: boolean
}

let layoutDiagnosticsEnabled = false
let layoutCheckInterval: number | undefined

export function collectStartupDiagnostics(snapshot: Record<string, unknown>) {
  const info = {
    timestamp: new Date().toISOString(),
    userAgent: typeof navigator !== "object" ? "unknown" : navigator.userAgent,
    platform: typeof navigator !== "object" ? "unknown" : navigator.platform,
    viewport: typeof window === "object" ? { w: window.innerWidth, h: window.innerHeight, dvh: window.innerHeight } : null,
    url: typeof location === "object" ? location.href : "unknown",
    ...snapshot,
  }
  console.error("[diagnostics] startup snapshot", info)
  // Forward to main log in desktop
  try {
    const api = (window as unknown as { api?: { recordFatalRendererError?: (p: unknown) => Promise<void> } }).api
    void api?.recordFatalRendererError?.({
      error: `[diagnostics] startup: ${JSON.stringify(info, null, 2)}`,
      url: info.url as string,
      version: "diagnostic",
      platform: "web",
      os: undefined,
    } as never)
  } catch {}
  return info
}

export function measureLayoutHeights(): LayoutMeasurement {
  if (typeof document === "undefined") return { sidebar: null, middle: null, right: null, delta: null, aligned: true }
  const sidebar = document.querySelector<HTMLElement>("[data-component='home-projects']")?.getBoundingClientRect().height
    ?? document.querySelector<HTMLElement>("aside")?.getBoundingClientRect().height ?? null
  const middle = document.querySelector<HTMLElement>("[data-component='home-sessions']")?.getBoundingClientRect().height
    ?? document.querySelector<HTMLElement>("section")?.getBoundingClientRect().height ?? null
  // Right sidebar is part of the chat view - approximate via grid container
  const grid = document.querySelector<HTMLElement>("[class*='grid-cols']")?.getBoundingClientRect().height ?? null
  const delta = sidebar !== null && middle !== null ? Math.abs(sidebar - middle) : null
  const aligned = delta === null ? true : delta < 8
  return { sidebar, middle, right: grid, delta, aligned }
}

export function startLayoutDiagnostics(intervalMs = 3000) {
  if (layoutDiagnosticsEnabled) return
  layoutDiagnosticsEnabled = true
  let lastDelta: number | null = null
  layoutCheckInterval = window.setInterval(() => {
    const m = measureLayoutHeights()
    if (m.delta === null || m.aligned) return
    if (lastDelta !== null && Math.abs(m.delta - lastDelta) < 2) return
    lastDelta = m.delta
    console.warn("[diagnostics] layout height mismatch", m)
    try {
      const api = (window as unknown as { api?: { recordFatalRendererError?: (p: unknown) => Promise<void> } }).api
      void api?.recordFatalRendererError?.({
        error: `[diagnostics] layout mismatch: ${JSON.stringify(m, null, 2)}`,
        url: location.href,
        version: "diagnostic",
        platform: "desktop",
        os: undefined,
      } as never)
    } catch {}
  }, intervalMs)
}

export function stopLayoutDiagnostics() {
  if (layoutCheckInterval !== undefined) {
    clearInterval(layoutCheckInterval)
    layoutCheckInterval = undefined
  }
  layoutDiagnosticsEnabled = false
}

export function setupGlobalDiagnostics() {
  if (typeof window === "undefined") return
  const seen = new Set<string>()
  const report = (kind: string, error: unknown) => {
    const key = `${kind}:${String(error).slice(0, 200)}`
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
  // Also wrap console.error to forward
  const origError = console.error
  console.error = (...args: unknown[]) => {
    origError(...args)
    // Forward first arg if looks like diagnostic
    if (typeof args[0] === "string" && args[0].includes("[diagnostics]")) return
    if (typeof args[0] === "string" && args[0].includes("[startup]")) {
      report("console.error", args.map(String).join(" ").slice(0, 2000))
    }
  }
}

export function useProdDiagnosticsCommand() {
  const language = useLanguage()
  return {
    id: "diagnostics.show",
    title: (language.t as (k: string) => string)("command.diagnostics.show") ?? "Show Diagnostics",
    category: (language.t as (k: string) => string)("command.category.help") ?? "Help",
    onSelect: () => {
      const startup = collectStartupDiagnostics({ trigger: "command", layout: measureLayoutHeights() })
      alert(`Diagnostics:\n${JSON.stringify(startup, null, 2).slice(0, 3000)}`)
    },
  }
}
