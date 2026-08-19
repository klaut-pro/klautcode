import { describe, expect, test } from "bun:test"
import { DESIGN_PROBE_SCRIPT, elementsAtPoint } from "./element-picker"
import type { DesignElementInfo } from "./types"

const elements: DesignElementInfo[] = [
  {
    index: 0,
    tag: "section",
    selector: "section.sidebar",
    path: [],
    x: 0,
    y: 0,
    width: 400,
    height: 800,
    center: { x: 200, y: 400 },
  },
  {
    index: 1,
    tag: "button",
    selector: "button.send",
    path: ["section"],
    x: 100,
    y: 300,
    width: 120,
    height: 40,
    center: { x: 160, y: 320 },
  },
]

describe("elementsAtPoint", () => {
  test("returns elements containing the point ordered by area ascending", () => {
    const at = elementsAtPoint(elements, { x: 150, y: 310 })
    expect(at.map((element) => element.index)).toEqual([1, 0])
  })

  test("returns an empty array when nothing contains the point", () => {
    expect(elementsAtPoint(elements, { x: 500, y: 500 })).toEqual([])
  })
})

describe("DESIGN_PROBE_SCRIPT", () => {
  test("runs against a minimal DOM and returns viewport plus collected elements", () => {
    Element.prototype.getBoundingClientRect = function () {
      const style = (this as HTMLElement).style
      const x = Number.parseFloat(style.left) || 0
      const y = Number.parseFloat(style.top) || 0
      const w = Number.parseFloat(style.width) || 100
      const h = Number.parseFloat(style.height) || 40
      return { x, y, left: x, top: y, right: x + w, bottom: y + h, width: w, height: h, toJSON: () => ({}) } as DOMRect
    }
    document.body.innerHTML = `
      <nav id="nav" style="position:absolute;left:0;top:0;width:300px;height:60px"><a href="#">Home</a></nav>
      <button data-action="send" style="position:absolute;left:20px;top:20px;width:100px;height:40px">Send</button>
    `
    const run = new Function(`return ${DESIGN_PROBE_SCRIPT}`) as () => { viewport: { width: number; height: number; dpr: number }; elements: unknown[] }
    const result = run()
    expect(result.viewport).toBeDefined()
    expect(result.elements.length).toBeGreaterThan(0)
    const tags = result.elements.map((element) => (element as { tag: string }).tag)
    expect(tags).toContain("button")
  })
})