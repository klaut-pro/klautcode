import type { SkillDraft } from "../effect/skill.ts"
import type { Hooks } from "./registration.ts"

export type { SkillDraft }

export type SkillHooks = Hooks<{
  transform: SkillDraft
}>
