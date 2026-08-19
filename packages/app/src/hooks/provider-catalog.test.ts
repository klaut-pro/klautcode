import { describe, expect, test } from "bun:test"
import type { NormalizedProviderListResponse } from "@klautcode/session-ui/context"
import { isFreeModel, selectProviderCatalog } from "./provider-catalog"

const catalog = (id: string): NormalizedProviderListResponse => ({
  all: new Map([[id, { id, name: id, source: "api", env: [], options: {}, models: {} }]]),
  connected: [id],
  default: { [id]: `${id}-model` },
})

test("selects the ready catalog for an explicit directory", () => {
  const directory = catalog("directory")

  expect(
    selectProviderCatalog({
      explicit: true,
      directory: "/repo",
      catalog: { ready: true, providers: directory },
    }),
  ).toBe(directory)
})

test("returns an empty catalog while an explicit directory is unresolved", () => {
  expect(selectProviderCatalog({ explicit: true })).toEqual({ all: new Map(), connected: [], default: {} })
  expect(
    selectProviderCatalog({
      explicit: true,
      directory: "/repo",
      catalog: { ready: false, providers: catalog("directory") },
    }),
  ).toEqual({ all: new Map(), connected: [], default: {} })
})

test("uses the route catalog when it is ready", () => {
  const directory = catalog("directory")

  expect(
    selectProviderCatalog({
      explicit: false,
      directory: "/repo",
      catalog: { ready: true, providers: directory },
      global: catalog("global"),
    }),
  ).toBe(directory)
})

test("falls back to the global catalog for route consumers", () => {
  const global = catalog("global")

  expect(selectProviderCatalog({ explicit: false, global })).toBe(global)
  expect(
    selectProviderCatalog({
      explicit: false,
      directory: "/repo",
      catalog: { ready: false, providers: catalog("directory") },
      global,
    }),
  ).toBe(global)
})

describe("isFreeModel", () => {
  test("marks klautcode zen cost-0 models as free", () => {
    expect(isFreeModel("klautcode", undefined)).toBe(true)
    expect(isFreeModel("klautcode", { input: 0 })).toBe(true)
    expect(isFreeModel("klautcode", { input: 0.14 })).toBe(false)
  })

  test("marks opencode zen cost-0 models as free", () => {
    expect(isFreeModel("opencode", undefined)).toBe(true)
    expect(isFreeModel("opencode", { input: 0 })).toBe(true)
    expect(isFreeModel("opencode", { input: 0.14 })).toBe(false)
  })

  test("never marks opencode-go (paid Go subscription) as free", () => {
    expect(isFreeModel("opencode-go", undefined)).toBe(false)
    expect(isFreeModel("opencode-go", { input: 0 })).toBe(false)
    expect(isFreeModel("opencode-go", { input: 1 })).toBe(false)
  })

  test("does not mark other providers as free", () => {
    expect(isFreeModel("openai", { input: 0 })).toBe(false)
    expect(isFreeModel("anthropic", { input: 0 })).toBe(false)
    expect(isFreeModel("hetzner", { input: 0 })).toBe(false)
  })
})
