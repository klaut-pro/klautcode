# Fix: empty in-app browser window (webview detached at loading-stop)

**Visual proof:** `browser-empty-window-fix.png` (packaged app, browser panel showing Google).

## Symptom

The in-app browser panel stayed blank white even though the renderer logs showed a
perfect load sequence (`loading-start → navigate → dom-ready → finish-load →
loading-stop`). The Google page loaded — and then vanished from the DOM.

## Root cause

`BrowserTab` appends the Electron `<webview>` element imperatively inside a host
div (`onMount`). The loading skeleton overlay was rendered by a Solid `<Show>`
inside that **same host div**. When the guest finished loading, `store.loading`
flipped to `false` and Solid unmounted the `<Show>` — which clears the host
div's children, sweeping the imperatively-appended `<webview>` away with it.
Result: the webview was detached from the DOM at `loading-stop`, leaving the
panel blank.

## Fix (`packages/app/src/pages/session/browser/browser-tab.tsx`)

- Moved the loading overlay **out of the host div** into a sibling wrapper, so
  toggling `store.loading` can never touch the webview element.
- The webview now persists in the DOM after load (verified 90s+, zero
  `unmount` events, `getURL()`/`getTitle()` = Google).

## Related load-timing fixes (same area, earlier)

- **Visibility gate** — never start a guest load while the host is hidden
  (a `display:none` ancestor paints the guest at 1×1 and never repaints when the
  panel is shown); drive the pending load when the host becomes visible.
- **URL-normalized comparison** — `dom-ready`/store effects no longer re-issue
  redundant loads (kills `loadURL` ERR_ABORTED -3 loops).
- **-3 aborts are benign** — treated as "navigation already in flight".
- **Guarded guest getters** — `getTitle()`/`getURL()` on a detached/hidden guest
  no longer surface "must be attached to the DOM" uncaught errors.

## Verification

- Regression test added to `browser-tab.regression.test.ts` pinning the
  structural invariant (loading overlay is a sibling of the host, never a
  child); verified it fails against the pre-fix structure.
- Full app unit suite: 792 tests pass. Desktop + app typechecks pass.
- Packaged build logs show the full sequence at 764×796 with zero `unmount`
  events; the screenshot above shows the actual Google page rendering.
