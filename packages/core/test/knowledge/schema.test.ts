import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { sql } from "drizzle-orm"
import { Database } from "@klautcode/core/database/database"
import { AppNodeBuilder } from "@klautcode/core/effect/app-node-builder"
import { LayerNode } from "@klautcode/core/effect/layer-node"
import { Project } from "@klautcode/core/project"
import { ProjectTable } from "@klautcode/core/project/sql"
import { AbsolutePath } from "@klautcode/core/schema"
import { SessionTable } from "@klautcode/core/session/sql"
import { SessionV2 } from "@klautcode/core/session"
import { Knowledge } from "@klautcode/core/knowledge/schema"
import { KnowledgeNodeTable, KnowledgeEdgeTable } from "@klautcode/core/knowledge/sql"
import { KnowledgeFts } from "@klautcode/core/knowledge/fts"
import { testEffect } from "../lib/effect"

const it = testEffect(AppNodeBuilder.build(LayerNode.group([Database.node])))

const setup = Effect.gen(function* () {
  const { db } = yield* Database.Service
  const sessionID = SessionV2.ID.make("ses_knowledge_schema_test")
  yield* db
    .insert(ProjectTable)
    .values({ id: Project.ID.global, worktree: AbsolutePath.make("/project"), sandboxes: [] })
    .onConflictDoNothing()
    .run()
    .pipe(Effect.orDie)
  yield* db
    .insert(SessionTable)
    .values({
      id: sessionID,
      project_id: Project.ID.global,
      slug: "test",
      directory: "/project",
      title: "test",
      version: "test",
    })
    .onConflictDoNothing()
    .run()
    .pipe(Effect.orDie)
  return { sessionID }
})

const tables = Database.Service.use(({ db }) =>
  db
    .all<{ name: string }>(sql`SELECT name FROM sqlite_master WHERE type = 'table'`)
    .pipe(Effect.map((rows) => new Set(rows.map((row) => row.name)))),
)

