// Electron <webview> guests collapse unless the host has a definite box and
// the guest is sized in pixels. `flex-1 basis-0` takes leftover column space
// instead of content height (which is ~0 for an absolutely positioned guest).
export const BROWSER_WEBVIEW_HOST_CLASS = "relative w-full min-h-0 flex-1 basis-0"

export function sizeWebviewToHost(
  host: Pick<Element, "getBoundingClientRect">,
  webview: { style: { width: string; height: string } },
) {
  const box = host.getBoundingClientRect()
  const width = Math.max(1, Math.round(box.width))
  const height = Math.max(1, Math.round(box.height))
  webview.style.width = `${width}px`
  webview.style.height = `${height}px`
  return { width, height }
}
