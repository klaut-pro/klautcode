import { DottedWordmark } from "./dotted-wordmark"
import { ThinkingOrbs } from "./thinking-orbs"

// Start-screen visual: animated ThinkingOrbs above a dense dotted "klautcode"
// wordmark. Rendered in place of the block logo on the home route.
export function StartLogo() {
  return (
    <box flexDirection="column" alignItems="center">
      <ThinkingOrbs />
      <DottedWordmark />
    </box>
  )
}
