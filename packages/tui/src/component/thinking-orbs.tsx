import { createSignal, onCleanup, onMount, Show, type JSXElement } from "solid-js"
import { RGBA } from "@opentui/core"
import { tint, useTheme } from "../context/theme"
import { useKV } from "../context/kv"

const ORB_COUNT = 1
const TICK = 80
// Tuned via the Orb Studio: packages/tui/dev/orb-studio.html. Geometry lives
// in braille SUB-pixel space (2×4 per cell), which is square on screen — a
// terminal cell is ~2:1 tall, so drawing in cell units would stretch the orb.
const GRID_W = 33
const GRID_H = 17
const CELL_W = 2
const CELL_H = 4
const ORBITS = 28
const SEGMENTS = 160
const DEPTH_GAMMA = 2.5
const PULSE = 0.35
const SPEED = 0.3
const YAW_SPEED = 0.045
const TILT = 0.8
// The studio advances its time by `speed` per 60fps frame; scale the TUI's
// per-tick counter (TICK ms) so motion matches what was tuned in the browser.
const TIME_FACTOR = (SPEED * 60 * TICK) / 1000

const WHITE = RGBA.fromInts(255, 255, 255)
const LIT_DARK = RGBA.fromHex("#080808")
const LIT_LIGHT = RGBA.fromHex("#000000")

type OrbPalette = {
  back: RGBA
  front: RGBA
}

type Cell = { bits: number; depth: number }

// Monochrome ink tuned in the Orb Studio. Front dots carry the lit color
// (white-hot in dark mode), rear dots sink toward the background — the same
// depth language as a canvas orb.
function buildPalette(background: RGBA, isDark: boolean): OrbPalette {
  if (isDark) {
    return {
      back: tint(background, LIT_DARK, 0.26),
      front: tint(LIT_DARK, WHITE, 1),
    }
  }
  return {
    back: tint(background, LIT_LIGHT, 0.52),
    front: LIT_LIGHT,
  }
}

// Deterministic hash in [0, 1) — keeps each orb's orbit layout stable between
// frames so the ball reads as a solid, orbiting object.
function hash(a: number, b: number): number {
  const h = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453
  return h - Math.floor(h)
}

// Evenly spread directions on a unit sphere (Fibonacci lattice) so the orbit
// planes tile the ball instead of clumping around one axis.
function fibDir(i: number, n: number): [number, number, number] {
  const golden = Math.PI * (3 - Math.sqrt(5))
  const y = 1 - (2 * (i + 0.5)) / n
  const rad = Math.sqrt(1 - y * y)
  const a = i * golden
  return [rad * Math.cos(a), y, rad * Math.sin(a)]
}

// Shared yaw + tilt + orthographic projection (ported from the thinking-orbs
// engine) so the whole sphere visibly rotates while dots near the viewer come
// forward and rear dots fall back — that rotation is what sells the 3D.
function makeProjector(yaw: number, tilt: number, cx: number, cy: number, scale: number) {
  const st = Math.sin(tilt)
  const ct = Math.cos(tilt)
  const sy = Math.sin(yaw)
  const cyw = Math.cos(yaw)
  return (x: number, y: number, z: number): [number, number, number] => {
    const x1 = x * cyw + z * sy
    const z1 = -x * sy + z * cyw
    const y1 = y * ct - z1 * st
    const z2 = y * st + z1 * ct
    return [cx + x1 * scale, cy - y1 * scale, z2]
  }
}

