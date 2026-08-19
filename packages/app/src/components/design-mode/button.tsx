import { IconButtonV2 } from "@klautcode/ui/v2/icon-button-v2"
import { KeybindV2 } from "@klautcode/ui/v2/keybind-v2"
import { TooltipV2 } from "@klautcode/ui/v2/tooltip-v2"
import { useLanguage } from "@/context/language"
import { useDesignMode } from "./controller"
import "./design-mode.css"

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
        variant="ghost-muted"
        size="large"
        aria-pressed={design.active()}
        aria-label={language.t("designMode.title")}
        classList={{ "dm-toggle-active": design.active() }}
        icon={<DesignModeIcon />}
        onClick={() => {
          if (design.active()) design.exit()
          else void design.enter()
        }}
      />
    </TooltipV2>
  )
}

// Lucide `pencil` (ISC): diamond graphite tip, barrel, and cut line.
function DesignModeIcon() {
  return (
    <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
      <path d="m15 5 4 4" />
    </svg>
  )
}