import type { AgentDraft } from "../effect/agent.ts"
import type { Hooks } from "./registration.ts"

export type { AgentDraft }

export type AgentHooks = Hooks<{
  transform: AgentDraft
}>
