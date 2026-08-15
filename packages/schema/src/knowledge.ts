export * as Knowledge from "./knowledge"

import { Schema } from "effect"
import { descending } from "./identifier"
import { optional, statics, DateTimeUtcFromMillis, NonNegativeInt } from "./schema"
import { Session } from "./session"
import { Project } from "./project"

export const ID = Schema.String.check(Schema.isStartsWith("kn_")).pipe(
  Schema.brand("KnowledgeNodeID"),
  statics((schema) => {
    const create = () => schema.make("kn_" + descending())
    return { create }
  }),
)
export type ID = typeof ID.Type

export const Kind = Schema.Literals([
  "session",
  "subthread",
  "message",
  "learning",
  "artifact",
  "file",
  "project",
  "research",
]).annotate({ identifier: "Knowledge.Kind" })
export type Kind = typeof Kind.Type

export const EdgeKind = Schema.Literals([
  "subthread_of",
  "references",
  "relates_to",
  "same_file",
  "successor",
  "derived_from",
  "tagged",
]).annotate({ identifier: "Knowledge.EdgeKind" })
export type EdgeKind = typeof EdgeKind.Type

export const Node = Schema.Struct({
  id: optional(ID),
  kind: Kind,
  title: Schema.String,
  body: optional(Schema.String),
  sessionID: optional(Session.ID),
  projectID: optional(Project.ID),
  messageSeq: optional(Schema.Number),
  parentID: optional(ID),
  depth: optional(NonNegativeInt),
  metadata: optional(Schema.Json),
  timeCreated: optional(DateTimeUtcFromMillis),
  timeUpdated: optional(DateTimeUtcFromMillis),
}).annotate({ identifier: "Knowledge.Node" })
export interface Node extends Schema.Schema.Type<typeof Node> {}

export const Edge = Schema.Struct({
  sourceID: ID,
  targetID: ID,
  kind: EdgeKind,
  weight: optional(Schema.Number),
  timeCreated: optional(DateTimeUtcFromMillis),
}).annotate({ identifier: "Knowledge.Edge" })
export interface Edge extends Schema.Schema.Type<typeof Edge> {}
