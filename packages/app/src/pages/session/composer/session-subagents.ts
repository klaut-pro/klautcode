import type { Part as PartType } from "@klautcode/sdk/v2"

// A subagent launched by the current session via the `task` tool. The tool part
// carries the child session id + description; the child session status tells us
// whether the subagent is still working, blocked, or done.
export type ActiveSubagent = {
  sessionId: string
  description: string
  status: "working" | "blocked" | "done"
}

export function collectSubagents(input: {
  messages: { id: string }[]
  parts: (messageID: string) => PartType[]
  sessionStatus: (sessionID: string) => { type: "busy" | "idle" | "retry" } | undefined
}): ActiveSubagent[] {
  const found: ActiveSubagent[] = []
  const seen = new Set<string>()

  for (const message of input.messages) {
    for (const part of input.parts(message.id)) {
      if (part.type !== "tool" || part.tool !== "task") continue
      const metadata = "metadata" in part.state ? part.state.metadata : undefined
      const childId = metadata?.sessionId
      if (typeof childId !== "string" || !childId || seen.has(childId)) continue
      seen.add(childId)

      const toolInput = part.state.input as { description?: string } | undefined
      const description =
        typeof toolInput?.description === "string" && toolInput.description ? toolInput.description : ""

      const status = input.sessionStatus(childId)
      // Only an explicitly busy/retry child counts as working. An untracked
      // status (e.g. after the subagent session was closed) must not keep the
      // dock alive, or finished subagents reappear forever.
      const active = status?.type === "busy" || status?.type === "retry" ? "working" : "done"

      found.push({ sessionId: childId, description, status: active })
    }
  }
  return found
}
