export * as Quota from "./quota"

import { Context, Effect, Layer, Ref } from "effect"
import { makeGlobalNode } from "./effect/app-node"
import { ModelV2 } from "./model"
import { ProviderV2 } from "./provider"

/** TTL after which a quota-exhausted model is eligible for selection again. */
export const QUOTA_TTL_MS = 60 * 60_000

const store = Ref.makeUnsafe(new Map<string, number>())

function quotaKey(providerID: ProviderV2.ID, modelID: ModelV2.ID) {
  return `${ProviderV2.ID.make(providerID)}/${ModelV2.ID.make(modelID)}`
}

/** Synchronously checks whether a model is currently out-of-quota. */
export function isExhaustedSync(providerID: ProviderV2.ID, modelID: ModelV2.ID): boolean {
  const timestamp = store.ref.current.get(quotaKey(providerID, modelID))
  return timestamp !== undefined && Date.now() - timestamp < QUOTA_TTL_MS
}

/** Synchronously records quota exhaustion for a model. */
export function recordExhaustionSync(providerID: ProviderV2.ID, modelID: ModelV2.ID): void {
  store.ref.current = new Map(store.ref.current).set(quotaKey(providerID, modelID), Date.now())
}

/** Clears all recorded quota exhaustion state (testing / admin). */
export function resetSync(): void {
  store.ref.current = new Map()
}

export interface Interface {
  /** Marks a model as out-of-quota so it is skipped during model selection. */
  readonly recordExhaustion: (providerID: ProviderV2.ID, modelID: ModelV2.ID) => Effect.Effect<void>
  /** Returns `true` when the model is currently out-of-quota and within the TTL window. */
  readonly isExhausted: (providerID: ProviderV2.ID, modelID: ModelV2.ID) => Effect.Effect<boolean>
  /** Clears all recorded quota exhaustion state (testing / admin). */
  readonly reset: () => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@klautcode/v2/Quota") {}

const layer = Layer.succeed(
  Service,
  Service.of({
    recordExhaustion: (providerID, modelID) => Effect.sync(() => recordExhaustionSync(providerID, modelID)),
    isExhausted: (providerID, modelID) => Effect.sync(() => isExhaustedSync(providerID, modelID)),
    reset: () => Effect.sync(() => resetSync()),
  }),
)

export const node = makeGlobalNode({ service: Service, layer, deps: [] })