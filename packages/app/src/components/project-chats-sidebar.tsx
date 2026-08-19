import { For, Show, createEffect, createMemo, createSignal } from "solid-js"
import { createMediaQuery } from "@solid-primitives/media"
import { useParams } from "@solidjs/router"
import { useQuery } from "@tanstack/solid-query"
import { Icon as IconV2 } from "@klautcode/ui/v2/icon"
import { IconButtonV2 } from "@klautcode/ui/v2/icon-button-v2"
import { TooltipV2 } from "@klautcode/ui/v2/tooltip-v2"
import { ResizeHandle } from "@klautcode/ui/resize-handle"
import { RunningDots } from "@klautcode/session-ui/v2/running-dots"
import type { Session } from "@klautcode/sdk/v2/client"
import { useServerSync } from "@/context/server-sync"
import { useServerSDK } from "@/context/server-sdk"
import { useServer } from "@/context/server"
import { useTabs } from "@/context/tabs"
import { useLanguage } from "@/context/language"
import { useLayout, type LocalProject } from "@/context/layout"
import { loadHomeSessionIndex, type HomeSessionEvents } from "@/context/global-sync/home-session-index"
import { displayName } from "@/pages/layout/helpers"
import { sessionTitle } from "@/utils/session-title"
import { pathKey } from "@/utils/path-key"

const PROJECT_SIDEBAR_MIN = 200
const PROJECT_SIDEBAR_MAX = 480
const PROJECT_CHATS_PREVIEW = 3

type DragPayload =
  | { kind: "project"; worktree: string }
  | { kind: "chat"; sessionID: string; fromWorktree: string }

function dragPayload(e: DragEvent): DragPayload | undefined {
  try {
    const raw = e.dataTransfer?.getData("text/plain")
    return raw ? (JSON.parse(raw) as DragPayload) : undefined
  } catch {
    return undefined
  }
}

