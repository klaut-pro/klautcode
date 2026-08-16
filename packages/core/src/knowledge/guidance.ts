export * as KnowledgeGuidance from "./guidance"

import { Context, DateTime, Effect, Layer, Schema } from "effect"
import { makeLocationNode } from "../effect/app-node"
import { KnowledgeService } from "./service"
import { ProjectV2 } from "../project"
import { SystemContext } from "../system-context/index"

const Entry = Schema.Struct({
  title: Schema.String,
  body: Schema.optional(Schema.String),
  timeUpdated: Schema.Number,
})
type Entry = typeof Entry.Type

const MEMORY_LIMIT = 8
const BODY_LIMIT = 600

const renderEntry = (entry: Entry) => {
  const body = entry.body
  const truncated = body && body.length > BODY_LIMIT ? `${body.slice(0, BODY_LIMIT - 1)}…` : body
  return [
    "  <entry>",
    `    <title>${entry.title}</title>`,
    ...(truncated ? [`    <body>${truncated}</body>`] : []),
    "  </entry>",
  ].join("\n")
}

const render = (entries: ReadonlyArray<Entry>) =>
  [
    "Project memory (shared across sessions and agents in this project):",
    ...(entries.length === 0
      ? ["<project_memory>No memories recorded yet.</project_memory>"]
      : ["<project_memory>", ...entries.map(renderEntry), "</project_memory>"]),
    "Recall these memories before re-discovering things already learned in this project. Add or update memories with the memory_store tool when you learn something durable.",
  ].join("\n")

const changedEntries = (previous: ReadonlyArray<Entry>, current: ReadonlyArray<Entry>) => {
  const known = new Map(previous.map((entry) => [entry.title, entry] as const))
  const changed: Entry[] = []
  const removed: string[] = []
  for (const entry of current) {
    const prior = known.get(entry.title)
    if (prior === undefined || prior.body !== entry.body || prior.timeUpdated !== entry.timeUpdated) changed.push(entry)
    known.delete(entry.title)
  }
  removed.push(...known.keys())
  return { changed, removed }
}

export interface Interface {
  readonly load: (projectID: ProjectV2.ID) => Effect.Effect<SystemContext.SystemContext>
}

export class Service extends Context.Service<Service, Interface>()("@klautcode/v2/KnowledgeGuidance") {}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const knowledge = yield* KnowledgeService.Service

    return Service.of({
      load: Effect.fn("KnowledgeGuidance.load")(function* (projectID) {
        const nodes = yield* knowledge.recent({ scope: "project", projectID, limit: MEMORY_LIMIT }).pipe(
          Effect.orDie,
        )
        const entries = nodes.map((node) => ({
          title: node.title,
          body: node.body,
          timeUpdated: node.timeUpdated === undefined ? 0 : DateTime.toEpochMillis(node.timeUpdated),
        }))
        if (entries.length === 0) return SystemContext.empty
        return SystemContext.make({
          key: SystemContext.Key.make("memory/project"),
          codec: Schema.toCodecJson(Schema.Array(Entry)),
          load: Effect.succeed(entries),
          baseline: render,
          update: (previous, current) => {
            const { changed, removed } = changedEntries(previous, current)
            return [
              "Project memory has changed:",
              ...(changed.length > 0 ? ["<project_memory>", ...changed.map(renderEntry), "</project_memory>"] : []),
              ...(removed.length > 0 ? [`Removed project memories: ${removed.join(", ")}`] : []),
            ].join("\n")
          },
          removed: () =>
            "Project memory is no longer available. Do not rely on previously provided project memories from this context source.",
        })
      }),
    })
  }),
)

export const locationLayer = layer

export const node = makeLocationNode({ service: Service, layer, deps: [KnowledgeService.node] })
