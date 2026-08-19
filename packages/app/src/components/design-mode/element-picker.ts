import type { DesignElementInfo, DesignProbeResult } from "./types"

export const DESIGN_PROBE_SCRIPT = `(() => {
  const SIZE = 6
  const MAX_PATH = 5
  const STYLE_KEYS = [
    "display", "position", "background-color", "color", "font-size", "font-weight", "font-family",
    "padding", "margin", "border-radius", "gap", "align-items", "justify-content", "opacity",
  ]
  const viewport = { width: window.innerWidth || 0, height: window.innerHeight || 0, dpr: window.devicePixelRatio || 1 }
  const seen = new Set()
  const candidates = []
  const collect = (root) => {
    const all = root.querySelectorAll ? Array.from(root.querySelectorAll("*")) : []
    for (const el of all) {
      if (seen.has(el)) continue
      seen.add(el)
      const rect = el.getBoundingClientRect()
      if (!rect || rect.width < SIZE || rect.height < SIZE) continue
      if (rect.bottom < 0 || rect.right < 0 || rect.top > viewport.height || rect.left > viewport.width) continue
      const style = window.getComputedStyle(el)
      if (style.display === "none" || style.visibility === "hidden") continue
      if (style.opacity === "0") continue
      const tag = el.tagName ? el.tagName.toLowerCase() : ""
      const id = el.id ? String(el.id) : undefined
      const className =
        typeof el.className === "string" && el.className.trim()
          ? el.className.trim().split(/\\s+/).slice(0, 3).join(".")
          : undefined
      const role = el.getAttribute ? el.getAttribute("role") || undefined : undefined
      const label = el.getAttribute ? el.getAttribute("aria-label") || undefined : undefined
      const text = el.textContent ? el.textContent.trim().replace(/\\s+/g, " ").slice(0, 100) : undefined
      const styles = {}
      for (const key of STYLE_KEYS) styles[key] = style.getPropertyValue(key) || undefined
      candidates.push({ el, rect, info: {
        index: 0,
        tag,
        id,
        className,
        role,
        label,
        text,
        styles,
        selector: "",
        path: [],
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        center: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
      } })
    }
  }
  collect(document.body || document.documentElement)
  const shortSelector = (el) => {
    let out = (el.tagName ? el.tagName.toLowerCase() : "div")
    if (el.id) out += "#" + el.id
    if (typeof el.className === "string" && el.className.trim()) {
      const classes = el.className.trim().split(/\\s+/).slice(0, 3).join(".")
      if (classes) out += "." + classes
    }
    return out
  }
  const result = []
  for (let i = 0; i < candidates.length; i++) {
    const entry = candidates[i]
    const el = entry.el
    const path = []
    let node = el.parentElement
    while (node && node !== document.body && node !== document.documentElement && path.length < MAX_PATH - 1) {
      path.push(shortSelector(node))
      node = node.parentElement
    }
    const info = entry.info
    info.index = i
    info.selector = shortSelector(el)
    info.path = path
    result.push(info)
  }
  return { viewport, elements: result }
})()`

export function runDesignProbe(capture: (script: string) => Promise<unknown>): Promise<DesignProbeResult> {
  return capture(DESIGN_PROBE_SCRIPT).then((value) => value as DesignProbeResult)
}

export function elementsAtPoint(elements: DesignElementInfo[], point: { x: number; y: number }): DesignElementInfo[] {
  return elements
    .filter((element) => point.x >= element.x && point.x <= element.x + element.width && point.y >= element.y && point.y <= element.y + element.height)
    .sort((a, b) => a.width * a.height - b.width * b.height)
}