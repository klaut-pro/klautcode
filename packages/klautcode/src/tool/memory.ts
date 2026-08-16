import { Effect, Schema } from "effect"
import { ProjectV2 } from "@klautcode/core/project"
import { KnowledgeService } from "@klautcode/core/knowledge/service"
import { InstanceState } from "@/effect/instance-state"
import * as Tool from "./tool"

const RECALL_LIMIT = 8
const RECALL_MAX = 25

export const MemoryStoreTool = Tool.define(
  "memory_store",
  Effect.gen(function* () {
    const knowledge = yield* KnowledgeService.Service

    const Parameters = Schema.Struct({
      title: Schema.String.annotate({
        description:
          "A short, durable title that summarizes what was learned, such as 'auth tokens are scoped per workspace'.",
      }),
      body: Schema.String.annotate({
        description:
          "A concise but complete description of what was learned and worth remembering across sessions in this project.",
      }),
    })

    return {
      description: `Store a durable learning about this project that should be remembered across sessions.

Use this when you discover something non-obvious worth remembering: architecture decisions, project conventions, gotchas, API designs, domain knowledge, or resolutions to problems you solved. Memory is shared across all sessions in this project and is included in the system context of future sessions, so agents do not have to rediscover the same facts. Storing a title already known appends to it and refreshes its recency.`,
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const context = yield* InstanceState.context
          const projectID = ProjectV2.ID.make(context.project.id)
          yield* ctx.ask({ permission: "memory_store", patterns: [params.title], always: [params.title], metadata: {} })
          const id = yield* knowledge.addLearning({
            title: params.title,
            body: params.body,
            projectID,
            sessionID: ctx.sessionID,
          })
          return {
            title: "Stored project memory",
            metadata: { id },
            output: `Project memory stored: "${params.title}".\n\n${id}`,
          }
        }).pipe(Effect.orDie),
    }
  }),
)

const toQuery = (query: string) =>
  query
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}._-]+/gu, ""))
    .filter((word) => word.length >= 2)
    .map((word) => `"${word}"`)
    .join(" ")

export const MemoryRecallTool = Tool.define(
  "memory_recall",
  Effect.gen(function* () {
    const knowledge = yield* KnowledgeService.Service

    const Parameters = Schema.Struct({
      query: Schema.optional(
        Schema.String.annotate({
          description: "A natural language query describing what to recall. Omit to list the most recent project memories.",
        }),
      ),
      limit: Schema.optional(
        Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: RECALL_MAX })).annotate({
          description: "Maximum number of memories to return (default 8, max 25).",
        }),
      ),
    })

    return {
      description: `Search shared project memory recorded across all sessions in this project.

Use this to recall decisions, conventions, and learnings from past work before re-deriving them. With no query, returns the most recent project memories. Project memory is also summarized in the system context, but this tool surfaces more entries and performs a full-text search.`,
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const context = yield* InstanceState.context
          const projectID = ProjectV2.ID.make(context.project.id)
          yield* ctx.ask({ permission: "memory_recall", patterns: ["*"], always: ["*"], metadata: {} })
          const limit = params.limit ?? RECALL_LIMIT
          const query = params.query ?? ""
          const nodes = query.trim()
            ? yield* knowledge.recall(toQuery(query), { scope: "project", projectID, limit })
            : yield* knowledge.recent({ scope: "project", projectID, limit })
          const memories = nodes.map((node) => `- ${node.title}${node.body ? `: ${node.body}` : ""}`)
          return {
            title: "Recalled project memory",
            metadata: { count: memories.length },
            output: memories.length === 0 ? "No project memories found." : memories.join("\n"),
          }
        }).pipe(Effect.orDie),
    }
  }),
)