// Cursor-style persistent left project sidebar. Renders the project chats: one
// collapsible section per project listing that project's sessions, resizable
// and collapsible; the state (open + width) persists per server so it stays put
// across sessions of the same project. The file tree lives on the right side.
// Projects and chats can be dragged to reorder; a chat can be dragged onto
// another project group to move it there (persisted per server).
export function ProjectChatsSidebar() {
  const layout = useLayout()
  const serverSync = useServerSync()
  const serverSDK = useServerSDK()
  const server = useServer()
  const tabs = useTabs()
  const language = useLanguage()
  const params = useParams<{ id?: string }>()
  const isDesktop = createMediaQuery("(min-width: 768px)")

  const expanded = createMemo(() => isDesktop() && layout.projectSidebar.opened())
  const width = createMemo(() => layout.projectSidebar.width())

  // Global root-session index: discovers sessions created from the TUI, CLI, or
  // other opencode endpoints even when their directory is not yet a known project.
  const homeSessions = createMemo(() => serverSync().homeSessions)
  const sessionEventLoad = useQuery(() => ({
    queryKey: homeSessions().eventsKey,
    queryFn: async (): Promise<HomeSessionEvents> => ({ sequence: 0, entries: [] }),
    initialData: { sequence: 0, entries: [] } satisfies HomeSessionEvents,
    enabled: false,
  }))
  const sessionLoad = useQuery(() => ({
    queryKey: homeSessions().indexKey,
    enabled: !!serverSDK().client,
    queryFn: async ({ signal }) => {
      const cache = homeSessions()
      const eventSequence = cache.eventSequence()
      const index = await loadHomeSessionIndex(
        (input, options) => serverSDK().client.v2.session.list(input, options),
        eventSequence,
        signal,
      )
      cache.complete(eventSequence)
      return index
    },
    retry: false,
    staleTime: 30_000,
    refetchOnMount: true,
    refetchOnReconnect: true,
  }))

  // Auto-reimport: open a project (and load its sessions) whenever a root session
  // exists in a directory that is not yet in the known project list.
  createEffect(() => {
    const known = new Set(
      layout.projects
        .list()
        .flatMap((project) => [project.worktree, ...(project.sandboxes ?? [])])
        .map(pathKey),
    )
    const sessions = homeSessions().sessions(sessionLoad.data, sessionEventLoad.data)
    for (const session of sessions) {
      if (session.parentID) continue
      if (session.time?.archived) continue
      if (known.has(pathKey(session.directory))) continue
      layout.projects.open(session.directory)
    }
  })

  const projectByDirectory = (directory: string | undefined) => {
    if (!directory) return
    for (const project of layout.projects.list()) {
      if ([project.worktree, ...(project.sandboxes ?? [])].some((dir) => pathKey(dir) === pathKey(directory)))
        return project.worktree
    }
  }

  const groups = createMemo(() => {
    const sessionInfo = serverSync().session.data.info
    return layout.projects
      .list()
      .map((project) => {
        const directories = [project.worktree, ...(project.sandboxes ?? [])]
        const seen = new Set<string>()
        const sessions: Session[] = []
        for (const directory of directories) {
          const [store] = serverSync().child(directory, { bootstrap: false })
          for (const session of store.session ?? []) {
            if (session.parentID) continue
            if (session.time?.archived) continue
            if (seen.has(session.id)) continue
            seen.add(session.id)
            const movedTo = layout.projectChats.project(session.id)
            if (movedTo && movedTo !== project.worktree) continue
            sessions.push(session)
          }
        }
        // Include chats that were explicitly moved into this project from elsewhere.
        for (const session of Object.values(sessionInfo)) {
          if (!session) continue
          if (session.parentID) continue
          if (session.time?.archived) continue
          if (seen.has(session.id)) continue
          if (layout.projectChats.project(session.id) === project.worktree) {
            seen.add(session.id)
            sessions.push(session)
          }
        }
        return { project, sessions: applyOrder(sessions, layout.projectChats.order(project.worktree)) }
      })
      .filter((group) => group.sessions.length > 0)
  })

  const orderedIds = (worktree: string) =>
    groups().find((group) => group.project.worktree === worktree)?.sessions.map((session) => session.id) ?? []

  const isWorking = (sessionID: string) => serverSync().session.data.session_working(sessionID)

  const openChat = (session: Session) => {
    const tab = tabs.addSessionTab({ server: server.key, sessionId: session.id })
    tabs.select(tab)
  }

  const newChat = (project: LocalProject) => {
    void tabs.newDraft({ server: server.key, directory: project.worktree, worktree: project.worktree })
  }

  const openNewChat = () => {
    const id = params.id
    const info = id ? serverSync().session.data.info[id] : undefined
    const directory =
      info?.directory ??
      groups().find((group) => group.sessions.some((session) => session.id === id))?.project.worktree ??
      layout.projects.list()[0]?.worktree
    if (!directory) return
    void tabs.newDraft({ server: server.key, directory })
  }

  const moveProject = (worktree: string, toIndex: number) => {
    layout.projects.move(worktree, toIndex)
  }

  const dropProjectOn = (dragged: string, targetWorktree: string) => {
    if (dragged === targetWorktree) return
    const targetIndex = layout.projects.list().findIndex((project) => project.worktree === targetWorktree)
    if (targetIndex !== -1) moveProject(dragged, targetIndex)
  }

  const moveChat = (sessionID: string, fromWorktree: string, targetWorktree: string, beforeID?: string) => {
    if (sessionID === beforeID && fromWorktree === targetWorktree) return
    const base = projectByDirectory(serverSync().session.data.info[sessionID]?.directory)
    const effectiveTarget = base === targetWorktree ? undefined : targetWorktree
    layout.projectChats.setProject(sessionID, effectiveTarget)

    if (fromWorktree === targetWorktree) {
      const next = orderedIds(fromWorktree).filter((id) => id !== sessionID)
      const at = beforeID ? next.indexOf(beforeID) : -1
      if (at !== -1) next.splice(at, 0, sessionID)
      else next.push(sessionID)
      layout.projectChats.setOrder(fromWorktree, next)
      return
    }

    if (layout.projectChats.order(fromWorktree).includes(sessionID)) {
      layout.projectChats.setOrder(
        fromWorktree,
        layout.projectChats.order(fromWorktree).filter((id) => id !== sessionID),
      )
    }
    const target = orderedIds(targetWorktree).filter((id) => id !== sessionID)
    const at = beforeID ? target.indexOf(beforeID) : -1
    if (at !== -1) target.splice(at, 0, sessionID)
    else target.push(sessionID)
    layout.projectChats.setOrder(targetWorktree, target)
  }

  return (
    <Show
      when={expanded()}
      fallback={
        <div class="flex flex-col items-center py-2 w-10 shrink-0 self-stretch my-2 ml-2 rounded-[10px] overflow-hidden bg-v2-background-bg-base shadow-[var(--v2-elevation-raised)]">
          <TooltipV2 placement="right" value={language.t("projectSidebar.chats")}>
            <IconButtonV2
              type="button"
              variant="ghost-muted"
              size="normal"
              icon={<IconV2 name="chat" />}
              onClick={() => layout.projectSidebar.open()}
              aria-label={language.t("projectSidebar.chats")}
            />
          </TooltipV2>
        </div>
      }
    >
      <div
        id="project-chats-sidebar"
        class="relative flex h-full min-h-0 flex-col shrink-0 my-2 ml-2 rounded-[10px] overflow-hidden bg-v2-background-bg-base shadow-[var(--v2-elevation-raised)]"
        style={{ width: `${width()}px` }}
      >
        <div class="flex items-center gap-1 px-3 h-10 shrink-0 border-b border-v2-border-border-base">
          <span class="flex-1 min-w-0 text-12-medium text-v2-text-text-base truncate">
            {language.t("projectSidebar.chats")}
          </span>
          <TooltipV2 placement="bottom" value={language.t("command.session.new")}>
            <IconButtonV2
              type="button"
              variant="ghost-muted"
              size="small"
              icon={<IconV2 name="plus" />}
              onClick={openNewChat}
              aria-label={language.t("command.session.new")}
            />
          </TooltipV2>
          <TooltipV2 placement="bottom" value={language.t("projectSidebar.collapse")}>
            <IconButtonV2
              type="button"
              variant="ghost-muted"
              size="small"
              icon={<IconV2 name="collapse" />}
              onClick={() => layout.projectSidebar.close()}
              aria-label={language.t("projectSidebar.collapse")}
            />
          </TooltipV2>
        </div>
        <div class="flex-1 min-h-0 overflow-hidden">
          <div class="h-full overflow-y-auto py-2">
            <Show when={groups().length > 0} fallback={<EmptyState language={language} />}>
              <For each={groups()}>
                {(group) => (
                  <ProjectChatGroup
                    project={group.project}
                    sessions={group.sessions}
                    activeSessionID={params.id}
                    isWorking={isWorking}
                    language={language}
                    onToggle={() => {
                      if (group.project.expanded) layout.projects.collapse(group.project.worktree)
                      else layout.projects.expand(group.project.worktree)
                    }}
                    onOpen={openChat}
                    onNewChat={() => newChat(group.project)}
                    onDropProject={(draggedWorktree) => dropProjectOn(draggedWorktree, group.project.worktree)}
                    onMoveChat={(sessionID, fromWorktree, beforeID) =>
                      moveChat(sessionID, fromWorktree, group.project.worktree, beforeID)
                    }
                  />
                )}
              </For>
            </Show>
          </div>
        </div>
        <ResizeHandle
          direction="horizontal"
          edge="end"
          size={width()}
          min={PROJECT_SIDEBAR_MIN}
          max={PROJECT_SIDEBAR_MAX}
          onResize={(width) => layout.projectSidebar.resize(width)}
          onCollapse={() => layout.projectSidebar.close()}
        />
      </div>
    </Show>
  )
}

