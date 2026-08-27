import { base64Encode } from "@klautcode/core/util/encode"
import { expect, test, type Locator, type Page } from "@playwright/test"
import { mockKlautcodeServer } from "../utils/mock-server"
import { expectSessionTitle } from "../utils/waits"

const directory = "C:/Klautcode/ColumnBottomAlignment"
const projectID = "proj_column_bottom_alignment"
const sessionID = "ses_column_bottom_alignment"
const title = "Column bottom alignment"
const server = `http://${process.env.PLAYWRIGHT_SERVER_HOST ?? "127.0.0.1"}:${process.env.PLAYWRIGHT_SERVER_PORT ?? "4096"}`

test.use({ viewport: { width: 1440, height: 900 } })

// The chats sidebar used `h-full` (height: 100% of the flex row) *plus* `my-2`
// top/bottom margins, so its footprint was 16px taller than the row: its bottom
// landed 8px past the row — clipped at the window edge with the rounded corner
// cut — while the chat column and the right panel (which are inset by the row's
// padding) stopped 8px earlier. All three columns must end at the same y, and
// none may be clipped by the window bottom.
test("chats sidebar, chat column, and right panel end at the same height", async ({ page }) => {
  await setup(page)

  await page.goto(`/server/${base64Encode(server)}/session/${sessionID}`)
  await expectSessionTitle(page, title)

  const sidebar = page.locator("#project-chats-sidebar")
  const dock = page.locator('[data-component="session-prompt-dock"]')
  const review = page.locator("#review-panel")
  await expect(sidebar).toBeVisible()
  await expect(dock).toBeVisible()
  await expect(review).toBeVisible()

  const viewport = page.viewportSize()
  if (!viewport) throw new Error("viewport size unavailable")

  const sidebarBottom = await columnBottom(sidebar)
  const dockBottom = await columnBottom(dock)
  const reviewBottom = await columnBottom(review)

  // The three columns share the same bottom edge (1px tolerance for subpixel
  // rounding; a 12-16px offset is exactly the bug this guards against).
  for (const [name, bottom] of [
    ["chat column", dockBottom],
    ["right panel", reviewBottom],
  ] as const) {
    expect(
      Math.abs(sidebarBottom - bottom),
      `sidebar bottom ${sidebarBottom}px vs ${name} bottom ${bottom}px`,
    ).toBeLessThanOrEqual(1)
  }

  // The sidebar must sit fully inside the window: before the fix its bottom was
  // past the window edge and the rounded corner was clipped.
  expect(sidebarBottom, `sidebar bottom ${sidebarBottom}px vs viewport ${viewport.height}px`).toBeLessThan(
    viewport.height - 1,
  )
})

async function columnBottom(locator: Locator) {
  const box = await locator.boundingBox()
  if (!box) throw new Error("column bounds are unavailable")
  return box.y + box.height
}

async function setup(page: Page) {
  await mockKlautcodeServer(page, {
    directory,
    project: {
      id: projectID,
      worktree: directory,
      vcs: "git",
      name: "column-bottom-alignment",
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
