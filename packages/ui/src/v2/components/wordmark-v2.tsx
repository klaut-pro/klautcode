import { For, createUniqueId, type ComponentProps } from "solid-js"

const LETTERS: Array<{ x: number; d: string }> = [
  {
    x: 0,
    d: "M0 18H18V110H0ZM30.73 76.73L76.73 30.73L51.27 5.27L5.27 51.27ZM5.27 76.73L51.27 122.73L76.73 97.27L30.73 51.27Z",
  },
  {
    x: 80,
    d: "M0 18H18V110H0ZM0 92H50V110H0Z",
  },
  {
    x: 160,
    d: "M27.51 114.19L49.51 22.19L14.49 13.81L-7.51 105.81ZM71.51 105.81L49.51 13.81L14.49 22.19L36.49 114.19ZM14 54H50V72H14Z",
  },
  {
    x: 240,
    d: "M0 18H18V90H0ZM46 18H64V90H46ZM0 92H64V110H0Z",
  },
  {
    x: 320,
    d: "M0 18H64V36H0ZM23 18H41V110H23Z",
  },
  {
    x: 400,
    d: "M0 18H64V36H0ZM0 92H64V110H0ZM0 18H18V110H0Z",
  },
  {
    x: 480,
    d: "M64 18H0V110H64V18ZM18 36H46V92H18Z",
  },
  {
    x: 560,
    d: "M64 18H0V110H64V18ZM20 36H48V92H20Z",
  },
  {
    x: 640,
    d: "M0 18H18V110H0ZM0 18H64V36H0ZM0 92H64V110H0ZM0 54H50V72H0Z",
  },
]

export function WordmarkV2(props: Pick<ComponentProps<"svg">, "class">) {
  const mask = createUniqueId()
  const maskGradient = createUniqueId()

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 720 129"
      fill="none"
      classList={{ [props.class ?? ""]: !!props.class }}
    >
      <g opacity="0.6">
        <g mask={`url(#${mask})`}>
          <g opacity="0.16">
            <For each={LETTERS}>
              {(letter) => (
                <path
                  opacity="0.7"
                  transform={`translate(${letter.x} 0)`}
                  d={letter.d}
                  fill="currentColor"
                  fill-rule="evenodd"
                />
              )}
            </For>
          </g>
        </g>
      </g>
      <defs>
        <mask id={mask} style="mask-type:alpha" maskUnits="userSpaceOnUse" x="0" y="0" width="720" height="129">
          <rect width="720" height="129" fill={`url(#${maskGradient})`} />
        </mask>
        <linearGradient id={maskGradient} x1="360" y1="68" x2="360" y2="129" gradientUnits="userSpaceOnUse">
          <stop stop-color="white" stop-opacity="0.7" />
          <stop offset="1" stop-color="white" stop-opacity="0" />
        </linearGradient>
      </defs>
    </svg>
  )
}
