import { describe, expect, test } from "bun:test"
import {
  buildMetadata,
  computeContainLayout,
  mapPoint,
  mapRect,
  normalizeRect,
  simplifyPoints,
  type DesignElementInfo,
  type DesignShape,
} from "./types"

describe("computeContainLayout", () => {
  test("fits a 4:3 source into a 16:9 target with side letterboxing", () => {
    const layout = computeContainLayout(400, 300, 1600, 900)
    expect(layout.scale).toBe(3)
    expect(layout.offsetX).toBe(200)
    expect(layout.offsetY).toBe(0)
  })

  test("fits a 16:9 source into a 4:3 target with top/bottom letterboxing", () => {
    const layout = computeContainLayout(1600, 900, 400, 300)
    expect(layout.scale).toBeCloseTo(0.25)
    expect(layout.offsetX).toBe(0)
    expect(layout.offsetY).toBeCloseTo(37.5)
  })
})

describe("coordinate mapping", () => {
  const layout = computeContainLayout(1000, 500, 2000, 1000)

  test("maps points through the layout", () => {
    expect(mapPoint({ x: 100, y: 50 }, layout)).toEqual({ x: 200, y: 100 })
  })

  test("maps rects through the layout", () => {
    expect(mapRect({ x: 10, y: 20, width: 100, height: 50 }, layout)).toEqual({
      x: 20,
      y: 40,
      width: 200,
      height: 100,
    })
  })
})

describe("normalizeRect", () => {
  test("normalizes a drag from bottom-right to top-left", () => {
    expect(normalizeRect({ x: 200, y: 150 }, { x: 40, y: 30 })).toEqual({ x: 40, y: 30, width: 160, height: 120 })
  })
})

describe("simplifyPoints", () => {
  test("keeps endpoints and removes collinear points", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0.1 },
      { x: 20, y: 0 },
      { x: 30, y: 30 },
    ]
    const simplified = simplifyPoints(points, 1)
    expect(simplified).toHaveLength(3)
    expect(simplified[0]).toEqual({ x: 0, y: 0 })
    expect(simplified[simplified.length - 1]).toEqual({ x: 30, y: 30 })
  })

  test("keeps two points as-is", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ]
    expect(simplifyPoints(points, 0.5)).toEqual(points)
  })
})

describe("buildMetadata", () => {
  test("emits a design-mode discriminator, numbered elements, and annotations", () => {
    const info: DesignElementInfo = {
      index: 3,
      tag: "button",
      id: "send",
      className: "primary",
      text: "Send",
      selector: "button#send.primary",
      path: ["form", "body"],
      x: 10,
      y: 20,
      width: 100,
      height: 40,
      center: { x: 60, y: 40 },
    }
    const shapes: DesignShape[] = [{ type: "rect", x: 0, y: 0, width: 50, height: 50 }]
    const metadata = buildMetadata([{ number: 1, info }], shapes, { width: 1200, height: 800 })

    expect(metadata).toMatchObject({
      type: "design-mode",
      viewport: { width: 1200, height: 800 },
      elements: [{ number: 1, selector: "button#send.primary", path: ["form", "body"], tag: "button", center: { x: 60, y: 40 } }],
      annotations: shapes,
    })
  })

  test("emits per-element notes and computed styles", () => {
    const info: DesignElementInfo = {
      index: 0,
      tag: "button",
      selector: "button.send",
      path: [],
      text: "Send",
      styles: { "background-color": "rgb(10, 132, 255)", "font-size": "14px" },
      x: 0,
      y: 0,
      width: 100,
      height: 40,
      center: { x: 50, y: 20 },
    }
    const metadata = buildMetadata([{ number: 1, info, note: "Make this bigger" }], [], { width: 800, height: 600 })

    expect(metadata.elements[0]).toMatchObject({
      number: 1,
      note: "Make this bigger",
      styles: { "background-color": "rgb(10, 132, 255)", "font-size": "14px" },
    })
  })
})