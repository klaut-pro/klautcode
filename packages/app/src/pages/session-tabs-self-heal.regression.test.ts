import { describe, expect, test } from "bun:test"

// Pins the self-healing restore: a session tab whose session no longer exists
// (e.g. deleted on another machine or server) must close itself instead of
// leaving a dead-end error tab (active) or an "Unknown Session" stub
// (inactive) that reappears on every launch.
const session = await Bun.file(new URL("../pages/session.tsx", import.meta.url)).text()
const tabStrip = await Bun.file(new URL("../components/titlebar-tab-strip.tsx", import.meta.url)).text()

describe("dead session tab self-heal", () => {
  test("the not-found fallback schedules an automatic close", () => {
    // The error boundary fallback for "session cannot be found" must arm a
    // timer that removes the tab, so restored tabs pointing at deleted
    // sessions recover to the next tab / home instead of a permanent error.
    expect(session).toContain("window.setTimeout(closeTab")
    expect(session).toContain("tabs.removeSessionTab")
  })

  test("the timer is cancelled when the error changes and cleared on unmount", () => {
    // A retry that resolves (or a different error) must cancel the pending
    // close; the cleanup must clear the timer so closing after unmount never
    // removes a tab the user is actively viewing.
    expect(session).toContain("window.clearTimeout(closeTimer)")
    expect(session).toContain("onCleanup")
  })

  test("auto-close only fires for a not-found session, not other errors", () => {
    // Other failures (server connection, model errors) must keep showing the
    // normal error UI — only a missing session is self-healed.
    expect(session).toContain("isCurrentSessionNotFoundError(props.error, props.sessionID)")
    expect(session).toContain("window.setTimeout(closeTab, 2000)")
  })

  test("inactive dead tabs are pruned from the tab strip, not just the active one", () => {
    // The error boundary only mounts for the active tab; inactive restored
    // tabs would linger as "Unknown Session" stubs. The tab strip itself must
    // detect the not-found error from the session resolve and remove the tab
    // via the cleanup path (not recorded as user-closed).
    expect(tabStrip).toContain("isSessionNotFoundError")
    expect(tabStrip).toContain("isLocalSessionNotFoundError")
    expect(tabStrip).toContain("tabs.removeSessionTab")
    expect(tabStrip).toContain("resolveError")
    // The value path must stay non-throwing: an errored resource read would
    // re-throw to the app error boundary and render the ErrorPage for a dead
    // tab, so the settle error is captured in a signal, never observed via the
    // resource value.
    expect(tabStrip).toContain("ctx.sync.session.resolve(id).catch(")
  })
})
