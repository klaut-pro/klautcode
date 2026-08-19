import type { ReferenceDraft } from "../effect/reference.ts"
import type { Hooks } from "./registration.ts"

export type { ReferenceDraft }

export type ReferenceHooks = Hooks<{
  transform: ReferenceDraft
}>
