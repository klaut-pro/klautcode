import getStroke from "perfect-freehand"
import type { DesignPoint, DesignRect, DesignShape } from "./types"
import { simplifyPoints } from "./types"

export type DesignStroke = {
  color: string
  width: number
  dim: boolean
}

export const MARKER_COLOR = "#0A84FF"
export const MARKER_RADIUS = 16

function applyDim(context: CanvasRenderingContext2D, style: DesignStroke) {
  if (style.dim) context.globalAlpha = 0.35
}

export function drawMarker(context: CanvasRenderingContext2D, number: number, point: DesignPoint) {
  context.save()
  context.beginPath()
  context.arc(point.x, point.y, MARKER_RADIUS, 0, Math.PI * 2)
  context.fillStyle = MARKER_COLOR
  context.shadowColor = "rgba(0,0,0,0.4)"
  context.shadowBlur = 6
  context.fill()
  context.shadowBlur = 0
  context.strokeStyle = "#FFFFFF"
  context.lineWidth = 2
  context.stroke()
  context.fillStyle = "#FFFFFF"
  context.font = "bold 17px system-ui, -apple-system, sans-serif"
  context.textAlign = "center"
  context.textBaseline = "middle"
  context.fillText(String(number), point.x, point.y + 1)
  context.restore()
}

function drawRect(context: CanvasRenderingContext2D, rect: DesignRect, style: DesignStroke) {
  context.save()
  applyDim(context, style)
  context.beginPath()
  context.rect(rect.x, rect.y, rect.width, rect.height)
  context.strokeStyle = style.color
  context.lineWidth = style.width
  context.stroke()
  context.restore()
}

function drawCircle(context: CanvasRenderingContext2D, rect: DesignRect, style: DesignStroke) {
  context.save()
  applyDim(context, style)
  context.beginPath()
  context.ellipse(rect.x + rect.width / 2, rect.y + rect.height / 2, Math.abs(rect.width / 2), Math.abs(rect.height / 2), 0, 0, Math.PI * 2)
  context.strokeStyle = style.color
  context.lineWidth = style.width
  context.stroke()
  context.restore()
}

function drawArrow(context: CanvasRenderingContext2D, from: DesignPoint, to: DesignPoint, style: DesignStroke) {
  context.save()
  applyDim(context, style)
  const angle = Math.atan2(to.y - from.y, to.x - from.x)
  const head = Math.max(10, style.width * 2.5)
  const back = { x: to.x - Math.cos(angle) * head, y: to.y - Math.sin(angle) * head }
  const spread = Math.max(4, head * 0.5)
  const a = { x: to.x - Math.cos(angle - 0.5) * head, y: to.y - Math.sin(angle - 0.5) * head }
  const b = { x: to.x - Math.cos(angle + 0.5) * head, y: to.y - Math.sin(angle + 0.5) * head }
  const tip = { x: to.x + Math.cos(angle) * head * 0.2, y: to.y + Math.sin(angle) * head * 0.2 }
  const outline = [{ x: from.x - Math.cos(angle) * spread, y: from.y - Math.sin(angle) * spread }, a, tip, b, { x: back.x - Math.cos(angle) * spread, y: back.y - Math.sin(angle) * spread }]
  context.beginPath()
  context.moveTo(outline[0].x, outline[0].y)
  for (const point of outline.slice(1)) context.lineTo(point.x, point.y)
  context.closePath()
  context.fillStyle = style.color
  context.fill()
  context.restore()
}

function drawFreehand(context: CanvasRenderingContext2D, points: DesignPoint[], style: DesignStroke) {
  const simplified = simplifyPoints(points, 0.5)
  if (simplified.length < 2) {
    drawMarkerDot(context, simplified[0] ?? points[0] ?? { x: 0, y: 0 }, style)
    return
  }
  const outline = getStroke(
    simplified.map((point) => [point.x, point.y, 0.5] as [number, number, number]),
    { size: style.width, thinning: 0.5, smoothing: 0.5, streamline: 0.5, simulatePressure: true, last: true },
  )
  if (outline.length === 0) return
  context.save()
  applyDim(context, style)
  context.beginPath()
  context.moveTo(outline[0][0], outline[0][1])
  for (let i = 1; i < outline.length; i++) context.lineTo(outline[i][0], outline[i][1])
  context.closePath()
  context.fillStyle = style.color
  context.fill()
  context.restore()
}

function drawMarkerDot(context: CanvasRenderingContext2D, point: DesignPoint, style: DesignStroke) {
  context.save()
  applyDim(context, style)
  context.beginPath()
  context.arc(point.x, point.y, style.width / 2, 0, Math.PI * 2)
  context.fillStyle = style.color
  context.fill()
  context.restore()
}

function drawText(context: CanvasRenderingContext2D, point: DesignPoint, content: string, style: DesignStroke) {
  context.save()
  applyDim(context, style)
  const lines = content.split("\n").slice(0, 8)
  const lineHeight = style.width * 2 + 6
  context.font = `bold ${style.width * 2 + 6}px system-ui, -apple-system, sans-serif`
  context.textAlign = "left"
  context.textBaseline = "top"
  context.lineJoin = "round"
  context.lineWidth = Math.max(3, style.width * 0.9)
  context.strokeStyle = "#FFFFFF"
  for (let i = 0; i < lines.length; i++) {
    context.strokeText(lines[i], point.x, point.y + i * lineHeight)
  }
  context.fillStyle = style.color
  for (let i = 0; i < lines.length; i++) {
    context.fillText(lines[i], point.x, point.y + i * lineHeight)
  }
  context.restore()
}

export function drawShape(context: CanvasRenderingContext2D, shape: DesignShape, style: DesignStroke) {
  if (shape.type === "rect") drawRect(context, shape, style)
  else if (shape.type === "circle") drawCircle(context, shape, style)
  else if (shape.type === "arrow") drawArrow(context, shape.from, shape.to, style)
  else if (shape.type === "freehand") drawFreehand(context, shape.points, style)
  else if (shape.type === "text") drawText(context, shape, shape.content, style)
}