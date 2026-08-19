export type DesignTool = "select" | "marker" | "circle" | "rect" | "arrow" | "freehand" | "text"

export const DESIGN_TOOLS: readonly DesignTool[] = ["select", "marker", "circle", "rect", "arrow", "freehand", "text"]

export const DESIGN_TOOL_KEYBINDS: Readonly<Record<string, DesignTool>> = {
  v: "select",
  c: "circle",
  r: "rect",
  a: "arrow",
  f: "freehand",
  t: "text",
  m: "marker",
}

export type DesignPoint = { x: number; y: number }

export type DesignRect = { x: number; y: number; width: number; height: number }

export type DesignElementInfo = {
  index: number
  tag: string
  id?: string
  className?: string
  role?: string
  label?: string
  text?: string
  styles?: Record<string, string | undefined>
  selector: string
  path: string[]
  x: number
  y: number
  width: number
  height: number
  center: DesignPoint
}

export type DesignElementAnnotation = {
  number: number
  info: DesignElementInfo
  note?: string
}

export type DesignProbeResult = {
  viewport: { width: number; height: number; dpr: number }
  elements: DesignElementInfo[]
}

export type DesignCapture = {
  dataUrl: string
  width: number
  height: number
  scale: number
}

export type DesignShape =
  | { type: "circle"; x: number; y: number; width: number; height: number }
  | { type: "rect"; x: number; y: number; width: number; height: number }
  | { type: "arrow"; from: DesignPoint; to: DesignPoint }
  | { type: "freehand"; points: DesignPoint[] }
  | { type: "text"; x: number; y: number; content: string }

export type DesignAnnotation = DesignShape | { type: "marker"; number: number; x: number; y: number }

export type DesignModeMetadata = {
  type: "design-mode"
  viewport: { width: number; height: number }
  elements: {
    number: number
    selector: string
    path: string[]
    tag: string
    text?: string
    note?: string
    styles?: Record<string, string | undefined>
    center: DesignPoint
  }[]
  annotations: DesignShape[]
}

export type ContainLayout = { scale: number; offsetX: number; offsetY: number }

export function computeContainLayout(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number): ContainLayout {
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight)
  return {
    scale,
    offsetX: (targetWidth - sourceWidth * scale) / 2,
    offsetY: (targetHeight - sourceHeight * scale) / 2,
  }
}

export function mapPoint(point: DesignPoint, layout: ContainLayout): DesignPoint {
  return { x: point.x * layout.scale + layout.offsetX, y: point.y * layout.scale + layout.offsetY }
}

export function mapRect(rect: DesignRect, layout: ContainLayout): DesignRect {
  return {
    x: rect.x * layout.scale + layout.offsetX,
    y: rect.y * layout.scale + layout.offsetY,
    width: rect.width * layout.scale,
    height: rect.height * layout.scale,
  }
}

export function rectContains(rect: DesignRect, point: DesignPoint): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height
}

export function rectArea(rect: DesignRect): number {
  return rect.width * rect.height
}

export function shapeBounds(shape: DesignShape): DesignRect {
  if (shape.type === "circle" || shape.type === "rect") return shape
  if (shape.type === "arrow") {
    const x = Math.min(shape.from.x, shape.to.x)
    const y = Math.min(shape.from.y, shape.to.y)
    return { x, y, width: Math.abs(shape.to.x - shape.from.x), height: Math.abs(shape.to.y - shape.from.y) }
  }
  if (shape.type === "freehand") {
    const xs = shape.points.map((point) => point.x)
    const ys = shape.points.map((point) => point.y)
    const x = Math.min(...xs)
    const y = Math.min(...ys)
    return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
  }
  return { x: shape.x, y: shape.y, width: 0, height: 0 }
}

export function shapeCenter(shape: DesignShape): DesignPoint {
  const bounds = shapeBounds(shape)
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
}

export function segmentDistance(a: DesignPoint, b: DesignPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

export function simplifyPoints(points: DesignPoint[], tolerance: number): DesignPoint[] {
  if (points.length <= 2) return points
  const start = points[0]
  const end = points[points.length - 1]
  let maxDistance = 0
  let maxIndex = 0
  for (let i = 1; i < points.length - 1; i++) {
    const distance = pointToSegmentDistance(points[i], start, end)
    if (distance > maxDistance) {
      maxDistance = distance
      maxIndex = i
    }
  }
  if (maxDistance > tolerance) {
    const left = simplifyPoints(points.slice(0, maxIndex + 1), tolerance)
    const right = simplifyPoints(points.slice(maxIndex), tolerance)
    return [...left.slice(0, -1), ...right]
  }
  return [start, end]
}

function pointToSegmentDistance(point: DesignPoint, a: DesignPoint, b: DesignPoint): number {
  const lengthSquared = (b.x - a.x) ** 2 + (b.y - a.y) ** 2
  if (lengthSquared === 0) return segmentDistance(point, a)
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / lengthSquared))
  const projection = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }
  return segmentDistance(point, projection)
}

export function clampRect(rect: DesignRect, width: number, height: number): DesignRect {
  return {
    x: Math.max(0, Math.min(rect.x, width)),
    y: Math.max(0, Math.min(rect.y, height)),
    width: Math.max(1, Math.min(rect.width, width - rect.x)),
    height: Math.max(1, Math.min(rect.height, height - rect.y)),
  }
}

export function normalizeRect(a: DesignPoint, b: DesignPoint): DesignRect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  }
}

export function buildMetadata(selection: DesignElementAnnotation[], shapes: DesignShape[], viewport: { width: number; height: number }): DesignModeMetadata {
  return {
    type: "design-mode",
    viewport,
    elements: selection.map(({ number, info, note }) => ({
      number,
      selector: info.selector,
      path: info.path,
      tag: info.tag,
      text: info.text,
      note,
      styles: info.styles,
      center: info.center,
    })),
    annotations: shapes,
  }
}