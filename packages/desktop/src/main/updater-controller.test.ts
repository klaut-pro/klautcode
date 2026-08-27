import { describe, expect, test } from "bun:test"
import {
  classifyUpdaterError,
  createUpdaterController,
  type UpdaterBackend,
  type UpdaterReadyRecord,
} from "./updater-controller"

function setup(input?: { currentVersion?: string; ready?: UpdaterReadyRecord }) {
  const calls: string[] = []
  const backend: UpdaterBackend = {
    async checkForUpdates() {
      calls.push("check")
      return { isUpdateAvailable: true, updateInfo: { version: "2.0.0" } }
    },
    async downloadUpdate() {
      calls.push("download")
    },
    quitAndInstall() {
      calls.push("install")
    },
  }
  let ready = input?.ready
  const controller = createUpdaterController({
    enabled: true,
    currentVersion: input?.currentVersion ?? "1.0.0",
    backend,
    persistence: {
      get: () => ready,
      set: (value) => {
        ready = value
      },
      clear: () => {
        ready = undefined
      },
    },
    stop: async () => {
      calls.push("stop")
    },
  })
  return { controller, calls, getReady: () => ready }
}

describe("updater controller", () => {
  test("checks, downloads, persists, and publishes one authoritative ready state", async () => {
    const app = setup()
    const states: ReturnType<typeof app.controller.getState>[] = []
    app.controller.subscribe((state) => states.push(state))

    await app.controller.start()

    expect(app.calls).toEqual(["check", "download"])
    expect(app.getReady()).toEqual({ version: "2.0.0" })
    expect(states.map((state) => state.status)).toEqual(["idle", "checking", "downloading", "ready"])
    expect(app.controller.getState()).toEqual({ status: "ready", version: "2.0.0" })
  })

  test("revalidates a persisted target through the updater cache on launch", async () => {
    const app = setup({ ready: { version: "2.0.0" } })

    await app.controller.start()

    expect(app.calls).toEqual(["check", "download"])
    expect(app.controller.getState()).toEqual({ status: "ready", version: "2.0.0" })
  })

  test("clears a target already installed before checking", async () => {
    const app = setup({ currentVersion: "2.0.0", ready: { version: "2.0.0" } })

    await app.controller.start()

    expect(app.getReady()).toBeUndefined()
    expect(app.calls).toEqual(["check"])
  })

  test("coalesces concurrent checks", async () => {
    const app = setup()

    await Promise.all([app.controller.check(), app.controller.check(), app.controller.check()])

    expect(app.calls).toEqual(["check", "download"])
  })

  test("returns to ready when quitAndInstall returns without exiting", async () => {
    const app = setup()
    await app.controller.start()

    await app.controller.install()

    expect(app.calls).toEqual(["check", "download", "stop", "install"])
    expect(app.controller.getState()).toEqual({ status: "ready", version: "2.0.0" })
  })

  test("returns to ready when installation cannot start", async () => {
    const app = setup()
    await app.controller.start()

    const failed = createUpdaterController({
      enabled: true,
      currentVersion: "1.0.0",
      backend: {
        checkForUpdates: async () => ({ isUpdateAvailable: true, updateInfo: { version: "2.0.0" } }),
        downloadUpdate: async () => {},
        quitAndInstall() {},
      },
      persistence: { get: () => undefined, set() {}, clear() {} },
      stop: async () => {
        throw new Error("stop failed")
      },
    })
    await failed.start()

    await expect(failed.install()).rejects.toThrow("stop failed")
    expect(failed.getState()).toEqual({ status: "ready", version: "2.0.0" })
  })

  test("a failed check transitions to error with a classified reason", async () => {
    const controller = createUpdaterController({
      enabled: true,
      currentVersion: "1.0.0",
      backend: {
        checkForUpdates: async () => {
          throw new Error(
            "Cannot find latest-mac.yml in the latest release artifacts of the release v1.18.17: HTTPError: 404",
          )
        },
        downloadUpdate: async () => {},
        quitAndInstall() {},
      },
      persistence: { get: () => undefined, set() {}, clear() {} },
      stop: async () => {},
    })

    await controller.start()

    expect(controller.getState()).toEqual({
      status: "error",
      message: "Cannot find latest-mac.yml in the latest release artifacts of the release v1.18.17: HTTPError: 404",
      reason: "missing-artifacts",
    })
  })
})

describe("classifyUpdaterError", () => {
  test("detects a release that has no build for this platform", () => {
    expect(
      classifyUpdaterError("Cannot find latest-mac.yml in the latest release artifacts of the release v1.18.17: HTTPError: 404"),
    ).toBe("missing-artifacts")
    expect(classifyUpdaterError("Cannot find latest-linux.yml in the latest release artifacts")).toBe("missing-artifacts")
    expect(classifyUpdaterError("Cannot find latest.yml in the latest release artifacts")).toBe("missing-artifacts")
  })

  test("detects an unreachable release channel", () => {
    expect(classifyUpdaterError("getaddrinfo ENOTFOUND github.com")).toBe("unreachable")
    expect(classifyUpdaterError("fetch failed")).toBe("unreachable")
    expect(classifyUpdaterError("request timed out")).toBe("unreachable")
    // A bare HttpError (repo or release missing) means the channel is gone,
    // including GitHub's raw 404 body for a nonexistent repo.
    expect(classifyUpdaterError("HttpError: 404")).toBe("unreachable")
    expect(classifyUpdaterError('404 \n"method: GET url: https://github.com/klaut-pro/klautcode-missing/releases.atom')).toBe(
      "unreachable",
    )
  })

  test("leaves unrelated failures unclassified", () => {
    expect(classifyUpdaterError("sha512 mismatch: expected abc, got def")).toBeUndefined()
  })
})
