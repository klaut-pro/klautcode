import { createMemo, For, Show } from "solid-js"
import { useNavigate, useParams } from "@solidjs/router"
import { useLanguage } from "@/context/language"
import { useSync } from "@/context/sync"
import { useSDK } from "@/context/sdk"
import { Icon } from "@klautcode/ui/icon"
import { RunningDots } from "@klautcode/session-ui/v2/running-dots"
import { useLayout } from "@/context/layout"
import { base64Encode } from "@klautcode/core/util/encode"
import { getFilename } from "@klautcode/core/util/path"
import { deferredMemo } from "@/pages/layout/helpers"
import { collectSubagents, type ActiveSubagent } from "./session-subagents"

// The subagent dock surfaces the session's active subagents as compact text
// lines with a running indicator, mirroring the queue dock.
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
      <div data-component="session-subagent-dock" class="w-full px-3 pb-1 flex flex-col gap-1">
        <div class="flex items-center gap-1.5 text-12-regular text-text-weak">
          <RunningDots class="shrink-0 text-icon-info-active" />
          <span>{language.t("session.subagents.active")}</span>
        </div>
        <div class="flex flex-col">
          <For each={active()}>
            {(subagent) => (
              <div class="group flex items-center gap-1.5 py-0.5 text-13-regular">
                <span class="flex size-4 shrink-0 items-center justify-center" aria-hidden="true">
                  <Show
                    when={subagent.status === "working"}
                    fallback={
                      <span
                        class="block size-1.5 rounded-full"
                        classList={{
                          "bg-icon-warning-active": subagent.status === "blocked",
                          "bg-icon-info-active": subagent.status === "done",
                        }}
                      />
                    }
                  >
                    <RunningDots class="text-icon-info-active" />
                  </Show>
                </span>
                <button
                  type="button"
                  class="min-w-0 flex-1 truncate text-left text-13-regular text-text-base transition-colors hover:text-text-strong"
                  onClick={() => openSubagent(subagent.sessionId)}
                  title={subagent.description || getFilename(subagent.sessionId)}
                >
                  {subagent.description || getFilename(subagent.sessionId)}
                </button>
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
