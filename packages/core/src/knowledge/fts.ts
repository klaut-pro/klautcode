export * as KnowledgeFts from "./fts"

import { sql } from "drizzle-orm"
import { Effect } from "effect"
import type { Database } from "../database/database"

type DatabaseShape = Database.Interface["db"]

const TABLE = "knowledge_node_fts"

export const ensure = Effect.fn("KnowledgeFts.ensure")(function* (db: DatabaseShape) {
  yield* db.run(
    sql`CREATE VIRTUAL TABLE IF NOT EXISTS ${sql.identifier(TABLE)} USING fts5(title, body)`,
  )
})

export const index = Effect.fn("KnowledgeFts.index")(
  function* (db: DatabaseShape, rowid: number, title: string, body: string) {
    yield* db.run(
      sql`INSERT INTO ${sql.identifier(TABLE)} (rowid, title, body) VALUES (${rowid}, ${title}, ${body})`,
    )
  },
)

export const replace = Effect.fn("KnowledgeFts.replace")(
  function* (db: DatabaseShape, rowid: number, title: string, body: string) {
    yield* db.run(sql`DELETE FROM ${sql.identifier(TABLE)} WHERE rowid = ${rowid}`)
    yield* db.run(
      sql`INSERT INTO ${sql.identifier(TABLE)} (rowid, title, body) VALUES (${rowid}, ${title}, ${body})`,
    )
  },
)

export const remove = Effect.fn("KnowledgeFts.remove")(function* (db: DatabaseShape, rowid: number) {
  yield* db.run(sql`DELETE FROM ${sql.identifier(TABLE)} WHERE rowid = ${rowid}`)
})

export interface Row {
  rowid: number
  title: string
  body: string
}

export const search = Effect.fn("KnowledgeFts.search")(
  function* (db: DatabaseShape, query: string, limit = 10) {
    return yield* db.all<Row>(
      sql`SELECT rowid, title, body FROM ${sql.identifier(TABLE)} WHERE ${sql.identifier(TABLE)} MATCH ${query} ORDER BY rank LIMIT ${limit}`,
    )
  },
)

export const rowidFor = Effect.fn("KnowledgeFts.rowidFor")(function* (db: DatabaseShape, nodeID: string) {
  const row = yield* db.get<{ rowid: number }>(
    sql`SELECT rowid FROM knowledge_node WHERE id = ${nodeID}`,
  )
  return row?.rowid
})
