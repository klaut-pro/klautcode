import { IconButtonV2 } from "@klautcode/ui/v2/icon-button-v2"
import { KeybindV2 } from "@klautcode/ui/v2/keybind-v2"
import { TooltipV2 } from "@klautcode/ui/v2/tooltip-v2"
import { useLanguage } from "@/context/language"
import { useDesignMode } from "./controller"

export function DesignModeButton() {
  const design = useDesignMode()
  const language = useLanguage()
  return (
    <TooltipV2
      placement="top"
      value={
        <>
          {language.t("designMode.title")}
          <KeybindV2 keys={["Mod", "Shift", "D"]} variant="neutral" />
        </>
      }
    >
      <IconButtonV2
        data-action="prompt-design-mode"
        type="button"
        variant={design.active() ? "contrast" : "ghost-muted"}
        size="large"
        aria-pressed={design.active()}
        aria-label={language.t("designMode.title")}
        icon={<DesignModeIcon />}
        onClick={() => {
          if (design.active()) design.exit()
          else void design.enter()
        }}
      />
    </TooltipV2>
  )
}

function DesignModeIcon() {
  return (
    <svg class="size-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M1.2 1.2 L13 3.4 L3.4 13 Z" />
      <path d="M1.2 1.2 L7.4 7.4" />
    </svg>
  )
}