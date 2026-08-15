import { Component, createMemo } from "solid-js"
import type {
  PermissionActionConfig,
  PermissionConfig,
  PermissionRuleConfig,
} from "@klautcode/sdk/v2/client"
import { SelectV2 } from "@klautcode/ui/v2/select-v2"
import { useLanguage } from "@/context/language"
import { useServerSync } from "@/context/server-sync"
import { showToast } from "@/utils/toast"
import { SettingsListV2 } from "./parts/list"
import { SettingsRowV2 } from "./parts/row"
import "./settings-v2.css"

type PermissionAction = PermissionActionConfig
type PermissionMap = Record<string, PermissionRuleConfig | PermissionActionConfig | undefined>

const ACTIONS: ReadonlyArray<{ value: PermissionAction; label: string }> = [
  { value: "allow", label: "settings.permissions.action.allow" },
  { value: "ask", label: "settings.permissions.action.ask" },
  { value: "deny", label: "settings.permissions.action.deny" },
]

const VALID_ACTIONS: Record<string, PermissionAction | undefined> = {
  allow: "allow",
  ask: "ask",
  deny: "deny",
}

const ITEMS = [
  { id: "read", title: "settings.permissions.tool.read.title", description: "settings.permissions.tool.read.description" },
  { id: "edit", title: "settings.permissions.tool.edit.title", description: "settings.permissions.tool.edit.description" },
  { id: "glob", title: "settings.permissions.tool.glob.title", description: "settings.permissions.tool.glob.description" },
  { id: "grep", title: "settings.permissions.tool.grep.title", description: "settings.permissions.tool.grep.description" },
  { id: "list", title: "settings.permissions.tool.list.title", description: "settings.permissions.tool.list.description" },
  { id: "bash", title: "settings.permissions.tool.bash.title", description: "settings.permissions.tool.bash.description" },
  { id: "task", title: "settings.permissions.tool.task.title", description: "settings.permissions.tool.task.description" },
  { id: "skill", title: "settings.permissions.tool.skill.title", description: "settings.permissions.tool.skill.description" },
  { id: "lsp", title: "settings.permissions.tool.lsp.title", description: "settings.permissions.tool.lsp.description" },
  { id: "todowrite", title: "settings.permissions.tool.todowrite.title", description: "settings.permissions.tool.todowrite.description" },
  { id: "webfetch", title: "settings.permissions.tool.webfetch.title", description: "settings.permissions.tool.webfetch.description" },
  { id: "websearch", title: "settings.permissions.tool.websearch.title", description: "settings.permissions.tool.websearch.description" },
  { id: "external_directory", title: "settings.permissions.tool.external_directory.title", description: "settings.permissions.tool.external_directory.description" },
  { id: "doom_loop", title: "settings.permissions.tool.doom_loop.title", description: "settings.permissions.tool.doom_loop.description" },
] as const

function isPermissionMap(value: unknown): value is PermissionMap {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getAction(value: unknown): PermissionAction | undefined {
  if (typeof value !== "string") return undefined
  return VALID_ACTIONS[value]
}

function getRuleDefault(value: unknown): PermissionAction | undefined {
  const action = getAction(value)
  if (action) return action
  if (!isPermissionMap(value)) return undefined
  return getAction(value["*"])
}

function toMap(value: PermissionConfig | undefined): PermissionMap {
  if (typeof value === "string") {
    const action = getAction(value)
    return action ? { "*": action } : {}
  }
  if (!isPermissionMap(value)) return {}
  return value
}

// Global permission controls: every tool can be allowed, asked about, or denied
// by default. Values are written to the global config so they apply across all
// sessions and directories rather than per-session auto-acceptance.
export const SettingsPermissionsV2: Component = () => {
  const language = useLanguage()
  const serverSync = useServerSync()

  const permission = createMemo(() => toMap(serverSync().data.config.permission))

  const actions = createMemo(() =>
    ACTIONS.map((action) => ({ ...action, label: language.t(action.label) })),
  )

  const actionFor = (id: string): PermissionAction => {
    const direct = getRuleDefault(permission()[id])
    if (direct) return direct
    return getRuleDefault(permission()["*"]) ?? "allow"
  }

  const setPermission = async (id: string, action: PermissionAction) => {
    const before = serverSync().data.config.permission
    const map = toMap(before)
    const existing = map[id]

    const nextValue = isPermissionMap(existing) ? { ...existing, "*": action } : action

    const nextPermission: PermissionConfig = { ...map, [id]: nextValue }

    const rollback = (err: unknown) => {
      serverSync().set("config", "permission", before)
      const message = err instanceof Error ? err.message : String(err)
      showToast({
        variant: "error",
        title: language.t("settings.permissions.toast.updateFailed.title"),
        description: message,
      })
    }

    serverSync().set("config", "permission", nextPermission)
    serverSync().updateConfig({ permission: nextPermission }).catch(rollback)
  }

  return (
    <>
      <div class="settings-v2-tab-header">
        <h2 class="settings-v2-tab-title">{language.t("settings.permissions.title")}</h2>
      </div>
      <div class="settings-v2-tab-body">
        <div class="settings-v2-section">
          <h3 class="settings-v2-section-title">{language.t("settings.permissions.section.tools")}</h3>
          <SettingsListV2>
            {ITEMS.map((item) => (
              <SettingsRowV2 title={language.t(item.title)} description={language.t(item.description)}>
                <SelectV2
                  appearance="inline"
                  data-action={`settings-permissions-${item.id}`}
                  options={actions()}
                  current={actions().find((option) => option.value === actionFor(item.id))}
                  placement="bottom-end"
                  gutter={6}
                  value={(option) => option.value}
                  label={(option) => option.label}
                  onSelect={(option) => option && setPermission(item.id, option.value)}
                />
              </SettingsRowV2>
            ))}
          </SettingsListV2>
        </div>
      </div>
    </>
  )
}
