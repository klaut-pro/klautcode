import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const tabsCss = readFileSync(join(import.meta.dir, "tabs.css"), "utf8")

/**
 * Regression guard for the "cut browser tab icon" bug: the compact review-panel
 * tab triggers have zero padding, so any negative optical margin on the icon
 * (e.g. `margin-inline-start: -2px`) pushes it outside the tab button and clips
 * its left edge (the monitor's left bezel landing on the pill edge).
 *
 * Icons must sit flush inside the trigger, never be pulled out with a negative
 * margin.
 */
describe("tabs.css tab icon alignment", () => {
  test("review-panel tab icons sit flush inside the trigger (zero margin)", () => {
    const section = tabsCss.slice(
      tabsCss.indexOf('body[data-new-layout] #review-panel [data-component="tabs"][data-variant="normal"][data-orientation="horizontal"]'),
    )
    expect(section.length).toBeGreaterThan(0)

    // The icon rule is the grouped selector ending in [data-slot="icon-svg"],
    // and it must declare a zero inline margin (never negative).
    expect(section).toMatch(/\[data-slot="icon-svg"\]\s*\{\s*margin-inline-start:\s*0\s*;?\s*\}/)
    expect(section).not.toMatch(/margin-(inline-start|left):\s*-\d/)
  })

  test("no tab trigger icon uses a negative margin anywhere in tabs.css", () => {
    // Pull every block that ends in an icon selector inside a tabs-trigger rule
    // and assert none of them declares a negative inline margin.
    const iconRules = [...tabsCss.matchAll(/((?:\.tab-fileicon-(?:color|mono)|\[data-slot="icon-svg"\]),?\s*)+[^{]*\{[^}]*\}/g)].map(
      (m) => m[0],
    )
    expect(iconRules.length).toBeGreaterThan(0)
    for (const rule of iconRules) {
      expect(rule).not.toMatch(/margin-(?:inline-start|left):\s*-\d/)
    }
  })

  test("the only negative margin in tabs.css is the close-button hover overlap", () => {
    // The close button intentionally uses -0.25rem to widen its hover target;
    // anything else negative would be an icon-overhang regression.
    const negativeMargins = [...tabsCss.matchAll(/margin[^;{]*:?\s*-\d[^;]*;/g)].map((m) => m[0].trim())
    expect(negativeMargins).toEqual(["margin: -0.25rem;"])
  })

  test("the trigger close button keeps its hover-overlap margin", () => {
    // Inside the tab trigger wrapper, the close-button icon-button uses a small
    // negative margin so its hover target overlaps the trigger edge. If this is
    // ever zeroed or made positive, the close button shrinks and can get clipped
    // by the trigger's overflow when the strip is compact.
    expect(tabsCss).toMatch(
      /\[data-slot="tabs-trigger-wrapper"\]\s*\{[\s\S]*?\[data-component="icon-button"\]\s*\{\s*margin:\s*-0\.25rem\s*;?\s*\}/,
    )
  })
})
