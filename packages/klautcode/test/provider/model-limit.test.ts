import { describe, expect, test } from "bun:test"
import type { ModelsDev } from "@klautcode/core/models-dev"
import { fromModelsDevProvider } from "@/provider/provider"

const provider = (models: Record<string, unknown>): ModelsDev.Provider =>
  ({
    id: "poolside",
    name: "Poolside",
    env: ["POOLSIDE_API_KEY"],
    api: "https://inference.poolside.ai/v1",
    models,
  }) as ModelsDev.Provider

const laguna = (context: number) => ({
  id: "poolside/laguna-m.1",
  name: "Laguna M.1",
  family: "laguna",
  tool_call: true,
  reasoning: true,
  limit: { context, output: 32768 },
})

describe("fromModelsDevProvider", () => {
  test("caps over-advertised Poolside Laguna context at the real 256K limit", () => {
    const info = fromModelsDevProvider(provider({ "poolside/laguna-m.1": laguna(1_000_000) }))
    const model = info.models["poolside/laguna-m.1"]
    expect(model.limit.context).toBe(262144)
  })

  test("also caps the input limit for over-advertised Laguna models", () => {
    const model = laguna(1_000_000) as Record<string, unknown> & { limit: { context: number; input?: number; output: number } }
    model.limit.input = 1_000_000
    const info = fromModelsDevProvider(provider({ "poolside/laguna-m.1": model }))
    expect(info.models["poolside/laguna-m.1"].limit.context).toBe(262144)
    expect(info.models["poolside/laguna-m.1"].limit.input).toBe(262144)
  })

  test("leaves accurate non-Laguna limits untouched", () => {
    const info = fromModelsDevProvider(
      provider({
        "poolside/laguna-m.1": laguna(262144),
        "other/provider": { id: "other/model", name: "Other", family: "x", limit: { context: 128_000, output: 16_000 } },
      }),
    )
    expect(info.models["poolside/laguna-m.1"].limit.context).toBe(262144)
    expect(info.models["other/provider"].limit.context).toBe(128_000)
  })
})