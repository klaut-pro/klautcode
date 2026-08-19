import { splitProps, type ComponentProps } from "solid-js"
import "./running-dots.css"

const DOTS = Array.from({ length: 9 }, (_, index) => index)

// A compact 3x3 matrix of pulsing square dots used to indicate running agents.
// DOM/CSS based so it always renders with the current text color, unlike a
// canvas. Reused in the top tab, the project sidebar, and the subagent dock.
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
        <span data-dot={index} />
      ))}
    </span>
  )
}
