import { describe, expect, test } from "bun:test"
import { computeContainLayout, mapRect } from "./types"

const css = await Bun.file(new URL("./design-mode.css", import.meta.url)).text()
const overlay = await Bun.file(new URL("./overlay.tsx", import.meta.url)).text()
const controller = await Bun.file(new URL("./controller.tsx", import.meta.url)).text()
const prompt = await Bun.file(new URL("../prompt-input-v2.tsx", import.meta.url)).text()
const submit = await Bun.file(new URL("../prompt-input/submit.ts", import.meta.url)).text()
const button = await Bun.file(new URL("./button.tsx", import.meta.url)).text()
const panel = await Bun.file(new URL("../../pages/session/session-side-panel.tsx", import.meta.url)).text()

describe("design-mode overlay stays in the browser pane", () => {
  test("contained overlay is absolutely pinned to the webview host", () => {
    expect(css).toContain('[data-component="design-mode"].dm-contained')
    expect(css).toMatch(/\.dm-contained\s*\{[^}]*position:\s*absolute/)
    expect(css).toMatch(/\.dm-contained\s*\{[^}]*inset:\s*0/)
    expect(css).toMatch(/\.dm-contained\s*\{[^}]*overflow:\s*hidden/)
  })

  test("the live webview is hidden only while design mode is on", () => {
    expect(css).toContain('html[data-design-mode] [data-component="browser-webview"] webview')
    expect(css).toMatch(/visibility:\s*hidden/)
  })

  test("overlay mounts into the browser host and marks html for the hide rule", () => {
    expect(overlay).toContain('document.querySelector("[data-component=browser-webview]")')
    expect(overlay).toContain('document.documentElement.setAttribute("data-design-mode"')
    expect(overlay).toContain('classList={{ "dm-contained": !!host() }}')
    expect(overlay).toContain("mount={host() ?? document.body}")
  })

  test("mapped capture rects stay inside the host box (no breakout to window origin)", () => {
    const host = { width: 800, height: 600 }
    const capture = { width: 1600, height: 900 }
    const layout = computeContainLayout(capture.width, capture.height, host.width, host.height)
    const painted = mapRect({ x: 0, y: 0, width: capture.width, height: capture.height }, layout)
    expect(painted.x).toBeGreaterThanOrEqual(0)
    expect(painted.y).toBeGreaterThanOrEqual(0)
    expect(painted.x + painted.width).toBeLessThanOrEqual(host.width + 0.01)
    expect(painted.y + painted.height).toBeLessThanOrEqual(host.height + 0.01)
  })

  test("the files tab stack is a full-height column so the pane can flex-fill", () => {
    expect(panel).toContain('class="flex h-full min-h-0 flex-col"')
    expect(panel).toContain("flex min-h-0 flex-1 flex-col overflow-hidden")
  })
})

describe("design-mode chrome", () => {
  test("does not render the bottom hint bar", () => {
    expect(overlay).not.toContain("dm-footer")
    expect(overlay).not.toContain("designMode.hint.main")
    expect(css).not.toContain(".dm-footer")
  })

  test("Escape exits design mode", () => {
    expect(overlay).toMatch(/event\.key === "Escape"[\s\S]*design\.exit\(\)/)
  })

  test("Enter attaches annotations and submits the prompt", () => {
    expect(overlay).toContain("design.setFlushHandler(() => addToChat())")
    expect(overlay).toMatch(/event\.key === "Enter"[\s\S]*design\.submit\(\)/)
    expect(overlay).toMatch(/commitNote\(info\.index\)[\s\S]*design\.submit\(\)/)
    expect(overlay).toContain("design.setPendingMetadata(result.metadata)")
    expect(overlay).toContain("await attach(result.file)")
    expect(controller).toContain("if (store.active) await store.flush?.()")
    expect(controller).not.toMatch(/exit: \(\) =>\s*setStore\(\{[^}]*pendingMetadata: undefined/)
    expect(prompt).toContain("if (design.active()) await design.flush()")
    expect(prompt).toContain("design.setSubmitHandler(() => submission.handleSubmit(new Event(\"submit\")))")
    expect(submit.indexOf("if (input.working()) void abort()")).toBeLessThan(submit.indexOf("const designMetadata = input.designMetadata?.()"))
  })

  test("handler functions are stored as values, never invoked by setStore", () => {
    expect(controller).toContain('setStore("attach", () => attach)')
    expect(controller).toContain('setStore("flush", () => flush)')
    expect(controller).toContain('setStore("submit", () => submit)')
    expect(controller).not.toMatch(/setAttachHandler: \(attach\) => setStore\("attach", attach\)/)
    expect(controller).not.toMatch(/setFlushHandler: \(flush\) => setStore\("flush", flush\)/)
    expect(controller).not.toMatch(/setSubmitHandler: \(submit\) => setStore\("submit", submit\)/)
  })

  test("the pencil button toggles design mode and uses the theme accent when on", () => {
    expect(button).toContain("if (design.active()) design.exit()")
    expect(button).toContain("void design.enter()")
    expect(button).toContain('classList={{ "dm-toggle-active": design.active() }}')
    expect(css).toContain("[data-action=\"prompt-design-mode\"].dm-toggle-active")
    expect(css).toContain("var(--v2-icon-icon-accent)")
  })

  test("uses the Lucide pencil tip, not the old triangle marker", () => {
    expect(button).toContain("M21.174 6.812")
    expect(button).not.toContain("M1.2 1.2 L13 3.4 L3.4 13 Z")
  })
})
