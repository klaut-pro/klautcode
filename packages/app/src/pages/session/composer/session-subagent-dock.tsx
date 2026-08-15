import { createMemo, For, Show } from "solid-js"
import { useNavigate, useParams } from "@solidjs/router"
import { useLanguage } from "@/context/language"
import { useSync } from "@/context/sync"
import { useSDK } from "@/context/sdk"
import { Icon } from "@klautcode/ui/icon"
import { useLayout } from "@/context/layout"
import { base64Encode } from "@klautcode/core/util/encode"
import { getFilename } from "@klautcode/core/util/path"
import { deferredMemo } from "@/pages/layout/helpers"
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
      const active = status === undefined || status.type === "busy" || status.type === "retry" ? "working" : "done"

      found.push({ sessionId: childId, description, status: active })
    }
  }
  return found
}

export function SessionSubagentDock() {
  const sync = useSync()
  const language = useLanguage()
  const navigate = useNavigate()
  const layout = useLayout()
  const sdk = useSDK()
  const params = useParams()
  const sessionID = () => params.id

  const subagents = deferredMemo<ActiveSubagent[]>(() => {
    const id = sessionID()
    if (!id) return []
    return collectSubagents({
      messages: sync().data.message[id] ?? [],
      parts: (messageID) => sync().data.part[messageID] ?? [],
      sessionStatus: (sessionID) => sync().data.session_status[sessionID],
    })
  })

  const active = createMemo(() => subagents().filter((s) => s.status !== "done"))

  const openSubagent = (sessionId: string) => {
    const directory = sync().directory
    layout.handoff.setTabs(base64Encode(directory), sessionId)
    navigate(`/${base64Encode(directory)}/session/${sessionId}`)
  }

  const stopSubagent = async (sessionId: string) => {
    await sdk()
      .api.session.interrupt({ sessionID: sessionId })
      .catch(() => {})
  }

  return (
    <Show when={active().length > 0}>
      <div data-component="session-subagent-dock" class="w-full px-3 pb-2 flex flex-col gap-1">
        <div class="flex items-center gap-2 text-12-regular text-text-weak">
          <Icon name="brain" size="small" />
          <span>{language.t("session.subagents.active")}</span>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <For each={active()}>
            {(subagent) => (
              <div
                class="group flex items-center gap-1.5 rounded-md border border-border-weak-base bg-background-base/50 px-2 py-1 text-13-regular text-text-strong transition-colors hover:bg-surface-raised-base-hover"
                onClick={() => openSubagent(subagent.sessionId)}
              >
                <span
                  class="size-1.5 rounded-full shrink-0"
                  classList={{
                    "bg-icon-info-active animate-pulse": subagent.status === "working",
                    "bg-icon-warning-active": subagent.status === "blocked",
                  }}
                />
                <span class="truncate max-w-52">{subagent.description || getFilename(subagent.sessionId)}</span>
                <button
                  type="button"
                  data-action="session-subagent-stop"
                  aria-label={language.t("session.subagents.stop")}
                  class="ml-0.5 flex size-5 shrink-0 items-center justify-center rounded-sm text-text-weak opacity-0 transition-opacity hover:bg-surface-raised-base-hover hover:text-text-base group-hover:opacity-100 focus-visible:opacity-100"
                  onClick={(event) => {
                    event.stopPropagation()
                    void stopSubagent(subagent.sessionId)
                  }}
                >
                  <Icon name="close" size="small" />
                </button>
              </div>
            )}
          </For>
        </div>
      </div>
    </Show>
  )
}
