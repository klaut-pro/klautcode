import type { NormalizedProviderListResponse } from "@klautcode/session-ui/context"

const emptyProviderCatalog: NormalizedProviderListResponse = { all: new Map(), connected: [], default: {} }

type DirectoryCatalog = {
  ready: boolean
  providers: NormalizedProviderListResponse
}

type ProviderCatalogInput =
  | {
      explicit: true
      directory?: string
      catalog?: DirectoryCatalog
    }
  | {
      explicit: false
      directory?: string
      catalog?: DirectoryCatalog
      global: NormalizedProviderListResponse
    }

export function selectProviderCatalog(input: ProviderCatalogInput) {
  if (input.directory && input.catalog?.ready) return input.catalog.providers
  if (input.explicit) return emptyProviderCatalog
  return input.global
}

// Only the zen tiers (klautcode's zen and opencode zen) offer free models; the
// opencode-go subscription is always paid. Mirror upstream opencode, which only
// marks "opencode" (zen) cost-0 models as free.
export function isFreeModel(provider: string, cost: { input: number } | undefined) {
  return (provider === "klautcode" || provider === "opencode") && (!cost || cost.input === 0)
}
