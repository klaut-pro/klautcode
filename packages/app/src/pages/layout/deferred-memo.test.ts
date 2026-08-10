import { describe, expect, test } from "bun:test"
import { createRoot, createSignal } from "solid-js"
import { deferredMemo } from "./helpers"

function runDeferred<T>(compute: () => T) {
  return createRoot((dispose) => ({ memo: deferredMemo(compute), dispose }))
}

describe("deferredMemo", () => {
  test("returns the initial computed value synchronously", () => {
    const [n] = createSignal(3)
    const { memo, dispose } = runDeferred(() => n() * 2)
    try {
      expect(memo()).toBe(6)
    } finally {
      dispose()
    }
  })

  test("starts with the source value before any deferral", () => {
    const [n] = createSignal(7)
    const { memo, dispose } = runDeferred(() => n() + 1)
    try {
      expect(memo()).toBe(8)
    } finally {
      dispose()
    }
  })
})
