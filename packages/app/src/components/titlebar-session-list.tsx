import { createMemo, createSignal, For, Show } from "solid-js"
import { useNavigate } from "@solidjs/router"
import { useLanguage } from "@/context/language"
import { useServerSync, useQueryOptions } from "@/context/server-sync"
import { DropdownMenu } from "@klautcode/ui/dropdown-menu"
import { Icon } from "@klautcode/ui/icon"
import { Tooltip } from "@klautcode/ui/tooltip"
import { useLayout } from "@/context/layout"
import { base64Encode } from "@klautcode/core/util/encode"
import { getFilename } from "@klautcode/core/util/path"
import { sortedRootSessions, deferredMemo } from "@/pages/layout/helpers"
import { sessionTitle } from "@/utils/session-title"
import { useTabs, tabKey, type Tab } from "@/context/tabs"

// Persistent chat-list dropdown in the titlebar. Lists every root session for
// the active project (not just open tabs) so users can jump to any past chat
// without the tab strip overflowing (KLA-5).
export function TitlebarSessionList(props: {
  directory: string
  tabs: Tab[]
  currentTab: () => Tab | undefined
}) {
  const serverSync = useServerSync()
  const queryOptions = useQueryOptions()
  const language = useLanguage()
  const navigate = useNavigate()
  const layout = useLayout()
  const tabs = useTabs()
  const [open, setOpen] = createSignal(false)

  const workspace = createMemo(() => {
    const [store] = serverSync().child(props.directory)
    return store
  })
  const sessions = deferredMemo(() => sortedRootSessions(workspace(), Date.now()) ?? [])
  const openTabKeys = createMemo(() => new Set(props.tabs.map(tabKey)))

  const activeSessionID = createMemo(() => {
    const tab = props.currentTab()
    if (!tab || tab.type !== "session") return
    return tab.sessionId
  })

  const openSession = (sessionID: string) => {
    setOpen(false)
    const slug = base64Encode(props.directory)
    layout.handoff.setTabs(slug, sessionID)
    navigate(`/${slug}/session/${sessionID}`)
  }

  return (
    <Tooltip placement="bottom" value={language.t("session.list.title")}>
      <DropdownMenu open={open()} onOpenChange={setOpen}>
        <DropdownMenu.Trigger
          aria-label={language.t("session.list.title")}
          data-component="titlebar-session-list"
        >
          <div class="flex items-center justify-center size-7 rounded-md text-text-weak hover:bg-surface-raised-base-hover hover:text-text-strong">
            <Icon name="bullet-list" size="small" />
          </div>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content class="w-72 max-h-[60vh] overflow-y-auto">
            <div class="px-3 py-2 text-12-medium text-text-weak">{language.t("session.list.title")}</div>
            <Show
              when={sessions().length > 0}
              fallback={<div class="px-3 py-2 text-13-regular text-text-weak">{language.t("session.list.empty")}</div>}
            >
              <For each={sessions()}>
                {(session) => {
                  const isActive = () => activeSessionID() === session.id
                  const isOpen = () => openTabKeys().has(session.id)
                  return (
                    <DropdownMenu.Item
                      onSelect={() => openSession(session.id)}
                      data-active={isActive() ? "true" : undefined}
                    >
                      <div class="flex min-w-0 items-center gap-2 py-0.5">
                        <span
                          class="size-1.5 shrink-0 rounded-full"
                          classList={{
                            "bg-icon-info-active": isActive(),
                            "bg-icon-base": !isActive() && isOpen(),
                          }}
                        />
                        <span
                          class="truncate"
                          classList={{
                            "text-text-strong": isActive(),
                            "text-text-base": !isActive(),
                          }}
                        >
                          {sessionTitle(session.title) ?? getFilename(session.id)}
                        </span>
                      </div>
                    </DropdownMenu.Item>
                  )
                }}
              </For>
            </Show>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu>
    </Tooltip>
  )
}
