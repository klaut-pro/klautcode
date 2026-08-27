import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { ModelV2 } from "@klautcode/core/model"
import { ProviderV2 } from "@klautcode/core/provider"
import { Quota } from "@klautcode/core/quota"
import { AppNodeBuilder } from "@klautcode/core/effect/app-node-builder"
import { LayerNode } from "@klautcode/core/effect/layer-node"
import { testEffect } from "./lib/effect"

const quotaLayer = AppNodeBuilder.build(LayerNode.group([Quota.node]), [])
const it = testEffect(quotaLayer)

const provider = ProviderV2.ID.make("test-provider")
const model = ModelV2.ID.make("test-model")
const otherModel = ModelV2.ID.make("other-model")

describe("Quota", () => {
  it.effect("isExhausted returns false for unrecorded models", () =>
    Effect.gen(function* () {
      Quota.resetSync()
      const service = yield* Quota.Service
      const result = yield* service.isExhausted(provider, model)
      expect(result).toBe(false)
    }),
  )

  it.effect("recordExhaustion marks a model as exhausted", () =>
    Effect.gen(function* () {
      Quota.resetSync()
      const service = yield* Quota.Service
      yield* service.recordExhaustion(provider, model)
      const result = yield* service.isExhausted(provider, model)
      expect(result).toBe(true)
    }),
  )

  it.effect("recordExhaustion is scoped to the specific model", () =>
    Effect.gen(function* () {
      Quota.resetSync()
      const service = yield* Quota.Service
      yield* service.recordExhaustion(provider, model)
      const otherResult = yield* service.isExhausted(provider, otherModel)
      expect(otherResult).toBe(false)
    }),
  )

  it.effect("recordExhaustion is scoped to the specific provider", () =>
    Effect.gen(function* () {
      Quota.resetSync()
      const otherProvider = ProviderV2.ID.make("other-provider")
      const service = yield* Quota.Service
      yield* service.recordExhaustion(provider, model)
      const otherResult = yield* service.isExhausted(otherProvider, model)
      expect(otherResult).toBe(false)
    }),
  )

  it.effect("reset clears all exhaustion state", () =>
    Effect.gen(function* () {
      Quota.resetSync()
      const service = yield* Quota.Service
      yield* service.recordExhaustion(provider, model)
      yield* service.reset()
      const result = yield* service.isExhausted(provider, model)
      expect(result).toBe(false)
    }),
  )

  it.effect("sync functions match async service behavior", () =>
    Effect.gen(function* () {
      Quota.resetSync()
      const service = yield* Quota.Service
      Quota.recordExhaustionSync(provider, model)
      const syncResult = Quota.isExhaustedSync(provider, model)
      const asyncResult = yield* service.isExhausted(provider, model)
      expect(syncResult).toBe(true)
      expect(asyncResult).toBe(true)
    }),
  )
})