describe("knowledge schema", () => {
  it.effect("migrations create knowledge_node and knowledge_edge", () =>
    Effect.gen(function* () {
      const names = yield* tables
      expect(names.has("knowledge_node")).toBe(true)
      expect(names.has("knowledge_edge")).toBe(true)
      const columns = yield* Database.Service.use(({ db }) =>
        db
          .all<{ name: string }>(sql`PRAGMA table_info(knowledge_node)`)
          .pipe(Effect.map((rows) => rows.map((row) => row.name))),
      )
      expect(columns).toContain("id")
      expect(columns).toContain("kind")
      expect(columns).toContain("title")
      expect(columns).toContain("body")
      expect(columns).toContain("session_id")
      expect(columns).toContain("project_id")
      expect(columns).toContain("parent_id")
      expect(columns).toContain("depth")
      expect(columns).toContain("metadata")
    }),
  )

  it.effect("inserts nodes and edges linked to a session", () =>
    Effect.gen(function* () {
      const { sessionID } = yield* setup
      const { db } = yield* Database.Service
      const nodeID = Knowledge.ID.create()
      const childID = Knowledge.ID.create()
      yield* db
        .insert(KnowledgeNodeTable)
        .values({
          id: nodeID,
          kind: "session",
          title: "Session node",
          body: "learned a memory graph layout",
          session_id: sessionID,
          project_id: Project.ID.global,
        })
        .run()
        .pipe(Effect.orDie)
      yield* db
        .insert(KnowledgeNodeTable)
        .values({ id: childID, kind: "learning", title: "Learning", parent_id: nodeID, depth: 1 })
        .run()
        .pipe(Effect.orDie)
      yield* db
        .insert(KnowledgeEdgeTable)
        .values({ source_id: nodeID, target_id: childID, kind: "subthread_of" })
        .run()
        .pipe(Effect.orDie)

      const nodes = yield* db.select().from(KnowledgeNodeTable).all().pipe(Effect.orDie)
      expect(nodes).toHaveLength(2)
      const edges = yield* db.select().from(KnowledgeEdgeTable).all().pipe(Effect.orDie)
      expect(edges).toHaveLength(1)
      expect(edges[0]).toMatchObject({ source_id: nodeID, target_id: childID, kind: "subthread_of" })
      expect(edges[0]!.weight).toBe(1)
    }),
  )

  it.effect("enforces unique (source, target, kind) edges", () =>
    Effect.gen(function* () {
      const { db } = yield* Database.Service
      const a = Knowledge.ID.create()
      const b = Knowledge.ID.create()
      yield* db.insert(KnowledgeNodeTable).values({ id: a, kind: "message", title: "a" }).run().pipe(Effect.orDie)
      yield* db.insert(KnowledgeNodeTable).values({ id: b, kind: "message", title: "b" }).run().pipe(Effect.orDie)
      yield* db
        .insert(KnowledgeEdgeTable)
        .values({ source_id: a, target_id: b, kind: "references" })
        .run()
        .pipe(Effect.orDie)
      const dup = yield* db
        .insert(KnowledgeEdgeTable)
        .values({ source_id: a, target_id: b, kind: "references" })
        .run()
        .pipe(Effect.exit)
      expect(dup._tag).toBe("Failure")
    }),
  )

  it.effect("deletes session-scoped nodes when the session is removed", () =>
    Effect.gen(function* () {
      const { sessionID } = yield* setup
      const { db } = yield* Database.Service
      const nodeID = Knowledge.ID.create()
      yield* db
        .insert(KnowledgeNodeTable)
        .values({
          id: nodeID,
          kind: "session",
          title: "Session node",
          session_id: sessionID,
          project_id: Project.ID.global,
        })
        .run()
        .pipe(Effect.orDie)
      yield* db.delete(SessionTable).where(sql`${SessionTable.id} = ${sessionID}`).run().pipe(Effect.orDie)
      const remaining = yield* db
        .select()
        .from(KnowledgeNodeTable)
        .where(sql`${KnowledgeNodeTable.id} = ${nodeID}`)
        .all()
        .pipe(Effect.orDie)
      expect(remaining).toHaveLength(0)
    }),
  )
})

describe("knowledge fts", () => {
  it.effect("indexes and matches nodes", () =>
    Effect.gen(function* () {
      const { db } = yield* Database.Service
      yield* KnowledgeFts.ensure(db)
      const nodeID = Knowledge.ID.create()
      yield* db
        .insert(KnowledgeNodeTable)
        .values({ id: nodeID, kind: "learning", title: "Graph memory", body: "agents recall past work across chats" })
        .run()
        .pipe(Effect.orDie)
      const rowid = yield* KnowledgeFts.rowidFor(db, nodeID)
      expect(rowid).toBeTypeOf("number")
      yield* KnowledgeFts.index(db, rowid!, "Graph memory", "agents recall past work across chats")

      const hits = yield* KnowledgeFts.search(db, "memory")
      expect(hits).toHaveLength(1)
      expect(hits[0]!.rowid).toBe(rowid)

      const misses = yield* KnowledgeFts.search(db, "unrelated")
      expect(misses).toHaveLength(0)
    }),
  )

  it.effect("replace keeps the index in sync", () =>
    Effect.gen(function* () {
      const { db } = yield* Database.Service
      yield* KnowledgeFts.ensure(db)
      const nodeID = Knowledge.ID.create()
      yield* db
        .insert(KnowledgeNodeTable)
        .values({ id: nodeID, kind: "message", title: "Old title", body: "old body" })
        .run()
        .pipe(Effect.orDie)
      const rowid = yield* KnowledgeFts.rowidFor(db, nodeID)
      yield* KnowledgeFts.index(db, rowid!, "Old title", "old body")
      yield* KnowledgeFts.replace(db, rowid!, "New title", "new body about graphs")

      const hits = yield* KnowledgeFts.search(db, "graphs")
      expect(hits).toHaveLength(1)
      const oldHits = yield* KnowledgeFts.search(db, "old")
      expect(oldHits).toHaveLength(0)
    }),
  )
})
