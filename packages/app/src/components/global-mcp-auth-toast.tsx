import { createEffect, createMemo } from "solid-js"
import { useLanguage } from "@/context/language"
import { useSync } from "@/context/sync"
import { dismissToast, showToast } from "@/utils/toast"

// Module-level so the registry survives the per-directory `keyed` remounts of this
// component: the draft route re-creates the DirectoryDataProvider subtree while the
// draft's server/directory resolve, which would otherwise reset a component-scoped
// map and dismiss a toast the moment it was shown. Global auth-needed MCPs are
// identical across directories, so one shared registry is correct.
const activeToasts = new Map<string, number>()

/**
 * Fires a persistent bottom-right toast when a GLOBAL-scope MCP server needs
 * authentication. The in-session `SessionMcpAuthDock` only surfaces project-scope
 * auth servers (it filters `scope === "project"`), so global auth-needed servers
 * were previously only reflected by a silent titlebar accent dot.
 */
export function GlobalMcpAuthToast() {
  const language = useLanguage()
  const sync = useSync()

  const authServers = createMemo(() => {
    const mcp = sync().data.mcp ?? {}
    return Object.entries(mcp)
      .filter(([, server]) =>
        server.scope === "global" &&
        (server.status === "needs_auth" || server.status === "needs_client_registration"),
      )
      .map(([name]) => name)
      .sort((a, b) => a.localeCompare(b))
  })

  createEffect(() => {
    const names = authServers()
    for (const [name, id] of activeToasts) if (!names.includes(name)) {
      dismissToast(id)
      activeToasts.delete(name)
    }
    for (const name of names) {
      if (activeToasts.has(name)) continue
      const id = showToast({
        persistent: true,
        icon: "warning",
        title: language.t("mcp.auth.needsAuthentication", { name }),
        description: language.t("mcp.auth.clickToAuthenticate"),
      })
      if (id !== undefined) activeToasts.set(name, id)
    }
  })

  return null
}