import { base64Encode } from "@klautcode/core/util/encode"
import { expect, test, type Page } from "@playwright/test"
import { mockKlautcodeServer } from "../utils/mock-server"
import { expectSessionTitle } from "../utils/waits"

const directory = "C:/Klautcode/BrowserTabHeight"
const projectID = "proj_browser_tab_height"
const sessionID = "ses_browser_tab_height"
const title = "Browser tab height"
const server = `http://${process.env.PLAYWRIGHT_SERVER_HOST ?? "127.0.0.1"}:${process.env.PLAYWRIGHT_SERVER_PORT ?? "4096"}`

test.use({ viewport: { width: 1440, height: 900 } })

// The in-app browser must fill the side panel height. The webview host (desktop)
// and the web fallback share the same flex slot, so a collapsed slot shows up as
// a thin strip on both platforms.
test("browser tab fills the side panel height", async ({ page }) => {
  await setup(page)

  await page.goto(`/server/${base64Encode(server)}/session/${sessionID}`)
  await expectSessionTitle(page, title)

  const panel = page.locator("#review-panel")
  await expect(panel).toBeVisible()

  await panel.getByRole("button", { name: "browser.open" }).click()
  await page.getByRole("menuitem", { name: "New browser tab" }).click()

  const fallback = panel.getByRole("button", { name: "The internal browser is available in the desktop app. Open this page externally." })
  await expect(fallback).toBeVisible()

  const panelBox = await panel.boundingBox()
  const contentBox = await fallback.boundingBox()
  expect(panelBox, "panel must have a box").not.toBeNull()
  expect(contentBox, "browser content must have a box").not.toBeNull()

  // The content area is the panel minus the tab bar and the browser toolbar.
  // A thin strip (collapsed flex slot) is at most ~100px; the real area is most
  // of the panel. Assert it keeps at least half the panel height.
  expect(contentBox!.height, `browser content height ${contentBox!.height}px vs panel ${panelBox!.height}px`).toBeGreaterThanOrEqual(
    panelBox!.height / 2,
  )
})

async function setup(page: Page) {
  await mockKlautcodeServer(page, {
    directory,
    project: {
      id: projectID,
      worktree: directory,
      vcs: "git",
      name: "browser-tab-height",
      time: { created: 1700000000000, updated: 1700000000000 },
      sandboxes: [],
    },
    provider: {
      all: [
        {
          id: "klautcode",
          name: "Klautcode",
          models: { test: { id: "test", name: "Test", limit: { context: 200_000 } } },
        },
      ],
      connected: ["klautcode"],
      default: { providerID: "klautcode", modelID: "test" },
    },
    sessions: [
      {
        id: sessionID,
        slug: sessionID,
        projectID,
        directory,
        title,
        version: "dev",
        time: { created: 1700000000000, updated: 1700000000000 },
      },
    ],
    vcsDiff: [],
    fileList: () => [],
    fileContent: (path) => ({ type: "text", content: `contents:${path}` }),
    pageMessages: () => ({ items: [] }),
  })

  await page.addInitScript(
    ({ directory, server, sessionID }) => {
      localStorage.setItem("settings.v3", JSON.stringify({ general: { newLayoutDesigns: true } }))
      localStorage.setItem(
        "klautcode.global.dat:server",
        JSON.stringify({
          projects: { local: [{ worktree: directory, expanded: true }] },
          lastProject: { local: directory },
        }),
      )
      localStorage.setItem(
        "klautcode.global.dat:layout",
        JSON.stringify({ review: { diffStyle: "split", panelOpened: true } }),
      )
      localStorage.setItem(
        "klautcode.window.browser.dat:tabs",
        JSON.stringify([{ type: "session", server, sessionId: sessionID }]),
      )
    },
    { directory, server, sessionID },
  )
}