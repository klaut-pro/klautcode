import { For, splitProps, type ComponentProps } from "solid-js"
import "./session-progress-indicator-v2.css"

// Handoff 6×6 — drawn in studio at http://localhost:4567/logo-studio.html
// Grid 6, dots = 22 true indices from handoff: 0,1,4,5,6,7,10,11,12,13,18,19,22,23,24,25,26,27,28,29,30,31,32,33,34,35
// Uses calmGlow (brightness-only, calming) as selected: pixels stay in place.
// Backup of 4×4 Li kept in /tmp/before-handoff.*
const grid = 6
const gap = 1
const origin = 0.5
const vb = 16
const dot = (vb - 2 * origin - (grid - 1) * gap) / grid // 1.666...
const dots = Array.from({ length: grid * grid }, (_, index) => ({
  index,
  x: origin + (index % grid) * (dot + gap),
  y: origin + Math.floor(index / grid) * (dot + gap),
}))

const ON = new Set([0, 1, 4, 5, 6, 7, 10, 11, 12, 13, 18, 19, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35])

export function SessionProgressIndicatorV2(props: ComponentProps<"svg">) {
  const [local, rest] = splitProps(props, ["class", "classList", "width", "height"])
  return (
    <svg
      {...rest}
      class={local.class}
      classList={local.classList}
      width={local.width ?? 16}
      height={local.height ?? 16}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      data-component="session-progress-indicator-v2"
      aria-hidden={rest["aria-hidden"] ?? "true"}
    >
      <For each={dots}>
        {(cell) => (
          <rect
            data-dot={cell.index}
            data-on={ON.has(cell.index) ? "" : undefined}
            x={cell.x}
            y={cell.y}
            width={dot}
            height={dot}
            rx={0.5}
            classList={{ on: ON.has(cell.index) }}
          />
        )}
      </For>
    </svg>
  )
}
