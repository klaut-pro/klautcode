import { describe, expect, test } from "bun:test"
import { boundCompactionHead } from "./compaction"
import type { SessionV1 } from "@klautcode/core/v1/session"

// boundCompactionHead only inspects message.info.id and serializes parts, so a
// minimal structural fixture is sufficient; the branded message IDs are not
// important to the logic under test.
const user = (id: string, text: string): SessionV1.WithParts =>
  ({
    info: {
      id: `msg-${id}`,
      sessionID: "ses_test",
      role: "user",
      time: { created: 0 },
      agent: "build",
      model: { providerID: "hetzner", modelID: "Kimi-K2.7-Code" },
    },
    parts: [{ type: "text", text }],
  }) as unknown as SessionV1.WithParts

describe("boundCompactionHead", () => {
  test("keeps all messages when they fit the usable budget", () => {
    const messages = [user("m1", "hello world"), user("m2", "short message")]
    const result = boundCompactionHead({
      messages,
      nextPrompt: "Summarize",
      usableBudget: 100_000,
    })
    expect(result.map((m) => String(m.info.id))).toEqual(["msg-m1", "msg-m2"])
  })

  test("drops the oldest messages first when over budget", () => {
    // 15 large messages against a small usable budget => the oldest are dropped
    // but the most recent are preserved.
    const messages = Array.from({ length: 15 }, (_, i) => user(`m${i}`, "x".repeat(1200)))
    const result = boundCompactionHead({
      messages,
      nextPrompt: "Summarize",
      usableBudget: 10_000,
    })
    expect(result.length).toBeGreaterThan(0)
    expect(result.length).toBeLessThan(15)
    expect(String(result.at(-1)!.info.id)).toBe("msg-m14")
    // no message is duplicated or reordered
    expect(result.map((m) => String(m.info.id))).toEqual(
      Array.from({ length: result.length }, (_, i) => `msg-m${15 - result.length + i}`),
    )
  })

  test("keeps at least the most recent message even when nothing fits", () => {
    const messages = [user("m1", "y".repeat(5000)), user("m2", "z".repeat(5000))]
    const result = boundCompactionHead({ messages, nextPrompt: "Summarize", usableBudget: 0 })
    expect(result.map((m) => String(m.info.id))).toEqual(["msg-m2"])
  })

  test("returns an empty list for no messages", () => {
    const result = boundCompactionHead({ messages: [], nextPrompt: "Summarize", usableBudget: 1000 })
    expect(result).toEqual([])
  })
})
