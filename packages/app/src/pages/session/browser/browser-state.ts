export const BROWSER_HOME_URL = "https://www.google.com"

// Per-tab browser state so the embedded webview's URL/title survive tab
// switches, re-mounts, and app restarts. Keyed by the browser tab value
// (`browser://<url>`). Persisted through the layout store.
export type BrowserTabState = { url: string; title?: string; history?: string[] }

export const BROWSER_HISTORY_LIMIT = 50