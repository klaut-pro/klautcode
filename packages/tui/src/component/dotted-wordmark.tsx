import { For } from "solid-js"
import { RGBA } from "@opentui/core"
import { tint, useTheme } from "../context/theme"
import { dottedFont, DOTTED_WORD } from "../logo-dots"

const GLYPH_GAP = 1

// Render "klautcode" as a dense dot matrix: every glyph cell is a "·", and
// lit cells use the klaut.pro brand cyan while unlit cells use a faint tint,
// so the wordmark reads as a continuous, dense field of dots.
export function DottedWordmark() {
  const { theme } = useTheme()
  const lit = RGBA.fromHex("#00e5ff")
  const unlit = tint(theme.background, lit, 0.2)
  const letterGap = "·".repeat(GLYPH_GAP)

  const glyphRow = (row: number): string =>
    Array.from(DOTTED_WORD)
      .map((char) => dottedFont[char]?.[row] ?? "00000")
      .join(letterGap)

  return (
    <box flexDirection="column" alignItems="center">
      <For each={Array.from({ length: 7 }, (_, i) => i)}>
        {(row) => (
          <box flexDirection="row">
            {Array.from(glyphRow(row)).map((cell) => (
              <text fg={cell === "1" ? lit : unlit} selectable={false}>
                ·
              </text>
            ))}
          </box>
        )}
      </For>
    </box>
  )
}
