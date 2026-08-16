export * as MemoryTool from "./memory"

import { ToolFailure } from "@klautcode/llm"
import { Effect, Layer, Schema } from "effect"
import { makeLocationNode } from "../effect/app-node"
import { KnowledgeService } from "../knowledge/service"
import { Location } from "../location"
import { PermissionV2 } from "../permission"
import { ToolRegistry } from "./registry"
import { Tool } from "./tool"
import { Tools } from "./tools"

export const storeName = "memory_store"
export const recallName = "memory_recall"

const RECALL_LIMIT = 8
const RECALL_MAX = 25

const StoreInput = Schema.Struct({
  title: Schema.String.annotate({
    description:
      "A short, durable title for this memory that summarizes what was learned, such as 'auth tokens are scoped per workspace'.",
  }),
  body: Schema.String.annotate({
    description:
      "A concise but complete description of what was learned that is worth remembering across sessions in this project.",
  }),
})

const StoreOutput = Schema.Struct({
  title: Schema.String,
  id: Schema.String,
})

const RecallInput = Schema.Struct({
  query: Schema.optional(
    Schema.String.annotate({ description: "A natural language query describing what to recall. Omit to list the most recent project memories." }),
  ),
  limit: Schema.optional(
    Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: RECALL_MAX })).annotate({
      description: "Maximum number of memories to return (default 8, max 25).",
    }),
  ),
})

const MemoryEntry = Schema.Struct({
  title: Schema.String,
  body: Schema.optional(Schema.String),
})

const RecallOutput = Schema.Struct({
  memories: Schema.Array(MemoryEntry),
})

const storeDescription = `Store a durable learning about this project that should be remembered across sessions.

Use this when you discover something non-obvious worth remembering: architecture decisions, project conventions, gotchas, API designs, domain knowledge, or resolutions to problems you solved. Memory is shared across all sessions in this project and is included in the system context of future sessions, so agents do not have to rediscover the same facts. Storing a memory with an already-known title appends to it and refreshes its recency.`

const recallDescription = `Search shared project memory recorded across all sessions in this project.

Use this to recall decisions, conventions, and learnings from past work before re-deriving them. With no query, returns the most recent project memories. Memory is also automatically summarized in the system context, but this tool surfaces more entries and performs a full-text search.`

const toQuery = (query: string) =>
  query
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}._-]+/gu, ""))
    .filter((word) => word.length >= 2)
    .map((word) => `"${word}"`)
    .join(" ")

const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    const tools = yield* Tools.Service
    const knowledge = yield* KnowledgeService.Service
    const location = yield* Location.Service
    const permission = yield* PermissionV2.Service
    const projectID = location.project.id

    const store = Tool.make({
      description: storeDescription,
      input: StoreInput,
      output: StoreOutput,
      toModelOutput: ({ output }) => [
        { type: "text", text: `Project memory stored: "${output.title}".\n\n${output.id}` },
      ],
      execute: (input, context) =>
        Effect.gen(function* () {
          yield* permission.assert({
            action: storeName,
            resources: [input.title],
            save: [input.title],
            sessionID: context.sessionID,
            agent: context.agent,
            source: { type: "tool", messageID: context.assistantMessageID, callID: context.toolCallID },
          })
          const id = yield* knowledge.addLearning({
            title: input.title,
            body: input.body,
            projectID,
            sessionID: context.sessionID,
          })
          return { title: input.title, id: id.toString() }
        }).pipe(Effect.mapError((error) => new ToolFailure({ message: `Unable to store memory: ${error}` }))),
    })

    const recall = Tool.make({
      description: recallDescription,
      input: RecallInput,
      output: RecallOutput,
      toModelOutput: ({ output }) => [
        {
          type: "text",
          text:
            output.memories.length === 0
              ? "No project memories found."
              : output.memories
                  .map(
                    (memory) =>
                      `- ${memory.title}${memory.body ? `: ${memory.body}` : ""}`,
                  )
                  .join("\n"),
        },
      ],
      execute: (input, context) =>
        Effect.gen(function* () {
          yield* permission.assert({
            action: recallName,
            resources: ["*"],
            sessionID: context.sessionID,
            agent: context.agent,
            source: { type: "tool", messageID: context.assistantMessageID, callID: context.toolCallID },
          })
          const limit = input.limit ?? RECALL_LIMIT
          const query = input.query ?? ""
          const sanitized = toQuery(query)
          const nodes = sanitized
            ? yield* knowledge.recall(sanitized, { scope: "project", projectID, limit })
            : yield* knowledge.recent({ scope: "project", projectID, limit })
          return {
            memories: nodes.map((node) => ({
              title: node.title,
              ...(node.body ? { body: node.body } : {}),
            })),
          }
        }).pipe(Effect.mapError((error) => new ToolFailure({ message: `Unable to recall memory: ${error}` }))),
    })

    yield* tools.register({ [storeName]: store, [recallName]: recall }).pipe(Effect.orDie)
  }),
)

export const node = makeLocationNode({
  name: "tool/memory",
  layer,
  deps: [ToolRegistry.node, KnowledgeService.node, Location.node, PermissionV2.node],
})
