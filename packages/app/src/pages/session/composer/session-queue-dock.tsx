import { createMemo, Show } from "solid-js"
import { useParams } from "@solidjs/router"
import { useLanguage } from "@/context/language"
import { useSync } from "@/context/sync"
import { Icon } from "@klautcode/ui/icon"

// Surfaces the session's busy state as a queued-prompt indicator above the
// prompt input. While the agent is processing, additional prompts are queued
// and processed in order once the session is idle (server-side `delivery:
// "queue"` semantics).
export function SessionQueueDock() {
  const sync = useSync()
  const language = useLanguage()
  const params = useParams()
  const sessionID = () => params.id

  const busy = createMemo(() => {
    const id = sessionID()
    if (!id) return false
    const status = sync().data.session_status[id]
    return status?.type === "busy" || status?.type === "retry"
  })

  return (
    <Show when={busy()}>
      <div data-component="session-queue-dock" class="w-full px-3 pb-1 flex items-center gap-1.5">
        <Icon name="bubble-5" size="small" class="text-icon-info-active" />
        <span class="text-12-regular text-text-weak">{language.t("session.queue.busy")}</span>
      </div>
    </Show>
  )
}
