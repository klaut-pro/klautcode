import { registerCustomTheme } from "@pierre/diffs"
import { KlautcodeTheme } from "./marked-theme"

let registered = false

export function registerKlautcodeTheme() {
  if (registered) return
  registered = true
  registerCustomTheme("Klautcode", () => Promise.resolve(KlautcodeTheme))
}
