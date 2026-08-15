import { createSignal, onCleanup, onMount, Show, type JSXElement } from "solid-js"
import type { RGBA } from "@opentui/core"
import { tint, useTheme } from "../context/theme"
import { useKV } from "../context/kv"

const TICK = 130

// A compact, 1-row thinking-orb indicator for loading states (KLA-12). The
// lit dot orbits a small ring with a fading tail, mirroring the full
// ThinkingOrbs look without the 9x7 grid footprint so it fits inline next to
// status text.
export function MiniOrbs(props: { color?: RGBA }) {
  const { theme, mode } = useTheme()
  const kv = useKV()
  const [tick, setTick] = createSignal(0)

  onMount(() => {
    const timer = setInterval(() => setTick((t) => t + 1), TICK)
    onCleanup(() => clearInterval(timer))
  })

  const color = () => props.color ?? theme.accent
  // Trail dots keep more of the accent in light mode so they don't wash out.
  const base = () => tint(theme.background, color(), mode() === "dark" ? 0.4 : 0.55)

  const renderDots = () => {
    const t = tick()
    const cells: JSXElement[] = []
    for (let i = 0; i < 4; i++) {
      // Head dot at position 0; each following dot trails by one tick.
      const offset = ((t - i) % 4 + 4) % 4
      cells.push(<text fg={offset === 0 ? color() : base()} selectable={false}>{offset === 0 ? "●" : "·"}</text>)
    }
    return cells
  }

  return (
    <Show when={kv.get("animations_enabled", true)} fallback={<text fg={color()}>● ● ●</text>}>
      <box flexDirection="row">{renderDots()}</box>
    </Show>
  )
}
