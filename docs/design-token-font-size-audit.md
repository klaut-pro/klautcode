# Design-token font-size audit — every element now scales with the font-size setting

## The bug

The Settings → Appearance font-size setting drives `--font-size-scale` on the root element
(`app/src/context/settings.tsx`): `scale = fontSize / 13`. The font-size **tokens**
(`packages/ui/src/styles/theme.css`) are all `calc(Npx * var(--font-size-scale))`, so token-based
text scales with the setting — but anything written as a raw pixel does not.

Reported symptom: the composer prompt input stayed at 13px while the rest of the app scaled
(e.g. body 12px → 18.2px after the setting changed).

## The audit

Two non-scaling patterns existed in the source trees (`app/src`, `session-ui/src`, `ui/src`):

| Pattern | Occurrences | Effect |
| --- | --- | --- |
| `text-[13px]` (and other `text-[Npx]`) Tailwind arbitrary classes in TSX | 85 | Hard px, bypasses `--font-size-scale` |
| `font-size: 13px` (and other `font-size: Npx`) raw declarations in CSS | 54 | Same |

Plus two smaller gaps:

- Tailwind's default `text-xs` maps to `0.75rem` (unscaled root rem) — it never scaled.
- `ui/src/components/avatar.css` used three raw `rem` font-sizes (same unscaled-rem problem).

## The fix

1. **TSX**: exact-token sizes became Tailwind v4 variable refs — `text-[13px]` →
   `text-(--font-size-base)`, `text-[11px]` → `text-(--font-size-x-small)`, `text-[12px]` →
   `text-(--font-size-small)`, `text-[15px]` → `text-(--font-size-large)`. Non-token sizes
   (9/10/14/21/32px) became `text-[calc(Npx*var(--font-size-scale))]` — pixel-identical at
   scale 1, scales with the setting.
2. **CSS**: same mapping — `font-size: 13px` → `var(--font-size-base)`, 11/12/15px → their
   tokens; 14/17px → `calc(Npx * var(--font-size-scale))` (no token exists for those sizes).
3. **`text-xs`**: the Tailwind theme (`ui/src/styles/tailwind/index.css`) now maps
   `--text-xs: var(--font-size-small)` — still 12px at scale 1, but scales like the others.
4. **avatar.css**: `0.75rem` → `var(--font-size-small)`, `1.125rem` → `var(--font-size-x-large)`,
   `1.25rem` → `calc(20px * var(--font-size-scale))`.

38 files changed; every conversion is pixel-identical at scale 1 (verified in the built bundle:
`--font-size-base: calc(13px * var(--font-size-scale))`, all calc variants emitted).

## Verification

Live in the rebuilt packaged app (CDP probe of the composer prompt input):

- scale 0.923 (user's 12px setting): editor **11.999px** (13 × 0.923) — previously pinned at 13px
- scale 1.5: editor **19.5px**

Screenshots: `design-token-scale-normal.png` and `design-token-scale-1.5x.png`.

## Regression test

`packages/app/src/components/design-tokens.regression.test.ts` (source-invariant, same
convention as the other regression tests):

- no TSX file in app/session-ui/ui may contain `text-[Npx]`
- no CSS file may contain `font-size: Npx`
- the composer prompt input must use `text-(--font-size-base)`
- the Tailwind theme must keep `--text-xs` mapped to a font-size token

Suites: app 800 pass / 0 fail, ui 31 pass / 0 fail, typecheck green.
