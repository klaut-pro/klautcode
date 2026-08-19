import { describe, expect, test } from "bun:test"
import { BROWSER_WEBVIEW_HOST_CLASS, sizeWebviewToHost } from "./webview-layout"

describe("BROWSER_WEBVIEW_HOST_CLASS", () => {
  test("takes leftover column space instead of collapsing to content height", () => {
    const classes = BROWSER_WEBVIEW_HOST_CLASS.split(/\s+/)
    expect(classes).toContain("relative")
    expect(classes).toContain("flex-1")
    expect(classes).toContain("basis-0")
    expect(classes).toContain("min-h-0")
    expect(classes).not.toContain("overflow-hidden")
  })
})

describe("sizeWebviewToHost", () => {
  test("copies the host box onto the guest in whole pixels", () => {
    const host = {
      getBoundingClientRect: () =>
        ({ width: 640.4, height: 480.6, x: 0, y: 0, top: 0, left: 0, right: 640.4, bottom: 480.6, toJSON: () => ({}) }) as DOMRect,
    }
    const webview = { style: { width: "", height: "" } }
    expect(sizeWebviewToHost(host, webview)).toEqual({ width: 640, height: 481 })
    expect(webview.style.width).toBe("640px")
    expect(webview.style.height).toBe("481px")
  })

  test("does not emit a 0×0 guest when the host has not laid out yet", () => {
    const host = {
      getBoundingClientRect: () =>
        ({ width: 0, height: 0, x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON: () => ({}) }) as DOMRect,
    }
    const webview = { style: { width: "", height: "" } }
    expect(sizeWebviewToHost(host, webview)).toEqual({ width: 1, height: 1 })
  })
})
