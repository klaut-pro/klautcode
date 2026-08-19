import { Global } from "@klautcode/core/global"
import { readAuthKeys } from "@klautcode/server/handlers/auth-keys"
import { afterEach, describe, expect, test } from "bun:test"
import path from "node:path"

const authPath = path.join(Global.Path.data, "auth.json")

async function writeAuth(value: Record<string, AuthEntry> | undefined) {
  const fs = await import("node:fs/promises")
  if (value === undefined) return await fs.rm(authPath, { force: true })
  await fs.mkdir(path.dirname(authPath), { recursive: true })
  return await Bun.write(authPath, JSON.stringify(value))
}

type AuthEntry = { type: string; key: string }

async function readOriginal(): Promise<Record<string, AuthEntry> | undefined> {
  const fs = await import("node:fs/promises")
  const raw = await fs.readFile(authPath, "utf8").catch(() => undefined)
  return raw ? JSON.parse(raw) : undefined
}

describe("readAuthKeys", () => {
  afterEach(async () => {
    const original = await readOriginal()
    await writeAuth(original)
  })

  test("returns configured api providers", async () => {
    await writeAuth({ openai: { type: "api", key: "k1" }, anthropic: { type: "api", key: "k2" } })
    expect([...readAuthKeys()].sort()).toEqual(["anthropic", "openai"])
  })

  test("opencode-go key also marks opencode as connected", async () => {
    await writeAuth({ "opencode-go": { type: "api", key: "zen" } })
    expect(readAuthKeys().has("opencode")).toBe(true)
    expect(readAuthKeys().has("opencode-go")).toBe(true)
  })

  test("opencode key also marks opencode-go as connected", async () => {
    await writeAuth({ opencode: { type: "api", key: "zen" } })
    expect(readAuthKeys().has("opencode")).toBe(true)
    expect(readAuthKeys().has("opencode-go")).toBe(true)
  })

  test("missing auth file returns empty set", async () => {
    await writeAuth(undefined)
    expect([...readAuthKeys()]).toEqual([])
  })
})