// One orb: ORBITS tilted orbit rings traced by fine dots, each carrying a
// couple of bright particles. Projected dots land on braille sub-pixels; the
// front-most depth shades each cell, so overlapping rings sort correctly and
// the ball reads as a dense, solid 3D sphere instead of a wireframe tangle.
function orbGrid(tick: number, orbIndex: number): Cell[][] {
  const cells: Cell[][] = Array.from({ length: GRID_H }, () =>
    Array.from({ length: GRID_W }, () => ({ bits: 0, depth: 0 })),
  )
  // Center and radius live in sub-pixel space (2 wide × 4 tall per cell),
  // which is square on screen — a circle here stays round in the terminal.
  const cx = (GRID_W * CELL_W - 1) / 2
  const cy = (GRID_H * CELL_H - 1) / 2
  const maxR = Math.min(GRID_W * CELL_W, GRID_H * CELL_H) / 2 - 0.8
  const t = tick * TIME_FACTOR
  const pulse = Math.sin(t * 0.22 + orbIndex) * PULSE
  const R = maxR + pulse

  const yaw = t * YAW_SPEED + orbIndex * 1.7
  const tilt = TILT
  const project = makeProjector(yaw, tilt, cx, cy, 1)

  const put = (sx: number, sy: number, z: number, depth: number) => {
    const x = Math.round(sx)
    const y = Math.round(sy)
    const cellX = Math.floor(x / CELL_W)
    const cellY = Math.floor(y / CELL_H)
    if (cellX < 0 || cellX >= GRID_W || cellY < 0 || cellY >= GRID_H) return
    const cell = cells[cellY]?.[cellX]
    if (!cell) return
    const subX = x - cellX * CELL_W
    const subY = y - cellY * CELL_H
    cell.bits |= 1 << (subX + CELL_W * subY)
    if (depth > cell.depth) cell.depth = depth
  }

  for (let i = 0; i < ORBITS; i++) {
    const ro = R * (0.5 + 0.42 * hash(orbIndex, i))
    const [nx, ny, nz] = fibDir(i, ORBITS)
    // Orbit plane basis (u, v) perpendicular to the plane normal.
    let ux = -ny
    let uy = nx
    const uz = 0
    const ul = Math.max(1e-6, Math.sqrt(ux * ux + uy * uy))
    ux /= ul
    uy /= ul
    const vx = ny * uz - nz * uy
    const vy = nz * ux - nx * uz
    const vz = nx * uy - ny * ux

    for (let k = 0; k < SEGMENTS; k++) {
      const a = (k / SEGMENTS) * 2 * Math.PI
      const x = (ux * Math.cos(a) + vx * Math.sin(a)) * ro
      const y = (uy * Math.cos(a) + vy * Math.sin(a)) * ro
      const z = (uz * Math.cos(a) + vz * Math.sin(a)) * ro
      const [px, py, pz] = project(x, y, z)
      const depth = Math.min(1, Math.max(0, (pz / R + 1) / 2))
      put(px, py, pz, depth)
    }
  }

  return cells
}

function orbRows(tick: number, orbIndex: number, palette: OrbPalette) {
  const grid = orbGrid(tick, orbIndex)
  const rows: JSXElement[] = []
  for (let y = 0; y < GRID_H; y++) {
    const cells: JSXElement[] = []
    for (let x = 0; x < GRID_W; x++) {
      const cell = grid[y]?.[x]
      if (!cell || !cell.bits) {
        cells.push(<text selectable={false}> </text>)
        continue
      }
      const fg = tint(palette.back, palette.front, Math.pow(cell.depth, DEPTH_GAMMA))
      cells.push(
        <text fg={fg} selectable={false}>
          {String.fromCodePoint(0x2800 + cell.bits)}
        </text>,
      )
    }
    rows.push(<box flexDirection="row">{cells}</box>)
  }
  return rows
}

export function ThinkingOrbs() {
  const { theme, mode } = useTheme()
  const kv = useKV()
  const [tick, setTick] = createSignal(0)

  onMount(() => {
    const timer = setInterval(() => setTick((t) => t + 1), TICK)
    onCleanup(() => clearInterval(timer))
  })

  const renderOrb = (index: number) => {
    const palette = buildPalette(theme.background, mode() === "dark")
    return (
      <box flexDirection="column" alignItems="center" paddingLeft={1} paddingRight={1}>
        {orbRows(tick(), index, palette)}
      </box>
    )
  }

  return (
    <Show when={kv.get("animations_enabled", true)} fallback={<text fg={theme.textMuted}>● ● ●</text>}>
      <box flexDirection="row" justifyContent="center" alignItems="center">
        {Array.from({ length: ORB_COUNT }, (_, i) => i).map((i) => renderOrb(i))}
      </box>
    </Show>
  )
}
