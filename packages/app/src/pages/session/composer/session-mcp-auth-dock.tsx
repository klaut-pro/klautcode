import { Button } from "@klautcode/ui/button"
import { Icon } from "@klautcode/ui/icon"
import { useLanguage } from "@/context/language"
import { useMcpToggle } from "@/context/mcp"

export function SessionMcpAuthDock(props: { name: string }) {
  const language = useLanguage()
  const toggleMcp = useMcpToggle()

  return (
    <div data-component="mcp-auth-card">
      <div data-slot="mcp-auth-row">
        <span data-slot="mcp-auth-icon">
          <Icon name="warning" size="normal" />
        </span>
        <div data-slot="mcp-auth-title">{language.t("mcp.auth.needsAuthentication", { name: props.name })}</div>
      </div>
      <div data-slot="mcp-auth-actions">
        <Button
          variant="primary"
          size="normal"
          disabled={toggleMcp.isPending && toggleMcp.variables === props.name}
          onClick={() => toggleMcp.mutate(props.name)}
        >
          {language.t("mcp.auth.authenticate")}
        </Button>
      </div>
    </div>
  )
}