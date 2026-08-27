import { describe, expect, test } from "bun:test"

const notice = await Bun.file(new URL("./updater-notice.tsx", import.meta.url)).text()
const renderer = await Bun.file(new URL("../../../desktop/src/renderer/index.tsx", import.meta.url)).text()

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

  test("the desktop renderer mounts the notice so startup failures are visible", () => {
    expect(renderer).toContain("UpdaterNotice")
    expect(renderer).toContain("<UpdaterNotice />")
  })
})
