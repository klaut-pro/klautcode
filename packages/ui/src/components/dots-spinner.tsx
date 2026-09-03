import type { ComponentProps } from "solid-js"

export function DotsSpinner(props: {
  class?: string
  classList?: ComponentProps<"span">["classList"]
  style?: ComponentProps<"span">["style"]
}) {
  return (
    <span
      data-component="dots-spinner"
      aria-hidden="true"
      classList={{
        ...props.classList,
        [props.class ?? ""]: !!props.class,
      }}
      style={props.style}
    >
      <span data-slot="dots-spinner-dot" />
      <span data-slot="dots-spinner-dot" />
      <span data-slot="dots-spinner-dot" />
      <span data-slot="dots-spinner-dot" />
      <span data-slot="dots-spinner-dot" />
      <span data-slot="dots-spinner-dot" />
    </span>
  )
}
