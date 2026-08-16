export * as KnowledgeService from "./service"

import { and, eq, sql } from "drizzle-orm"
import { Context, DateTime, Effect, Layer } from "effect"
import { Database } from "../database/database"
import { makeGlobalNode } from "../effect/app-node"
import { ProjectV2 } from "../project"
import { SessionSchema } from "../session/schema"
import { SessionMessageTable, SessionTable } from "../session/sql"
import { Knowledge } from "./schema"
import { KnowledgeEdgeTable, KnowledgeNodeTable } from "./sql"
import { KnowledgeFts } from "./fts"

export class KnowledgeServiceError extends Error {
  readonly _tag = "KnowledgeServiceError"
  constructor(message: string) {
    super(message)
  }
}

export interface AddLearningInput {
  title: string
  body?: string
  sessionID?: SessionSchema.ID
  projectID?: ProjectV2.ID
  parentID?: Knowledge.ID
  kind?: Knowledge.Kind
  metadata?: Record<string, unknown>
}

export interface RecallOptions {
  scope?: "global" | "project"
  projectID?: ProjectV2.ID
  limit?: number
  kinds?: Knowledge.Kind[]
}

export interface Subgraph {
  nodes: Knowledge.Node[]
  edges: Knowledge.Edge[]
}

export interface IngestMessage {
  id: string
  seq: number
  type: "user" | "synthetic" | "assistant"
  text: string
  files: ReadonlyArray<string>
}

export interface IngestProjectionInput {
  id: SessionSchema.ID
  title: string
  projectID?: ProjectV2.ID
  agent?: string
  directory?: string
  parentID?: SessionSchema.ID
  messages: ReadonlyArray<IngestMessage>
}

export interface Interface {
  ingest(sessionID: SessionSchema.ID): Effect.Effect<void, KnowledgeServiceError>
  ingestProjection(input: IngestProjectionInput): Effect.Effect<void, KnowledgeServiceError>
  addLearning(input: AddLearningInput): Effect.Effect<Knowledge.ID, KnowledgeServiceError>
  retrieve(query: string, options?: RecallOptions): Effect.Effect<Knowledge.Node[], KnowledgeServiceError>
  recent(options?: RecallOptions): Effect.Effect<Knowledge.Node[], KnowledgeServiceError>
  recall(query: string, options?: RecallOptions): Effect.Effect<Knowledge.Node[], KnowledgeServiceError>
  remove(input: { projectID: ProjectV2.ID; title: string }): Effect.Effect<void, KnowledgeServiceError>
  subgraph(sessionID: SessionSchema.ID): Effect.Effect<Subgraph, KnowledgeServiceError>
}

export class Service extends Context.Service<Service, Interface>()("@klautcode/knowledge/Knowledge") {}

const MAX_BODY = 4000
const MAX_TITLE = 200
const MAX_FILE_NODES = 64

