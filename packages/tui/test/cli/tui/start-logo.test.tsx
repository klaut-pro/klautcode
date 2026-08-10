/** @jsxImportSource @opentui/solid */
import { testRender } from "@opentui/solid"
import { describe, expect, test } from "bun:test"
import type { JSX } from "solid-js"
import { DottedWordmark } from "../../../src/component/dotted-wordmark"
import { ThinkingOrbs } from "../../../src/component/thinking-orbs"
import { MiniOrbs } from "../../../src/component/mini-orbs"
import { TuiConfigProvider } from "../../../src/config"
import { KVProvider } from "../../../src/context/kv"
import { ThemeProvider } from "../../../src/context/theme"
import { createTuiResolvedConfig } from "../../fixture/tui-runtime"
import { TestTuiContexts } from "../../fixture/tui-environment"

function withTheme(component: () => JSX.Element) {
  return (
    <TestTuiContexts>
      <TuiConfigProvider config={createTuiResolvedConfig()}>
        <KVProvider>
          <ThemeProvider mode="dark">{component()}</ThemeProvider>
        </KVProvider>
      </TuiConfigProvider>
    </TestTuiContexts>
  )
}

async function renderSettledFrame(component: () => JSX.Element, width: number, height: number) {
  const app = await testRender(() => withTheme(component), { width, height })
  try {
    await app.renderOnce()
    await new Promise((resolve) => setTimeout(resolve, 25))
    await app.renderOnce()
    return await app.captureCharFrame()
  } finally {
    app.renderer.destroy()
  }
}

describe("DottedWordmark", () => {
  test("renders klautcode as a dense dot matrix", async () => {
    const frame = await renderSettledFrame(() => <DottedWordmark />, 80, 12)
    expect(frame).toContain("·")
    const dotRows = frame.split("\n").filter((line) => line.includes("·"))
    expect(dotRows.length).toBeGreaterThanOrEqual(7)
  })
})

describe("ThinkingOrbs", () => {
  test("renders orb dots when animations enabled", async () => {
    const frame = await renderSettledFrame(() => <ThinkingOrbs />, 60, 12)
    expect(frame).toContain("·")
    expect(frame).toContain("●")
  })
})

describe("MiniOrbs", () => {
  test("renders compact orb dots when animations enabled", async () => {
    const frame = await renderSettledFrame(() => <MiniOrbs />, 20, 3)
    expect(frame).toContain("·")
    expect(frame).toContain("●")
  })
})
