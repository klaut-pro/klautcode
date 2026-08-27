import { describe, expect, test } from "bun:test"
import { defaultModelIDs, sort } from "./provider"

type TestModel = { id: string; cost?: { input: number; output: number } }

describe("sort", () => {
  test("promotes free models (cost.input === 0) above paid models", () => {
    const models: TestModel[] = [
      { id: "gpt-4", cost: { input: 5, output: 10 } },
      { id: "gpt-4o-mini", cost: { input: 0, output: 0 } },
    ]
    const [first] = sort(models)
    expect(first.id).toBe("gpt-4o-mini")
  })

  test("a free model outranks the highest priority-index paid model", () => {
    const models: TestModel[] = [
      { id: "gemini-3-pro", cost: { input: 2, output: 8 } },
      { id: "free-thing", cost: { input: 0, output: 0 } },
    ]
    const [first] = sort(models)
    expect(first.id).toBe("free-thing")
  })

  test("paid-only ordering is unchanged when no free models are present", () => {
    const models: TestModel[] = [
      { id: "gpt-5", cost: { input: 5, output: 10 } },
      { id: "claude-sonnet-4", cost: { input: 3, output: 15 } },
      { id: "gemini-3-pro", cost: { input: 2, output: 8 } },
    ]
    expect(sort(models).map((m) => m.id)).toEqual(["gemini-3-pro", "claude-sonnet-4", "gpt-5"])
  })

  test("models without a cost field are treated as non-free", () => {
    const models: TestModel[] = [
      { id: "no-cost" },
      { id: "paid-a", cost: { input: 1, output: 1 } },
      { id: "free-b", cost: { input: 0, output: 0 } },
    ]
    const result = sort(models)
    expect(result.map((m) => m.id)).toEqual(["free-b", "paid-a", "no-cost"])
  })

  test("free models precede paid models regardless of input ordering", () => {
    const models: TestModel[] = [
      { id: "free-thing", cost: { input: 0, output: 0 } },
      { id: "big-pickle", cost: { input: 9, output: 9 } },
    ]
    const result = sort(models)
    expect(result[0].id).toBe("free-thing")
  })

  test("returns an empty array when given no models", () => {
    expect(sort([])).toEqual([])
  })

  test("a single free model is returned as-is", () => {
    const models: TestModel[] = [{ id: "only-free", cost: { input: 0, output: 0 } }]
    expect(sort(models).map((m) => m.id)).toEqual(["only-free"])
  })
})

describe("defaultModelIDs", () => {
  test("selects a free model as the default when one is available", () => {
    const providers = {
      openai: {
        models: {
          "gpt-4": { id: "gpt-4", cost: { input: 5, output: 10 } },
          "gpt-4o-mini": { id: "gpt-4o-mini", cost: { input: 0, output: 0 } },
        },
      },
    }
    const defaults = defaultModelIDs(providers)
    expect(defaults.openai).toBe("gpt-4o-mini")
  })

  test("falls back to priority ordering when no free models exist", () => {
    const providers = {
      openai: {
        models: {
          "gpt-5": { id: "gpt-5", cost: { input: 5, output: 10 } },
          "claude-sonnet-4": { id: "claude-sonnet-4", cost: { input: 3, output: 15 } },
        },
      },
    }
    const defaults = defaultModelIDs(providers)
    expect(defaults.openai).toBe("claude-sonnet-4")
  })

  test("free model is preferred even over a priority-listed paid model", () => {
    const providers = {
      klautcode: {
        models: {
          "gpt-5": { id: "gpt-5", cost: { input: 5, output: 10 } },
          "Kimi-K2.7-Code": { id: "Kimi-K2.7-Code", cost: { input: 0, output: 0 } },
        },
      },
    }
    const defaults = defaultModelIDs(providers)
    expect(defaults.klautcode).toBe("Kimi-K2.7-Code")
  })
})
