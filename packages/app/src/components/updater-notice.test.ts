import { describe, expect, test } from "bun:test"

const notice = await Bun.file(new URL("./updater-notice.tsx", import.meta.url)).text()
const layout = await Bun.file(new URL("../pages/layout.tsx", import.meta.url)).text()
const layoutNew = await Bun.file(new URL("../pages/layout-new.tsx", import.meta.url)).text()

describe("updater notice", () => {
  test("auto-check failures surface an in-app toast with a classified message", () => {
    expect(notice).toContain("showToast")
    expect(notice).toContain('language.t("settings.updates.toast.missingArtifacts")')
    expect(notice).toContain('language.t("desktop.updater.dialog.checkFailed.message")')
    expect(notice).toContain('state.reason === "missing-artifacts"')
    expect(notice).toContain('state.reason === "unreachable"')
  })

  test("only error transitions that are new to the session fire a toast", () => {
    // Dedupe guard: the same failure must not spam a toast on every reactive
    // re-run (e.g. language changes re-evaluate the effect).
    expect(notice).toContain("lastMessage")
  })

  test("the toast is deferred past the mount flush so the toaster sees it", () => {
    // The notice effect can run before the toaster's store subscription is
    // wired up (solid-sonner subscribes in onMount), so a synchronous toast
    // would be published to the store but never rendered. Pins the microtask
    // deferral that fixes the invisible startup toast.
    expect(notice).toContain("queueMicrotask")
    expect(notice).toMatch(/queueMicrotask\(\s*\(\) => \{\s*showToast/)
  })

  test("both layouts mount the notice so startup failures are visible", () => {
    // Mounted inside the layouts (next to UpdateAvailableToast) so the notice
    // fires after the layout's setV2Toast effect has picked the toast variant:
    // mounting it above the router made early toasts go to the legacy toaster
    // whose region is not mounted in the new layout (invisible).
    expect(layout).toContain("<UpdaterNotice />")
    expect(layoutNew).toContain("<UpdaterNotice />")
    expect(layoutNew.indexOf("UpdaterNotice")).toBeGreaterThan(layoutNew.indexOf("UpdateAvailableToast"))
  })
})
