import { describe, expect, test } from "bun:test"
import { collectSubagents } from "./session-subagents"
import type { Part as PartType } from "@klautcode/sdk/v2"

const taskPart = (sessionId: string, description?: string): PartType =>
  ({
    id: `part-${sessionId}`,
    type: "tool",
    tool: "task",
    state: {
      status: "completed",
      metadata: { sessionId },
      input: description ? { description } : {},
    },
  }) as unknown as PartType

const nonTaskPart: PartType = {
  id: "part-read",
  type: "tool",
  tool: "read",
  state: { status: "completed", input: { filePath: "/a.ts" }, metadata: {} },
} as unknown as PartType

describe("collectSubagents", () => {
  test("collects active subagents from task tool parts", () => {
    const result = collectSubagents({
      messages: [{ id: "msg-1" }],
      parts: () => [taskPart("child-1", "explore the codebase"), taskPart("child-2")],
      sessionStatus: (id) => (id === "child-1" ? { type: "busy" } : { type: "idle" }),
    })

    expect(result).toEqual([
      { sessionId: "child-1", description: "explore the codebase", status: "working" },
      { sessionId: "child-2", description: "", status: "done" },
    ])
  })

  test("deduplicates repeated task parts for the same child", () => {
    const result = collectSubagents({
      messages: [{ id: "msg-1" }, { id: "msg-2" }],
      parts: (id) => (id === "msg-1" ? [taskPart("child-1")] : [taskPart("child-1")]),
      sessionStatus: () => ({ type: "busy" }),
    })

    expect(result).toHaveLength(1)
    expect(result[0].sessionId).toBe("child-1")
  })

  test("ignores non-task tool parts", () => {
    const result = collectSubagents({
      messages: [{ id: "msg-1" }],
      parts: () => [nonTaskPart],
      sessionStatus: () => undefined,
    })

    expect(result).toEqual([])
  })

  test("treats missing status as done so closed subagents do not linger", () => {
    const result = collectSubagents({
      messages: [{ id: "msg-1" }],
      parts: () => [taskPart("child-1")],
      sessionStatus: () => undefined,
    })

    expect(result[0].status).toBe("done")
  })
})
