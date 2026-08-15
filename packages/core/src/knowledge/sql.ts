import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"
import { Timestamps } from "../database/schema.sql"
import { ProjectTable } from "../project/sql"
import { SessionTable } from "../session/sql"
import type { ProjectV2 } from "../project"
import type { SessionSchema } from "../session/schema"
import type { Knowledge } from "./schema"

export const KnowledgeNodeTable = sqliteTable(
  "knowledge_node",
  {
    id: text().$type<Knowledge.ID>().primaryKey(),
    kind: text().$type<Knowledge.Kind>().notNull(),
    title: text().notNull(),
    body: text().notNull().default(""),
    session_id: text()
      .$type<SessionSchema.ID>()
      .references(() => SessionTable.id, { onDelete: "cascade" }),
    project_id: text()
      .$type<ProjectV2.ID>()
      .references(() => ProjectTable.id, { onDelete: "cascade" }),
    message_seq: integer(),
    parent_id: text().$type<Knowledge.ID>(),
    depth: integer().notNull().default(0),
    embedding: text({ mode: "json" }).$type<number[]>(),
    metadata: text({ mode: "json" }).$type<Record<string, unknown>>(),
    ...Timestamps,
  },
  (table) => [
    index("knowledge_node_session_idx").on(table.session_id),
    index("knowledge_node_project_idx").on(table.project_id),
    index("knowledge_node_parent_idx").on(table.parent_id),
    index("knowledge_node_kind_idx").on(table.kind),
  ],
)

export const KnowledgeEdgeTable = sqliteTable(
  "knowledge_edge",
  {
    source_id: text()
      .$type<Knowledge.ID>()
      .notNull()
      .references(() => KnowledgeNodeTable.id, { onDelete: "cascade" }),
    target_id: text()
      .$type<Knowledge.ID>()
      .notNull()
      .references(() => KnowledgeNodeTable.id, { onDelete: "cascade" }),
    kind: text().$type<Knowledge.EdgeKind>().notNull(),
    weight: real().notNull().default(1),
    time_created: integer()
      .notNull()
      .$default(() => Date.now()),
  },
  (table) => [
    uniqueIndex("knowledge_edge_source_target_kind_idx").on(table.source_id, table.target_id, table.kind),
    index("knowledge_edge_target_idx").on(table.target_id),
    index("knowledge_edge_kind_idx").on(table.kind),
  ],
)
