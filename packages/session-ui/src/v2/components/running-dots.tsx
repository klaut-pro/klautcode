import { splitProps, type ComponentProps } from "solid-js"
import "./running-dots.css"

// Handoff 6×6 — same Li as session-progress-indicator-v2
// Grid 6, 22 on indices: 0,1,4,5,6,7,10,11,12,13,18,19,22,23,24,25,26,27,28,29,30,31,32,33,34,35
// CalmGlow brightness-only, pixels stay put.
const ON = new Set([0, 1, 4, 5, 6, 7, 10, 11, 12, 13, 18, 19, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35])
const DOTS = Array.from({ length: 36 }, (_, index) => index)

// 6×6 Li matrix used in top tab, project sidebar, and subagent dock.
// Sized to 16px slot; CSS grid replicates the 16×16 viewBox (gap 1, dot ~1.83px).
// DOM/CSS based so it inherits currentColor, like before but now 6×6.
export function RunningDots(props: ComponentProps<"span">) {
  const [local, rest] = splitProps(props, ["class", "classList"])
  return (
    <span
      {...rest}
      data-component="running-dots"
      class={local.class}
      classList={local.classList}
      role="img"
      aria-hidden="true"
    >
      {DOTS.map((index) => (
        <span data-dot={index} data-on={ON.has(index) ? "" : undefined} classList={{ on: ON.has(index) }} />
      ))}
    </span>
  )
}
