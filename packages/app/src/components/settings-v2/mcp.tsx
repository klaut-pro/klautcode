import { For, Show, createMemo, type Component } from "solid-js"
import { Switch } from "@klautcode/ui/v2/switch-v2"
import { useLanguage } from "@/context/language"
import { useSync } from "@/context/sync"
import { useMcpToggle } from "@/context/mcp"
import { SettingsListV2 } from "./parts/list"
import { SettingsRowV2 } from "./parts/row"
import "./settings-v2.css"

function statusDescription(language: ReturnType<typeof useLanguage>, status: string | undefined) {
  switch (status) {
    case "connected":
      return language.t("mcp.status.connected")
    case "failed":
      return language.t("mcp.status.failed")
    case "needs_auth":
    case "needs_client_registration":
      return language.t("mcp.status.needs_auth")
    case "disabled":
      return language.t("mcp.status.disabled")
    default:
      return language.t("mcp.status.disconnected")
  }
}

export const SettingsMcpV2: Component = () => {
  const language = useLanguage()
  const sync = useSync()
  const toggleMcp = useMcpToggle()
  const names = createMemo(() => Object.keys(sync().data.mcp ?? {}).sort((a, b) => a.localeCompare(b)))
  const status = (name: string) => sync().data.mcp?.[name]?.status

  return (
    <>
      <div class="settings-v2-tab-header">
        <h2 class="settings-v2-tab-title">{language.t("settings.tab.mcp")}</h2>
      </div>
      <div class="settings-v2-tab-body">
        <div class="settings-v2-section">
          <SettingsListV2>
            <Show
              when={names().length > 0}
              fallback={
                <SettingsRowV2 title={language.t("dialog.mcp.empty")} description={""}>
                  <span />
                </SettingsRowV2>
              }
            >
              <For each={names()}>
                {(name) => (
                  <SettingsRowV2 title={name} description={statusDescription(language, status(name))}>
                    <Switch
                      checked={status(name) === "connected"}
                      disabled={toggleMcp.isPending && toggleMcp.variables === name}
                      onChange={() => {
                        if (toggleMcp.isPending) return
                        toggleMcp.mutate(name)
                      }}
                    />
                  </SettingsRowV2>
                )}
              </For>
            </Show>
          </SettingsListV2>
        </div>
      </div>
    </>
  )
}
