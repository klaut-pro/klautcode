import { Global } from "@klautcode/core/global"

export function readAuthKeys(): Set<string> {
  try {
    const raw = require("node:fs").readFileSync(Global.Path.data + "/auth.json", "utf8")
    const parsed = JSON.parse(raw) as Record<string, { type?: string }>
    const keys = new Set(
      Object.entries(parsed)
        .filter(([, info]) => info.type === "api")
        .map(([id]) => id),
    )
    // opencode and opencode-go share the same zen account/API key. Treat both
    // as connected when either is configured, mirroring the v1 provider loader.
    if (keys.has("opencode") || keys.has("opencode-go")) {
      keys.add("opencode")
      keys.add("opencode-go")
    }
    return keys
  } catch {
    return new Set<string>()
  }
}