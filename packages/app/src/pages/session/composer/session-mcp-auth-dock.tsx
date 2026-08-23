import { Button } from "@klautcode/ui/button"
import { DockPrompt } from "@klautcode/session-ui/dock-prompt"
import { Icon } from "@klautcode/ui/icon"
import { useLanguage } from "@/context/language"
import { useMcpToggle } from "@/context/mcp"

export function SessionMcpAuthDock(props: { name: string }) {
  const language = useLanguage()
  const toggleMcp = useMcpToggle()

  return (
    <DockPrompt
      kind="mcp"
      header={
        <div data-slot="mcp-row" data-variant="header">
          <span data-slot="mcp-icon">
            <Icon name="warning" size="normal" />
          </span>
          <div data-slot="mcp-header-title">{language.t("mcp.auth.needsAuthentication", { name: props.name })}</div>
        </div>
      }
      footer={
        <>
          <div />
          <div data-slot="mcp-footer-actions">
            <Button
              variant="primary"
              size="normal"
              disabled={toggleMcp.isPending && toggleMcp.variables === props.name}
              onClick={() => toggleMcp.mutate(props.name)}
            >
              {language.t("mcp.auth.authenticate")}
            </Button>
          </div>
        </>
      }
    />
  )
}