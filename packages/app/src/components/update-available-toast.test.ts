import { describe, expect, test } from "bun:test"
import { readyUpdateVersion } from "./update-available"

const layout = await Bun.file(new URL("../pages/layout.tsx", import.meta.url)).text()
const layoutNew = await Bun.file(new URL("../pages/layout-new.tsx", import.meta.url)).text()

describe("readyUpdateVersion", () => {
  test("returns the version only after a GitHub update is downloaded and ready to install", () => {
    expect(readyUpdateVersion(undefined)).toBeUndefined()
    expect(readyUpdateVersion({ status: "idle" })).toBeUndefined()
    expect(readyUpdateVersion({ status: "checking" })).toBeUndefined()
    expect(readyUpdateVersion({ status: "downloading", version: "1.18.17" })).toBeUndefined()
    expect(readyUpdateVersion({ status: "installing", version: "1.18.17" })).toBeUndefined()
    expect(readyUpdateVersion({ status: "up-to-date" })).toBeUndefined()
    expect(readyUpdateVersion({ status: "ready", version: "1.18.17" })).toBe("1.18.17")
  })
})

describe("desktop layouts notify and install GitHub updates in the UI", () => {
  test("legacy and v2 layouts mount the update toast", () => {
    expect(layout).toContain("UpdateAvailableToast")
    expect(layoutNew).toContain("UpdateAvailableToast")
  })

  test("v2 titlebar still exposes install for the ready update", () => {
    expect(layoutNew).toContain("platform.updater?.install()")
    expect(layoutNew).toContain("readyUpdateVersion(platform.updater?.state())")
  })
})
