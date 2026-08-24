import { expect, test } from "@playwright/test"
import { base64Encode } from "@klautcode/core/util/encode"
import { mockKlautcodeServer } from "../utils/mock-server"
import { expectAppVisible } from "../utils/waits"

const directory = "C:/Klautcode/DesignModeConfirm"
const projectID = "proj_design_mode_confirm"
const sessionID = "ses_design_mode_confirm"

async function openSession(page: import("@playwright/test").Page) {
  page.on("console", (msg) => {
    const text = String(msg.text())
    if (msg.type() === "error" && text.startsWith("DIAG")) console.log("PAGE", text)
  })
  await mockKlautcodeServer(page, {
    directory,
    project: {
      id: projectID,
      worktree: directory,
      vcs: "git",
      name: "design-mode-confirm",
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
        slug: "design-mode-confirm",
        projectID,
        directory,
        title: "Design mode confirm",
        version: "dev",
        time: { created: 1700000000000, updated: 1700000000000 },
      },
    ],
    pageMessages: () => ({ items: [] }),
  })
  await page.addInitScript(() => {
    localStorage.setItem("settings.v3", JSON.stringify({ general: { newLayoutDesigns: true } }))
  })
  await page.goto(`/${base64Encode(directory)}/session/${sessionID}`)
  const composer = page.locator('[data-component="prompt-input-v2"]')
  await expectAppVisible(composer)
  return composer.locator('[data-component="prompt-input"]')
}

function countPrompts(page: import("@playwright/test").Page) {
  const requests: string[] = []
  page.on("request", (request) => {
    const url = new URL(request.url())
    if (request.method() === "POST" && /\/session\/[^/]+\/prompt_async$/.test(url.pathname)) {
      requests.push(JSON.stringify(request.postDataJSON()?.prompt ?? request.postDataJSON()?.parts))
    }
  })
  return requests
}

function textOf(prompt: string): string {
  try {
    const parts = JSON.parse(prompt) as Array<{ type: string; text?: string }>
    return parts.flatMap((part) => (part.type === "text" ? [part.text ?? ""] : [])).join("")
  } catch {
    return prompt
  }
}

test("typing letters and pressing Enter sends exactly one prompt", async ({ page }) => {
  const input = await openSession(page)
  const sent = countPrompts(page)

  for (const key of ["h", "e", "l", "l", "o"]) {
    await input.press(key)
  }
  expect(sent.map(textOf)).toEqual([])

  await input.press("Enter")
  await expect.poll(() => sent.length).toBe(1)
  expect(sent.map(textOf)).toEqual(["hello"])
})

test("typing letters in design mode and pressing Enter sends exactly one prompt", async ({ page }) => {
  const input = await openSession(page)
  const sent = countPrompts(page)

  await page.evaluate(() => {
    const host = document.createElement("div")
    host.setAttribute("data-component", "browser-webview")
    host.style.position = "absolute"
    host.style.top = "0"
    host.style.left = "0"
    host.style.width = "800px"
    host.style.height = "480px"
    document.body.appendChild(host)
  })

  const pencil = page.locator('[data-action="prompt-design-mode"]')
  await pencil.click()
  await expect(pencil).toHaveAttribute("aria-pressed", "true")

  for (const key of ["h", "e", "l", "l", "o"]) {
    await input.press(key)
  }
  expect(sent.map(textOf)).toEqual([])

  await input.press("Enter")
  await expect.poll(() => sent.length).toBe(1)
  expect(sent.map(textOf)).toEqual(["hello"])
})