function applyOrder(sessions: Session[], order: string[]) {
  const byID = new Map(sessions.map((session) => [session.id, session]))
  const ordered = order.map((id) => byID.get(id)).filter((session): session is Session => !!session)
  const seen = new Set(ordered.map((session) => session.id))
  const rest = sessions
    .filter((session) => !seen.has(session.id))
    .sort(
      (a, b) => (b.time.updated ?? b.time.created) - (a.time.updated ?? a.time.created) || a.id.localeCompare(b.id),
    )
  return [...ordered, ...rest]
}

function ProjectChatGroup(props: {
  project: LocalProject
  sessions: Session[]
  activeSessionID: string | undefined
  isWorking: (sessionID: string) => boolean
  language: ReturnType<typeof useLanguage>
  onToggle: () => void
  onOpen: (session: Session) => void
  onNewChat: () => void
  onDropProject: (draggedWorktree: string) => void
  onMoveChat: (sessionID: string, fromWorktree: string, beforeID?: string) => void
}) {
  const title = createMemo(() => displayName(props.project))
  const [showAll, setShowAll] = createSignal(false)
  createEffect(() => {
    if (!props.project.expanded) setShowAll(false)
  })
  const visibleSessions = createMemo(() => {
    if (showAll()) return props.sessions
    return props.sessions.slice(0, PROJECT_CHATS_PREVIEW)
  })
  const hasMore = createMemo(() => props.sessions.length > PROJECT_CHATS_PREVIEW)
  const remaining = createMemo(() => props.sessions.length - PROJECT_CHATS_PREVIEW)
  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        const payload = dragPayload(e)
        if (payload?.kind === "chat") props.onMoveChat(payload.sessionID, payload.fromWorktree)
      }}
    >
      <div class="group/project flex items-center">
        <button
          type="button"
          draggable
          onDragStart={(e) => {
            e.dataTransfer?.setData("text/plain", JSON.stringify({ kind: "project", worktree: props.project.worktree }))
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
            const payload = dragPayload(e)
            if (payload?.kind === "project") props.onDropProject(payload.worktree)
            else if (payload?.kind === "chat") props.onMoveChat(payload.sessionID, payload.fromWorktree)
          }}
          class="flex min-w-0 flex-1 items-center gap-1.5 px-3 py-1.5 text-left text-12-medium text-v2-text-text-base hover:bg-v2-overlay-simple-overlay-hover cursor-grab active:cursor-grabbing"
          onClick={props.onToggle}
          aria-expanded={props.project.expanded}
        >
          <IconV2
            name="chevron-down"
            size="small"
            classList={{ "rotate-[-90deg]": !props.project.expanded, "transition-transform": true }}
          />
          <span class="min-w-0 flex-1 truncate">{title()}</span>
          <span class="shrink-0 text-11-regular text-v2-text-text-faint">{props.sessions.length}</span>
        </button>
        <TooltipV2 placement="top" value={props.language.t("command.session.new")}>
          <IconButtonV2
            type="button"
            variant="ghost-muted"
            size="small"
            icon={<IconV2 name="plus" />}
            aria-label={props.language.t("command.session.new")}
            classList={{ "invisible group-hover/project:visible": true }}
            onClick={props.onNewChat}
          />
        </TooltipV2>
      </div>
      <Show when={props.project.expanded}>
        <For each={visibleSessions()}>
          {(session) => (
            <button
              type="button"
              draggable
              onDragStart={(e) => {
                e.dataTransfer?.setData(
                  "text/plain",
                  JSON.stringify({ kind: "chat", sessionID: session.id, fromWorktree: props.project.worktree }),
                )
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const payload = dragPayload(e)
                if (payload?.kind !== "chat") return
                props.onMoveChat(payload.sessionID, payload.fromWorktree, session.id)
              }}
              class="flex w-full items-center gap-1.5 py-1 pl-7 pr-3 text-left text-13-regular text-v2-text-text-muted hover:bg-v2-overlay-simple-overlay-hover cursor-grab active:cursor-grabbing"
              classList={{
                "bg-v2-overlay-simple-overlay-hover text-v2-text-text-base": session.id === props.activeSessionID,
              }}
              onClick={() => props.onOpen(session)}
            >
              <Show when={props.isWorking(session.id)}>
                <RunningDots class="shrink-0 text-v2-icon-icon-accent" />
              </Show>
              <span class="min-w-0 flex-1 truncate">{sessionTitle(session.title) || session.id}</span>
            </button>
          )}
        </For>
        <Show when={hasMore()}>
          <button
            type="button"
            class="flex w-full items-center gap-1.5 py-1 pl-7 pr-3 text-left text-12-regular text-v2-text-text-muted hover:text-v2-text-text-base"
            onClick={() => setShowAll((value) => !value)}
            aria-expanded={showAll()}
          >
            <IconV2
              name="chevron-down"
              size="small"
              classList={{ "rotate-[-90deg]": showAll(), "transition-transform": true }}
            />
            <span class="min-w-0 flex-1 truncate">
              {props.language.t(
                showAll() ? "projectSidebar.showLess" : "projectSidebar.showMore",
                { count: remaining() },
              )}
            </span>
          </button>
        </Show>
      </Show>
    </div>
  )
}

function EmptyState(props: { language: ReturnType<typeof useLanguage> }) {
  return (
    <div class="px-3 py-2 text-12-regular text-v2-text-text-faint">{props.language.t("sidebar.empty.title")}</div>
  )
}
