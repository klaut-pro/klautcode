import { createSignal, onCleanup, onMount, Show, type JSXElement } from "solid-js"
import type { RGBA } from "@opentui/core"
import { tint, useTheme } from "../context/theme"
import { useKV } from "../context/kv"

const ORB_COUNT = 3
const TICK = 80
const GRID_W = 9
const GRID_H = 7

// A dense, filled circle of dots. The whole disc is made of "·" so the orb
// reads as a textured ball; a bright "●" travels along the rim (rotating) and
// the disc subtly breathes via the `pulse` radius. Each orb has its own phase
// so the three orbs swirl together rather than in lockstep.
function orbRows(tick: number, index: number, lit: RGBA, base: RGBA) {
  const cx = (GRID_W - 1) / 2
  const cy = (GRID_H - 1) / 2
  const maxR = Math.min(GRID_W, GRID_H) / 2 - 0.5
  const pulse = Math.sin(tick * 0.22 + index) * 0.35
  const r = maxR + pulse

  const rimA = tick * 0.5 + (index * Math.PI * 2) / ORB_COUNT
  const rimR = r - 0.8
  const rimX = Math.round(cx + Math.cos(rimA) * rimR)
  const rimY = Math.round(cy + Math.sin(rimA) * rimR)

  const rows: JSXElement[] = []
  for (let y = 0; y < GRID_H; y++) {
    const cells: JSXElement[] = []
    for (let x = 0; x < GRID_W; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
      if (dist > r + 0.3) {
        cells.push(<text selectable={false}> </text>)
        continue
      }
      // Rim dots are brighter than the interior for a glowing edge.
      const onRim = dist > r - 1.4
      if (x === rimX && y === rimY) {
        cells.push(<text fg={lit} selectable={false}>●</text>)
      } else {
        cells.push(<text fg={onRim ? lit : base} selectable={false}>·</text>)
      }
    }
    rows.push(<box flexDirection="row">{cells}</box>)
  }
  return rows
}

export function ThinkingOrbs() {
  const { theme } = useTheme()
  const kv = useKV()
  const [tick, setTick] = createSignal(0)

  onMount(() => {
    const timer = setInterval(() => setTick((t) => t + 1), TICK)
    onCleanup(() => clearInterval(timer))
  })

  const colors: RGBA[] = [theme.primary, theme.accent, theme.textMuted]

  const renderOrb = (index: number) => {
    const lit = colors[index]
    const base = tint(theme.background, lit, 0.28)
    return (
      <box flexDirection="column" alignItems="center" paddingLeft={1} paddingRight={1}>
        {orbRows(tick(), index, lit, base)}
      </box>
    )
  }

  return (
    <Show when={kv.get("animations_enabled", true)} fallback={<text fg={theme.textMuted}>● ● ●</text>}>
      <box flexDirection="row" justifyContent="center" alignItems="center">
        {[0, 1, 2].map((i) => renderOrb(i))}
      </box>
    </Show>
  )
}
