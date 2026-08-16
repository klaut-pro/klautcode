import { createStore } from "solid-js/store"

export const BROWSER_HOME_URL = "https://www.google.com"

// Per-tab browser state so the embedded webview's URL/title survive tab
// switches and re-mounts. Keyed by the browser tab value (`browser://<url>`).
export type BrowserTabState = { url: string; title?: string }

const [browserState, setBrowserState] = createStore<Record<string, BrowserTabState | undefined>>({})

export function getBrowserTabState(tab: string): BrowserTabState | undefined {
  return browserState[tab]
}

export function setBrowserTabState(tab: string, patch: Partial<BrowserTabState>) {
  setBrowserState(tab, (previous) => ({ url: previous?.url ?? "", ...previous, ...patch }))
}

export function clearBrowserTabState(tab: string) {
  setBrowserState(tab, undefined)
}
