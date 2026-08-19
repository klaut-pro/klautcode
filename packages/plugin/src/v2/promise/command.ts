import type { CommandDraft } from "../effect/command.ts"
import type { Hooks } from "./registration.ts"

export type { CommandDraft }

export type CommandHooks = Hooks<{
  transform: CommandDraft
}>
