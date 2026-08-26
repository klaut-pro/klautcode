import { createMemo, Show } from "solid-js"
import { useParams } from "@solidjs/router"
import { useLanguage } from "@/context/language"
import { useSync } from "@/context/sync"
import { Icon } from "@klautcode/ui/icon"

// Surfaces that the session stopped with an error while idle, so the user
// knows the prompt input is still available to continue the conversation.
export function SessionErrorDock() {
  const sync = useSync()
  const language = useLanguage()
  const params = useParams()
  const sessionID = () => params.id

  const visible = createMemo(() => {
    const id = sessionID()
    if (!id) return false
    const status = sync().data.session_status[id]
    if (status?.type !== "idle") return false
    const last = sync().data.message[id]?.at(-1)
    return last?.role === "assistant" && last.error !== undefined && last.error.name !== "MessageAbortedError"
  })

  return (
    <Show when={visible()}>
      <div data-component="session-error-dock" class="w-full px-3 pb-1 flex items-center gap-1.5">
        <Icon name="warning" size="small" class="text-icon-warning-active" />
        <span class="text-12-regular text-text-weak">{language.t("session.error.continue")}</span>
      </div>
    </Show>
  )
}