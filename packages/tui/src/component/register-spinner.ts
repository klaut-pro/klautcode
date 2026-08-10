import { getComponentCatalogue } from "@opentui/solid/components"
import { registerSpinner } from "opentui-spinner/solid"

export function registerKlautcodeSpinner() {
  if (!getComponentCatalogue().spinner) registerSpinner()
}
