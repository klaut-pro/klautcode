import { onCleanup, onMount, splitProps, type ComponentProps } from "solid-js"
import "./thinking-orbs.css"

// "Thinking Orbs" — the `working`/orbits state from orbs.jakubantalik.com:
// several orbital rings of dots circling a center with fading comet trails.
type Orb = { dots: number; speed: number; radius: number; dotSize: number; phase: number }

const ORBS: Orb[] = [
  { dots: 8, speed: 1, radius: 0.32, dotSize: 0.1, phase: 0 },
  { dots: 8, speed: -1.6, radius: 0.62, dotSize: 0.09, phase: Math.PI / 6 },
  { dots: 8, speed: 2.2, radius: 0.88, dotSize: 0.08, phase: Math.PI / 3 },
]
const TRAIL = 22

export function ThinkingOrbs(props: ComponentProps<"canvas"> & { paused?: boolean }) {
  const [local, rest] = splitProps(props, ["class", "classList", "width", "height", "paused"])
  let ref: HTMLCanvasElement | undefined
  let frame = 0
  let reduced = false

  const reducedMotion = () =>
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches

  onMount(() => {
    const canvas = ref
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    reduced = reducedMotion()
    const dpr = typeof devicePixelRatio === "number" ? devicePixelRatio : 1
    const size = () => Number(local.width ?? 16)

    const resize = () => {
      const s = size()
      canvas.width = s * dpr
      canvas.height = s * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : undefined
    observer?.observe(canvas)

    const draw = (time: number) => {
      frame = requestAnimationFrame(draw)
      if (local.paused) return
      const s = size()
      if (s === 0) return
      ctx.clearRect(0, 0, s, s)
      const cx = s / 2
      const cy = s / 2
      const t = time / 1000

      for (const orb of ORBS) {
        for (let i = 0; i < orb.dots; i++) {
          const base = orb.phase + (i / orb.dots) * Math.PI * 2 + t * orb.speed
          const r = orb.radius * s
          const rDot = orb.dotSize * s
          for (let k = reduced ? 0 : TRAIL; k >= 0; k--) {
            const a = reduced ? base : base - k * 0.085
            const radius = reduced ? rDot : Math.max(0.4, rDot * (1 - k * 0.03))
            ctx.globalAlpha = reduced ? 0.85 : Math.max(0.06, 1 - k / TRAIL) * 0.9
            ctx.fillStyle = "currentColor"
            ctx.beginPath()
            ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, radius, 0, Math.PI * 2)
            ctx.fill()
          }
        }
      }
      ctx.globalAlpha = 1
    }
    frame = requestAnimationFrame(draw)

    onCleanup(() => {
      cancelAnimationFrame(frame)
      observer?.disconnect()
    })
  })

  return (
    <canvas
      ref={(el) => {
        ref = el
      }}
      data-component="thinking-orbs"
      role="img"
      class={local.class}
      classList={local.classList}
      style={{ width: `${local.width ?? 16}px`, height: `${local.height ?? 16}px`, color: "currentColor" }}
      {...rest}
    />
  )
}
