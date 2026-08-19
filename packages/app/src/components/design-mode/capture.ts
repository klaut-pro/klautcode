import { toPng } from "html-to-image"
import type { Platform } from "@/context/platform"
import { drawMarker, drawShape, type DesignStroke } from "./annotation-draw"
import type { DesignCapture, DesignElementAnnotation, DesignElementInfo, DesignProbeResult, DesignShape } from "./types"
import { buildMetadata } from "./types"
import { DESIGN_PROBE_SCRIPT, elementsAtPoint } from "./element-picker"

export async function probeElements(platform: Platform): Promise<DesignProbeResult> {
  if (platform.runProbeScript) {
    const result = (await platform.runProbeScript(DESIGN_PROBE_SCRIPT)) as DesignProbeResult
    if (result && Array.isArray(result.elements)) return result
  }
  const run = new Function(`return ${DESIGN_PROBE_SCRIPT}`) as () => DesignProbeResult
  return run()
}

export async function captureViewport(
  platform: Platform,
  viewport: { width: number; height: number },
): Promise<DesignCapture> {
  if (platform.captureWindow) {
    const { dataUrl, width, height } = await platform.captureWindow()
    return { dataUrl, width, height, scale: width / viewport.width }
  }
  const { dataUrl, width, height } = await captureBrowserViewport(viewport)
  return { dataUrl, width, height, scale: width / viewport.width }
}

async function captureBrowserViewport(viewport: { width: number; height: number }): Promise<{ dataUrl: string; width: number; height: number }> {
  const dpr = window.devicePixelRatio || 1
  const scrollX = window.scrollX
  const scrollY = window.scrollY
  window.scrollTo(0, 0)
  try {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)))
    const dataUrl = await toPng(document.documentElement, {
      pixelRatio: dpr,
      width: viewport.width,
      height: viewport.height,
      canvasWidth: Math.round(viewport.width * dpr),
      canvasHeight: Math.round(viewport.height * dpr),
    })
    return { dataUrl, width: Math.round(viewport.width * dpr), height: Math.round(viewport.height * dpr) }
  } finally {
    window.scrollTo(scrollX, scrollY)
  }
}

export async function compositeDesignCapture(input: {
  capture: DesignCapture
  selection: DesignElementAnnotation[]
  shapes: DesignShape[]
  viewport: { width: number; height: number }
  style: DesignStroke
}): Promise<{ file: File; metadata: string }> {
  const image = await loadImage(input.capture.dataUrl)
  const canvas = document.createElement("canvas")
  canvas.width = input.capture.width
  canvas.height = input.capture.height
  const context = canvas.getContext("2d")
  if (!context) throw new Error("Canvas unavailable")
  context.drawImage(image, 0, 0, input.capture.width, input.capture.height)
  context.save()
  context.scale(input.capture.scale, input.capture.scale)
  for (const shape of input.shapes) drawShape(context, shape, input.style)
  for (const { number, info } of input.selection) {
    drawMarker(context, number, { x: info.center.x, y: info.center.y })
  }
  context.restore()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
  if (!blob) throw new Error("Export failed")
  const file = new File([blob], "design-mode.png", { type: "image/png" })
  const metadata = JSON.stringify(buildMetadata(input.selection, input.shapes, input.viewport))
  return { file, metadata }
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("Capture image failed to load"))
    image.src = dataUrl
  })
}

export function pickElements(elements: DesignElementInfo[], point: { x: number; y: number }, ancestor = false): DesignElementInfo[] {
  const at = elementsAtPoint(elements, point)
  if (at.length === 0) return []
  return ancestor ? at : [at[0]]
}

export function nextAncestor(elements: DesignElementInfo[], point: { x: number; y: number }, currentIndex: number): DesignElementInfo | undefined {
  const at = elementsAtPoint(elements, point)
  const current = at.findIndex((element) => element.index === currentIndex)
  if (current === -1) return at[0]
  return at[(current + 1) % at.length]
}