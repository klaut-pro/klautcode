import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { isAbsolute, join } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { CHANNEL } from "./constants"

export type OpencodeImportProject = {
  id: string
  name: string | null
  worktree: string
  sessionCount: number
}

export type OpencodeImportScan = {
  directory: string
  dbPath: string
  projects: OpencodeImportProject[]
}

export type OpencodeImportResult = {
  projects: number
  sessions: number
  messages: number
  parts: number
  todos: number
}

// Mirrors xdg-basedir used by @klautcode/core/global: XDG_DATA_HOME with a
// `~/.local/share` fallback regardless of platform.
function xdgDataDir() {
  return process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share")
}

// Resolve the opencode data directory (the app holding opencode.db). Defaults to
// the same XDG layout opencode uses, so no directory needs to be passed on first open.
export function opencodeDataDir(directory?: string) {
  if (directory) return directory
  return join(xdgDataDir(), "opencode")
}

// Replicate @klautcode/core Database.path() so the import writes to the exact
// database the running server sidecar uses (channel-suffixed in dev/beta).
function databasePath() {
  const flag = process.env.KLAUTCODE_DB
  if (flag) {
    if (flag === ":memory:" || isAbsolute(flag)) return flag
    return join(xdgDataDir(), "klautcode", flag)
  }
  const disabled =
    process.env.KLAUTCODE_DISABLE_CHANNEL_DB === "1" || process.env.KLAUTCODE_DISABLE_CHANNEL_DB === "true"
  if (["latest", "beta", "prod"].includes(CHANNEL) || disabled) return join(xdgDataDir(), "klautcode", "klautcode.db")
  return join(xdgDataDir(), "klautcode", `klautcode-${CHANNEL.replace(/[^a-zA-Z0-9._-]/g, "-")}.db`)
}

// Tables copied from the opencode database into the klautcode database. The
// session-scoped ones are copied for every session belonging to a selected
// project; V2 tables are copied only when the source has them.
const SESSION_SCOPED_TABLES = ["message", "part", "todo", "session_message", "session_input", "session_context_epoch"]

export function scanOpencodeImport(directory?: string): OpencodeImportScan {
  const dir = opencodeDataDir(directory)
  const dbPath = join(dir, "opencode.db")
  if (!existsSync(dbPath)) return { directory: dir, dbPath, projects: [] }

  const db = new DatabaseSync(dbPath, { readOnly: true })
  try {
    const rows = db
      .prepare(
        `SELECT p."id" AS id, p."name" AS name, p."worktree" AS worktree,
                (SELECT COUNT(*) FROM "session" s WHERE s."project_id" = p."id") AS sessionCount
         FROM "project" p
         ORDER BY p."time_created" ASC`,
      )
      .all() as unknown as Array<{ id: string; name: string | null; worktree: string; sessionCount: number }>
    return { directory: dir, dbPath, projects: rows }
  } finally {
    db.close()
  }
}

export function runOpencodeImport(directory: string, projectIds: string[]): OpencodeImportResult {
  const sourcePath = join(directory, "opencode.db")
  if (!existsSync(sourcePath)) throw new Error(`No opencode database found at ${sourcePath}`)
  if (projectIds.length === 0) return { projects: 0, sessions: 0, messages: 0, parts: 0, todos: 0 }

  const targetPath = databasePath()
  if (!existsSync(targetPath)) throw new Error(`Klautcode database not found at ${targetPath}`)

  const target = new DatabaseSync(targetPath)
  try {
    target.prepare("ATTACH DATABASE ? AS src").run(sourcePath)
    // Session self-references and cross-table FKs are satisfied by the source
    // data; disable enforcement so insert order within a project does not matter.
    target.exec("PRAGMA foreign_keys = OFF")
    const result: OpencodeImportResult = { projects: 0, sessions: 0, messages: 0, parts: 0, todos: 0 }

    for (const projectId of projectIds) {
      target.exec("BEGIN IMMEDIATE")
      try {
        result.projects += copyTable(target, "project", `WHERE "id" = ?`, [projectId])
        copyTable(target, "project_directory", `WHERE "project_id" = ?`, [projectId])
        result.sessions += copyTable(target, "session", `WHERE "project_id" = ?`, [projectId])
        const sessionFilter = `WHERE "session_id" IN (SELECT "id" FROM "src"."session" WHERE "project_id" = ?)`
        result.messages += copyTable(target, "message", sessionFilter, [projectId])
        result.parts += copyTable(target, "part", sessionFilter, [projectId])
        result.todos += copyTable(target, "todo", sessionFilter, [projectId])
        for (const table of SESSION_SCOPED_TABLES) copyTable(target, table, sessionFilter, [projectId])
        target.exec("COMMIT")
      } catch (error) {
        target.exec("ROLLBACK")
        throw error
      }
    }

    return result
  } finally {
    target.close()
  }
}

function copyTable(target: DatabaseSync, table: string, filter: string, args: string[]): number {
  const targetCols = columnNames(target, "main", table)
  const sourceCols = columnNames(target, "src", table)
  if (targetCols.length === 0 || sourceCols.length === 0) return 0
  const cols = targetCols.filter((col) => sourceCols.includes(col))
  if (cols.length === 0) return 0
  const quoted = cols.map((col) => `"${col}"`).join(", ")
  const sql = `INSERT OR IGNORE INTO "main"."${table}" (${quoted}) SELECT ${quoted} FROM "src"."${table}" ${filter}`
  return Number(target.prepare(sql).run(...args).changes)
}

function columnNames(db: DatabaseSync, schema: string, table: string): string[] {
  const rows = db.prepare(`PRAGMA ${schema}.table_info(${table})`).all() as unknown as Array<{ name: string }>
  return rows.map((row) => row.name)
}
