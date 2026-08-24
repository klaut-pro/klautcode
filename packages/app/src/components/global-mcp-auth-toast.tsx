import { createEffect, createMemo, onCleanup } from "solid-js"
import { useLanguage } from "@/context/language"
import { useSync } from "@/context/sync"
import { dismissToast, showToast } from "@/utils/toast"

/**
 * Fires a persistent bottom-right toast when a GLOBAL-scope MCP server needs
 * authentication. The in-session `SessionMcpAuthDock` only surfaces project-scope
 * auth servers (it filters `scope === "project"`), so global auth-needed servers
 * were previously only reflected by a silent titlebar accent dot.
 */
export function GlobalMcpAuthToast() {
  const language = useLanguage()
  const sync = useSync()

  const authServers = createMemo(() =>
    Object.entries(sync().data.mcp ?? {})
      .filter(([, server]) =>
        server.scope === "global" &&
        (server.status === "needs_auth" || server.status === "needs_client_registration"),
      )
      .map(([name]) => name)
      .sort((a, b) => a.localeCompare(b)),
  )

  // Track the live toast per MCP name so we don't re-fire while it still needs
  // auth, and so we can dismiss when it resolves. A name re-enters the pool if
  // its status leaves the auth set (allowing re-notification if it needs auth again).
  const toasts = new Map<string, number>()

  createEffect(() => {
    const names = authServers()
    for (const [name, id] of toasts) if (!names.includes(name)) {
      dismissToast(id)
      toasts.delete(name)
    }
    for (const name of names) {
      if (toasts.has(name)) continue
      const id = showToast({
        persistent: true,
        icon: "warning",
        title: language.t("mcp.auth.needsAuthentication", { name }),
        description: language.t("mcp.auth.clickToAuthenticate"),
      })
      if (id !== undefined) toasts.set(name, id)
    }
  })

  onCleanup(() => {
    for (const id of toasts.values()) dismissToast(id)
  })

  return null
}
