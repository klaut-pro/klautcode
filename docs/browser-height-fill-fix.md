# Fix: in-app browser squeezed into the top 150px (guest frame not filling the sidebar)

**Visual proof:** `browser-height-fill-fix.png` (packaged app, Google filling the
full right sidebar — search box, buttons, and footer all visible to the panel's
bottom edge).

## Symptom

The in-app browser loaded Google but only the top ~150px of the panel showed
content; everything below was blank white. The webview element measured
764×796 (it filled the sidebar), yet the guest page painted at 764×150 — the
guest's viewport was hard-capped at 150px regardless of element size or resizes.

## Root cause

Electron 42 renders `<webview>` as a **shadow-root `<iframe>`**:

```html
<style>:host { display: flex; }</style>
<iframe style="flex: 1 1 auto; width: 100%; border: 0px"></iframe>
```

The shadow CSS stretches that iframe to the host — but only while the host is a
flex container. `BrowserTab` sets `el.style.display = "block"` on the webview
(an earlier fix so the guest doesn't collapse under `display:flex` +
overflow-hidden ancestors), and the inline style overrides the shadow's
`:host { display: flex }` rule. With the host a plain block, the iframe becomes
a block-level replaced element with `height: auto`, which resolves to
Chromium's **150px default replaced-element height** — so the guest viewport
was 764×150, and the page was clipped there. Width kept following the element
(`width: 100%`), which is why resizes only ever changed the width.

## Fix (`packages/app/src/pages/session/browser/browser-tab.tsx`)

Kept `display: block` (load-bearing for the collapse fix) and added
`fitGuestFrame(width, height)`, which reaches into the webview's shadow root and
sizes the guest `<iframe>` in pixels to match the host — called on mount and on
every resize inside `syncBox`. The guest viewport now tracks the host exactly
(764×796) and follows window resizes. Guarded: if the shadow frame is absent
(older Electron), it's a no-op and behavior is unchanged.

## Verification

- Live A/B in the packaged app: `display:block` → iframe 764×150;
  guest frame pixel-sized → iframe 764×796; guest `innerHeight` 796 (was 150).
- Regression test added to `browser-tab.regression.test.ts` pinning the
  invariant (mount sizes the shadow guest frame and re-fits on resize);
  13/13 pass, app typecheck green.
- Rebuilt + repackaged + installed; fresh build shows the Google page filling
  the full right sidebar (screenshot above).