const trim = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max - 1)}…`)

const hash = (key: string) => {
  let value = 5381
  for (const char of key) value = ((value << 5) + value + char.charCodeAt(0)) >>> 0
  return value.toString(36)
}

const stableID = (prefix: string, key: string): Knowledge.ID => Knowledge.ID.make(`kn_${prefix}_${hash(key)}`)

const nodeIDForSession = (sessionID: SessionSchema.ID) => stableID("s", sessionID)

const learningID = (projectID: ProjectV2.ID | undefined, title: string) =>
  stableID("l", `${projectID ?? "global"}:${title.toLowerCase()}`)

type NodeRow = {
  id: string
  kind: Knowledge.Kind
  title: string
  body: string
  session_id: string | null
  project_id: string | null
  message_seq: number | null
  parent_id: string | null
  depth: number
  metadata: Record<string, unknown> | null
  time_created: number
  time_updated: number
}

function rowToNode(row: NodeRow): Knowledge.Node {
  return {
    id: Knowledge.ID.make(row.id),
    kind: row.kind,
    title: row.title,
    body: row.body,
    sessionID: row.session_id as SessionSchema.ID | undefined,
    projectID: row.project_id as ProjectV2.ID | undefined,
    messageSeq: row.message_seq ?? undefined,
    parentID: row.parent_id as Knowledge.ID | undefined,
    depth: row.depth,
    metadata: row.metadata as Knowledge.Node["metadata"],
    timeCreated: DateTime.makeUnsafe(row.time_created),
    timeUpdated: DateTime.makeUnsafe(row.time_updated),
  }
}

const upsertNode = (
  db: Database.Interface["db"],
  input: {
    id: Knowledge.ID
    kind: Knowledge.Kind
    title: string
    body?: string
    sessionID?: SessionSchema.ID
    projectID?: ProjectV2.ID
    messageSeq?: number
    parentID?: Knowledge.ID
    depth?: number
    metadata?: Record<string, unknown>
  },
) =>
  db
    .insert(KnowledgeNodeTable)
    .values({
      id: input.id,
      kind: input.kind,
      title: input.title,
      body: input.body ?? "",
      session_id: input.sessionID,
      project_id: input.projectID,
      message_seq: input.messageSeq,
      parent_id: input.parentID,
      depth: input.depth ?? 0,
      metadata: input.metadata,
    })
    .onConflictDoUpdate({
      target: KnowledgeNodeTable.id,
      set: {
        kind: input.kind,
        title: input.title,
        body: input.body ?? "",
        session_id: input.sessionID,
        project_id: input.projectID,
        message_seq: input.messageSeq,
        parent_id: input.parentID,
        depth: input.depth ?? 0,
        metadata: input.metadata,
      },
    })
    .run()

const syncFts = (db: Database.Interface["db"], id: Knowledge.ID, title: string, body: string) =>
  Effect.gen(function* () {
    yield* KnowledgeFts.ensure(db)
    const rowid = yield* KnowledgeFts.rowidFor(db, id)
    if (rowid !== undefined) yield* KnowledgeFts.replace(db, rowid, title, body)
  })

const upsertEdge = (
  db: Database.Interface["db"],
  source: Knowledge.ID,
  target: Knowledge.ID,
  kind: Knowledge.EdgeKind,
  weight = 1,
) =>
  db
    .insert(KnowledgeEdgeTable)
    .values({ source_id: source, target_id: target, kind, weight })
    .onConflictDoNothing()
    .run()

const removeNode = (db: Database.Interface["db"], id: Knowledge.ID) =>
  Effect.gen(function* () {
    yield* KnowledgeFts.ensure(db)
    const rowid = yield* KnowledgeFts.rowidFor(db, id)
    if (rowid !== undefined) yield* KnowledgeFts.remove(db, rowid)
    yield* db.delete(KnowledgeNodeTable).where(eq(KnowledgeNodeTable.id, id)).run()
  })

function textOf(type: string, data: Record<string, unknown>): string {
  if (type === "user" || type === "synthetic") return typeof data.text === "string" ? data.text : ""
  if (type === "assistant") {
    const content = Array.isArray(data.content) ? data.content : []
    return content
      .filter((part): part is Record<string, unknown> => typeof part === "object" && part !== null)
      .filter((part) => part.type === "text")
      .map((part) => (typeof part.text === "string" ? part.text : ""))
      .join("\n")
  }
  return ""
}

function filesOf(type: string, data: Record<string, unknown>): string[] {
  const collected: string[] = []
  if (type === "user" && Array.isArray(data.files)) {
    collected.push(...data.files.filter((file): file is string => typeof file === "string"))
  }
  if (type === "assistant" && typeof data.snapshot === "object" && data.snapshot !== null) {
    const snapshot = data.snapshot as Record<string, unknown>
    if (Array.isArray(snapshot.files)) {
      collected.push(...snapshot.files.filter((file): file is string => typeof file === "string"))
    }
  }
  return collected
}

const ingestParts = (
  db: Database.Interface["db"],
  input: {
    id: SessionSchema.ID
    title: string
    projectID?: ProjectV2.ID
    agent?: string
    directory?: string
    parentID?: SessionSchema.ID
    messages: ReadonlyArray<IngestMessage>
  },
) =>
  Effect.gen(function* () {
    const sessionNode = nodeIDForSession(input.id)
    yield* upsertNode(db, {
      id: sessionNode,
      kind: "session",
      title: input.title,
      body: input.title,
      sessionID: input.id,
      projectID: input.projectID,
      metadata: { agent: input.agent ?? undefined, directory: input.directory },
    })
    yield* syncFts(db, sessionNode, input.title, input.title)

    const fileNodes = new Map<string, Knowledge.ID>()
    let fileCount = 0
    let previous: Knowledge.ID | undefined
    for (const message of input.messages) {
      const title = message.text.trim().slice(0, 80)
      const messageNode = stableID("m", message.id)
      yield* upsertNode(db, {
        id: messageNode,
        kind: "message",
        title,
        body: trim(message.text, MAX_BODY),
        sessionID: input.id,
        projectID: input.projectID,
        messageSeq: message.seq,
      })
      yield* syncFts(db, messageNode, title, message.text)

      if (previous !== undefined) yield* upsertEdge(db, previous, messageNode, "successor")
      previous = messageNode

      if (fileCount < MAX_FILE_NODES) {
        for (const file of message.files) {
          let fileNode = fileNodes.get(file)
          if (fileNode === undefined) {
            fileNode = stableID("f", file)
            fileNodes.set(file, fileNode)
            fileCount += 1
            yield* upsertNode(db, {
              id: fileNode,
              kind: "file",
              title: file,
              body: file,
              sessionID: input.id,
              projectID: input.projectID,
              metadata: { path: file },
            })
            yield* syncFts(db, fileNode, file, file)
          }
          yield* upsertEdge(db, messageNode, fileNode, "references")
        }
      }
    }

    if (input.parentID !== undefined) {
      const subthread = stableID("t", input.id)
      yield* upsertNode(db, {
        id: subthread,
        kind: "subthread",
        title: input.title,
        body: input.title,
        sessionID: input.id,
        projectID: input.projectID,
        parentID: nodeIDForSession(input.parentID),
        depth: 1,
      })
      yield* syncFts(db, subthread, input.title, input.title)
      yield* upsertEdge(db, nodeIDForSession(input.parentID), subthread, "subthread_of")
    }
  })

const ingest = (db: Database.Interface["db"], sessionID: SessionSchema.ID) =>
  Effect.gen(function* () {
    const session = yield* db
      .select()
      .from(SessionTable)
      .where(eq(SessionTable.id, sessionID))
      .get()
      .pipe(Effect.orDie)
    if (!session) throw new KnowledgeServiceError(`session ${sessionID} not found`)

    yield* ingestParts(db, {
      id: sessionID,
      title: session.title,
      projectID: session.project_id,
      agent: session.agent ?? undefined,
      directory: session.directory,
      parentID: session.parent_id ?? undefined,
      messages: yield* db
        .select()
        .from(SessionMessageTable)
        .where(eq(SessionMessageTable.session_id, sessionID))
        .orderBy(SessionMessageTable.seq)
        .all()
        .pipe(Effect.orDie)
        .pipe(
          Effect.map((messages) =>
            messages.flatMap((message) => {
              const data = (message.data ?? {}) as Record<string, unknown>
              const text = textOf(message.type, data)
              if (!text.trim()) return []
              return [
                {
                  id: message.id,
                  seq: message.seq,
                  type: message.type as "user" | "synthetic" | "assistant",
                  text: trim(text, MAX_BODY),
                  files: filesOf(message.type, data),
                },
              ]
            }),
          ),
        ),
    })
  })

const ingestProjection = (db: Database.Interface["db"], input: IngestProjectionInput) =>
  Effect.gen(function* () {
    yield* ingestParts(db, input)
  })

const addLearning = (db: Database.Interface["db"], input: AddLearningInput) =>
  Effect.gen(function* () {
    const id = learningID(input.projectID, trim(input.title, MAX_TITLE))
    const existing = yield* db
      .select()
      .from(KnowledgeNodeTable)
      .where(eq(KnowledgeNodeTable.id, id))
      .get()
      .pipe(Effect.orDie)
    const previousBody = existing?.body
    const appended =
      previousBody && input.body && previousBody !== input.body ? `${previousBody}\n\n${input.body}` : input.body
    const count = typeof existing?.metadata?.count === "number" ? existing.metadata.count + 1 : 1
    yield* upsertNode(db, {
      id,
      kind: input.kind ?? "learning",
      title: trim(input.title, MAX_TITLE),
      body: appended ? trim(appended, MAX_BODY) : undefined,
      sessionID: input.sessionID,
      projectID: input.projectID,
      parentID: input.parentID,
      metadata: {
        ...(existing?.metadata ?? {}),
        ...(input.metadata ?? {}),
        count,
      },
    })
    yield* syncFts(db, id, trim(input.title, MAX_TITLE), appended ?? "")
    return id
  })

const projectFilter = (scope: "global" | "project" | undefined, projectID: ProjectV2.ID | undefined) =>
  scope === "project" && projectID !== undefined ? sql`AND n.project_id = ${projectID}` : sql``

const kindFilter = (kinds: Knowledge.Kind[] | undefined) =>
  kinds && kinds.length > 0 ? sql`AND n.kind IN (${sql.join(kinds, sql`, `)})` : sql``

const retrieve = (db: Database.Interface["db"], query: string, options: RecallOptions = {}) =>
  Effect.gen(function* () {
    yield* KnowledgeFts.ensure(db)
    const limit = options.limit ?? 10
    const rows = yield* db.all<NodeRow>(
      sql`SELECT n.id, n.kind, n.title, n.body, n.session_id, n.project_id, n.message_seq, n.parent_id, n.depth, n.metadata, n.time_created, n.time_updated
          FROM knowledge_node_fts f
          JOIN knowledge_node n ON n.rowid = f.rowid
          WHERE knowledge_node_fts MATCH ${query}
          ${projectFilter(options.scope, options.projectID)}
          ${kindFilter(options.kinds)}
          ORDER BY CASE n.kind WHEN 'learning' THEN 0 ELSE 1 END, f.rank
          LIMIT ${limit}`,
    )
    return rows.map(rowToNode)
  })

const recent = (db: Database.Interface["db"], options: RecallOptions = {}) =>
  Effect.gen(function* () {
    const limit = options.limit ?? 10
    const rows = yield* db
      .select()
      .from(KnowledgeNodeTable)
      .where(
        options.scope === "project" && options.projectID !== undefined
          ? and(eq(KnowledgeNodeTable.project_id, options.projectID), eq(KnowledgeNodeTable.kind, "learning"))
          : eq(KnowledgeNodeTable.kind, "learning"),
      )
      .orderBy(sql`${KnowledgeNodeTable.time_updated} DESC`)
      .limit(limit)
      .all()
      .pipe(Effect.orDie)
    return rows.map(rowToNode)
  })

const recall = (db: Database.Interface["db"], query: string, options: RecallOptions = {}) =>
  Effect.gen(function* () {
    if (!query.trim()) return yield* recent(db, options)
    return yield* retrieve(db, query, options)
  })

const remove = (db: Database.Interface["db"], input: { projectID: ProjectV2.ID; title: string }) =>
  Effect.gen(function* () {
    const id = learningID(input.projectID, trim(input.title, MAX_TITLE))
    yield* removeNode(db, id)
  })

const subgraph = (db: Database.Interface["db"], sessionID: SessionSchema.ID) =>
  Effect.gen(function* () {
    const root = nodeIDForSession(sessionID)
    const nodes = yield* db
      .select()
      .from(KnowledgeNodeTable)
      .where(eq(KnowledgeNodeTable.session_id, sessionID))
      .all()
      .pipe(Effect.orDie)
    const edges = yield* db
      .select()
      .from(KnowledgeEdgeTable)
      .where(eq(KnowledgeEdgeTable.source_id, root))
      .all()
      .pipe(Effect.orDie)
    return {
      nodes: nodes.map(rowToNode),
      edges: edges.map((edge) => ({
        sourceID: Knowledge.ID.make(edge.source_id),
        targetID: Knowledge.ID.make(edge.target_id),
        kind: edge.kind,
        weight: edge.weight,
        timeCreated: DateTime.makeUnsafe(edge.time_created),
      })),
    }
  })

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const { db } = yield* Database.Service
    return Service.of({
      ingest: (sessionID) => ingest(db, sessionID).pipe(Effect.orDie),
      ingestProjection: (input) => ingestProjection(db, input).pipe(Effect.orDie),
      addLearning: (input) => addLearning(db, input).pipe(Effect.orDie),
      retrieve: (query, options) => retrieve(db, query, options).pipe(Effect.orDie),
      recent: (options) => recent(db, options).pipe(Effect.orDie),
      recall: (query, options) => recall(db, query, options).pipe(Effect.orDie),
      remove: (input) => remove(db, input).pipe(Effect.orDie),
      subgraph: (sessionID) => subgraph(db, sessionID).pipe(Effect.orDie),
    })
  }),
)

export const defaultLayer = layer
export const node = makeGlobalNode({ service: Service, layer, deps: [Database.node] })
