import type { CatalogDraft, CatalogProviderRecord } from "../effect/catalog.ts"
import type { Hooks } from "./registration.ts"

export type { CatalogDraft, CatalogProviderRecord }

export type CatalogHooks = Hooks<{
  transform: CatalogDraft
}>
