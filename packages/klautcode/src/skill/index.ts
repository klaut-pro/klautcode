import { LayerNode } from "@klautcode/core/effect/layer-node"
import path from "path"
import { Effect, Layer, Context, Schema } from "effect"
import { NamedError } from "@klautcode/core/util/error"
import type { Agent } from "@/agent/agent"
import { EventV2Bridge } from "@/event-v2-bridge"
import { EventV2 } from "@klautcode/core/event"
import { Watcher } from "@klautcode/core/filesystem/watcher"
import { InstanceState } from "@/effect/instance-state"
import { Global } from "@klautcode/core/global"
import { SkillPlugin } from "@klautcode/core/plugin/skill"
import { Permission } from "@/permission"
import { FSUtil } from "@klautcode/core/fs-util"
import { Config } from "@/config/config"
import { FrontmatterError } from "@klautcode/core/v1/config/error"
import { ConfigMarkdown } from "@/config/markdown"
import { RuntimeFlags } from "@/effect/runtime-flags"
import { Glob } from "@klautcode/core/util/glob"
import { Discovery } from "./discovery"
import { isRecord } from "@/util/record"
import { escapeHtml } from "@/util/html"

const CLAUDE_EXTERNAL_DIR = ".claude"
const AGENTS_EXTERNAL_DIR = ".agents"
const EXTERNAL_SKILL_PATTERN = "skills/**/SKILL.md"
const KLAUTCODE_SKILL_PATTERN = "{skill,skills}/**/SKILL.md"
const SKILL_PATTERN = "**/SKILL.md"

// Skills shipped with klautcode that users cannot edit during a session. A
// reserved on-disk directory (Global.Path.data/skills/builtin) is also treated
// as fixed so the app can ship updatable-by-version but session-stable skills.
const BUILTIN_SKILL_DIR = "skills/builtin"
// How long a mutable skill's content stays fresh before being re-read from disk
// on use. Bounds I/O while still picking up edits quickly.
const RELOAD_TTL_MS = 2_000

// Built-in skill that ships with klautcode. The model's intuition for what an
// klautcode.json should look like is often wrong, and klautcode hard-fails on
// invalid config, so users hit cryptic startup errors. Loading this skill
// when the model is asked to touch klautcode's own config files gives it the
// actual schemas instead of guesses.
const CUSTOMIZE_KLAUTCODE_SKILL_NAME = "customize-klautcode"
const CUSTOMIZE_KLAUTCODE_SKILL_DESCRIPTION =
  "Use ONLY when the user is editing or creating klautcode's own configuration: klautcode.json, klautcode.jsonc, files under .klautcode/, or files under ~/.config/klautcode/. Also use when creating or fixing klautcode agents, subagents, skills, plugins, MCP servers, or permission rules. Do not use for the user's own application code, or for any project that is not configuring klautcode itself."
const CUSTOMIZE_KLAUTCODE_SKILL_BODY = SkillPlugin.CustomizeKlautcodeContent

export const Info = Schema.Struct({
  name: Schema.String,
  description: Schema.optional(Schema.String),
  location: Schema.String,
  content: Schema.String,
})
export type Info = Schema.Schema.Type<typeof Info>

const Issue = Schema.StructWithRest(
  Schema.Struct({
    message: Schema.String,
    path: Schema.Array(Schema.String),
  }),
  [Schema.Record(Schema.String, Schema.Unknown)],
)

function isSkillFrontmatter(data: unknown): data is { name: string; description?: string } {
  return (
    isRecord(data) &&
    typeof data.name === "string" &&
    (data.description === undefined || typeof data.description === "string")
  )
}

export class InvalidError extends Schema.TaggedErrorClass<InvalidError>()("SkillInvalidError", {
  path: Schema.String,
  message: Schema.optional(Schema.String),
  issues: Schema.optional(Schema.Array(Issue)),
}) {}

export class NameMismatchError extends Schema.TaggedErrorClass<NameMismatchError>()("SkillNameMismatchError", {
  path: Schema.String,
  expected: Schema.String,
  actual: Schema.String,
}) {}

export class NotFoundError extends Schema.TaggedErrorClass<NotFoundError>()("Skill.NotFoundError", {
  name: Schema.String,
  available: Schema.Array(Schema.String),
}) {
  override get message() {
    return `Skill "${this.name}" not found. Available skills: ${this.available.join(", ") || "none"}`
  }
}

type State = {
  skills: Record<string, Info>
  dirs: Set<string>
  // Tracks when a mutable skill was last read from disk, keyed by location, so
  // per-use reload is bounded by RELOAD_TTL_MS.
  loadedAt: Record<string, number>
}

// A skill is "fixed" (immutable during the session) when it ships with the app
// or lives under the reserved builtin directory. Everything else is mutable and
// re-read from disk on use so edits take effect immediately.
function isFixedSkill(global: Global.Interface, location: string) {
  if (location === "<built-in>") return true
  const reserved = path.join(global.data, BUILTIN_SKILL_DIR)
  return path.resolve(location).startsWith(path.resolve(reserved) + path.sep)
}

type DiscoveryState = {
  matches: string[]
  dirs: string[]
}

type ScanState = {
  matches: Set<string>
  dirs: Set<string>
}

export interface Interface {
  readonly get: (name: string) => Effect.Effect<Info | undefined>
  readonly require: (name: string) => Effect.Effect<Info, NotFoundError>
  readonly all: () => Effect.Effect<Info[]>
  readonly dirs: () => Effect.Effect<string[]>
  readonly available: (agent?: Agent.Info) => Effect.Effect<Info[]>
  readonly reload: () => Effect.Effect<void>
}

const add = Effect.fnUntraced(function* (state: State, match: string, events: EventV2Bridge.Service["Service"]) {
  const md = yield* Effect.tryPromise({
    try: () => ConfigMarkdown.parse(match),
    catch: (err) => err,
  }).pipe(
    Effect.catch(
      Effect.fnUntraced(function* (err) {
        const message = FrontmatterError.isInstance(err) ? err.data.message : `Failed to parse skill ${match}`
        const { Session } = yield* Effect.promise(() => import("@/session/session"))
        yield* events.publish(Session.Event.Error, { error: new NamedError.Unknown({ message }).toObject() })
        yield* Effect.logError("failed to load skill", { skill: match, error: err })
        return undefined
      }),
    ),
  )

  if (!md) return

  if (!isSkillFrontmatter(md.data)) return

  if (state.skills[md.data.name]) {
    yield* Effect.logWarning("duplicate skill name", {
      name: md.data.name,
      existing: state.skills[md.data.name].location,
      duplicate: match,
    })
  }

  state.dirs.add(path.dirname(match))
  state.skills[md.data.name] = {
    name: md.data.name,
    description: md.data.description,
    location: match,
    content: md.content,
  }
  state.loadedAt[match] = Date.now()
})

const scan = Effect.fnUntraced(function* (
  state: ScanState,
  root: string,
  pattern: string,
  opts?: { dot?: boolean; scope?: string },
) {
  const matches = yield* Effect.tryPromise({
    try: () =>
      Glob.scan(pattern, {
        cwd: root,
        absolute: true,
        include: "file",
        symlink: true,
        dot: opts?.dot,
      }),
    catch: (error) => error,
  }).pipe(
    Effect.catch((error) => {
      if (!opts?.scope) return Effect.die(error)
      return Effect.logError(`failed to scan ${opts.scope} skills`, { dir: root, error: error }).pipe(
        Effect.as([] as string[]),
      )
    }),
  )

  for (const match of matches) {
    state.matches.add(match)
    state.dirs.add(path.dirname(match))
  }
})

const discoverSkills = Effect.fnUntraced(function* (
  config: Config.Interface,
  discovery: Discovery.Interface,
  fsys: FSUtil.Interface,
  global: Global.Interface,
  disableExternalSkills: boolean,
  disableClaudeCodeSkills: boolean,
  directory: string,
  worktree: string,
) {
  const state: ScanState = { matches: new Set(), dirs: new Set() }

  const externalDirs: string[] = []
  if (!disableExternalSkills) {
    if (!disableClaudeCodeSkills) externalDirs.push(CLAUDE_EXTERNAL_DIR)
    externalDirs.push(AGENTS_EXTERNAL_DIR)

    for (const dir of externalDirs) {
      const root = path.join(global.home, dir)
      if (!(yield* fsys.isDir(root))) continue
      yield* scan(state, root, EXTERNAL_SKILL_PATTERN, { dot: true, scope: "global" })
    }

    const upDirs = yield* fsys
      .up({ targets: externalDirs, start: directory, stop: worktree })
      .pipe(Effect.catch(() => Effect.succeed([] as string[])))

    for (const root of upDirs) {
      yield* scan(state, root, EXTERNAL_SKILL_PATTERN, { dot: true, scope: "project" })
    }
  }

  const configDirs = yield* config.directories()
  for (const dir of configDirs) {
    yield* scan(state, dir, KLAUTCODE_SKILL_PATTERN)
  }

  const cfg = yield* config.get()
  for (const item of cfg.skills?.paths ?? []) {
    const expanded = item.startsWith("~/") ? path.join(global.home, item.slice(2)) : item
    const dir = path.isAbsolute(expanded) ? expanded : path.join(directory, expanded)
    if (!(yield* fsys.isDir(dir))) {
      yield* Effect.logWarning("skill path not found", { path: dir })
      continue
    }

    yield* scan(state, dir, SKILL_PATTERN)
  }

  for (const url of cfg.skills?.urls ?? []) {
    const pulledDirs = yield* discovery.pull(url)
    for (const dir of pulledDirs) {
      yield* scan(state, dir, SKILL_PATTERN)
    }
  }

  return {
    matches: Array.from(state.matches),
    dirs: Array.from(state.dirs),
  }
})

const loadSkills = Effect.fnUntraced(function* (
  state: State,
  discovered: DiscoveryState,
  events: EventV2Bridge.Service["Service"],
) {
  yield* Effect.forEach(discovered.matches, (match) => add(state, match, events), {
    concurrency: "unbounded",
    discard: true,
  })

  yield* Effect.logInfo("init", { count: Object.keys(state.skills).length })
})

export class Service extends Context.Service<Service, Interface>()("@klautcode/Skill") {}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const discovery = yield* Discovery.Service
    const config = yield* Config.Service
    const events = yield* EventV2Bridge.Service
    const fsys = yield* FSUtil.Service
    const global = yield* Global.Service
    const flags = yield* RuntimeFlags.Service
    const discovered = yield* InstanceState.make(
      Effect.fn("Skill.discovery")(function* (ctx) {
        return yield* discoverSkills(
          config,
          discovery,
          fsys,
          global,
          flags.disableExternalSkills,
          flags.disableClaudeCodeSkills,
          ctx.directory,
          ctx.worktree,
        )
      }),
    )
    const state = yield* InstanceState.make(
      Effect.fn("Skill.state")(function* () {
        const s: State = { skills: {}, dirs: new Set(), loadedAt: {} }
        // Register the built-in skill BEFORE disk discovery so a user-disk
        // skill with the same name can override it.
        s.skills[CUSTOMIZE_KLAUTCODE_SKILL_NAME] = {
          name: CUSTOMIZE_KLAUTCODE_SKILL_NAME,
          description: CUSTOMIZE_KLAUTCODE_SKILL_DESCRIPTION,
          location: "<built-in>",
          content: CUSTOMIZE_KLAUTCODE_SKILL_BODY,
        }
        s.loadedAt["<built-in>"] = Date.now()
        yield* loadSkills(s, yield* InstanceState.get(discovered), events)
        return s
      }),
    )

    // Auto-reload skills when a SKILL.md under a discovered skill dir changes
    // on disk, so edits take effect during a session (self-improving harness).
    let reloadTimer: ReturnType<typeof setTimeout> | undefined
    const scheduleReload = () => {
      if (reloadTimer !== undefined) return
      reloadTimer = setTimeout(() => {
        reloadTimer = undefined
        void Effect.runFork(reload().pipe(Effect.ignore))
      }, 250)
    }
    const watcherUnsub = yield* events.listen((event) => {
      if (event.type !== Watcher.Event.Updated.type) return Effect.void
      const data = event.data as EventV2.Data<typeof Watcher.Event.Updated>
      if (!path.basename(data.file).toLowerCase().startsWith("SKILL.md")) return Effect.void
      scheduleReload()
      return Effect.void
    })
    yield* Effect.addFinalizer(() =>
      Effect.gen(function* () {
        yield* watcherUnsub
        if (reloadTimer !== undefined) clearTimeout(reloadTimer)
      }),
    )

    // Re-read a single mutable skill's SKILL.md from disk if its TTL has
    // expired. Fixed skills are never re-read so they stay session-stable.
    const refreshSkill = Effect.fnUntraced(function* (s: State, name: string) {
      const existing = s.skills[name]
      if (!existing) return undefined
      if (isFixedSkill(global, existing.location)) return existing
      const loaded = s.loadedAt[existing.location] ?? 0
      if (Date.now() - loaded < RELOAD_TTL_MS) return existing

      yield* add(s, existing.location, events).pipe(Effect.catch(() => Effect.void))
      s.loadedAt[existing.location] = Date.now()
      return s.skills[name]
    })

    // Re-scan all mutable roots and rebuild mutable entries, preserving fixed
    // skills. Used by the file watcher and after config/skill-path changes.
    const reload = Effect.fn("Skill.reload")(function* () {
      const s = yield* InstanceState.get(state)
      const fresh = yield* discoverSkills(
        config,
        discovery,
        fsys,
        global,
        flags.disableExternalSkills,
        flags.disableClaudeCodeSkills,
        (yield* InstanceState.context).directory,
        (yield* InstanceState.context).worktree,
      )
      // Drop mutable skills no longer on disk, keep fixed ones.
      const mutable = Object.values(s.skills).filter((item) => !isFixedSkill(global, item.location))
      for (const item of mutable) {
        const stillPresent = fresh.matches.some((match) => match === item.location)
        if (!stillPresent) {
          delete s.skills[item.name]
          delete s.loadedAt[item.location]
        }
      }
      // Re-scan mutable matches (add() re-reads content and refreshes loadedAt).
      s.dirs.clear()
      s.loadedAt = {}
      for (const fixed of Object.values(s.skills).filter((item) => isFixedSkill(global, item.location))) {
        s.loadedAt[fixed.location] = Date.now()
      }
      yield* loadSkills(s, fresh, events)
      yield* Effect.logInfo("reload", { count: Object.keys(s.skills).length })
    })

    const get = Effect.fn("Skill.get")(function* (name: string) {
      const s = yield* InstanceState.get(state)
      return yield* refreshSkill(s, name)
    })

    const require = Effect.fn("Skill.require")(function* (name: string) {
      const s = yield* InstanceState.get(state)
      const info = yield* refreshSkill(s, name)
      if (info) return info
      return yield* new NotFoundError({ name, available: Object.keys(s.skills).toSorted() })
    })

    const all = Effect.fn("Skill.all")(function* () {
      const s = yield* InstanceState.get(state)
      // Refresh every mutable skill so the current system prompt reflects edits.
      yield* Effect.forEach(Object.keys(s.skills), (name) => refreshSkill(s, name), {
        concurrency: "unbounded",
        discard: true,
      })
      return Object.values(s.skills)
    })

    const dirs = Effect.fn("Skill.dirs")(function* () {
      return (yield* InstanceState.get(discovered)).dirs
    })

    const available = Effect.fn("Skill.available")(function* (agent?: Agent.Info) {
      const s = yield* InstanceState.get(state)
      yield* Effect.forEach(Object.keys(s.skills), (name) => refreshSkill(s, name), {
        concurrency: "unbounded",
        discard: true,
      })
      const list = Object.values(s.skills).toSorted((a, b) => a.name.localeCompare(b.name))
      if (!agent) return list
      return list.filter((skill) => Permission.evaluate("skill", skill.name, agent.permission).action !== "deny")
    })

    return Service.of({ get, require, all, dirs, available, reload })
  }),
)

export function fmt(list: Info[], opts: { verbose: boolean }) {
  const described = list.filter((skill) => skill.description !== undefined)
  if (described.length === 0) return "No skills are currently available."
  if (opts.verbose) {
    return [
      "<available_skills>",
      ...described
        .toSorted((a, b) => a.name.localeCompare(b.name))
        .flatMap((skill) => [
          "  <skill>",
          `    <name>${skill.name}</name>`,
          `    <description>${skill.description}</description>`,
          `    <location>${escapeHtml(skill.location)}</location>`,
          "  </skill>",
        ]),
      "</available_skills>",
    ].join("\n")
  }

  return [
    "## Available Skills",
    ...described
      .toSorted((a, b) => a.name.localeCompare(b.name))
      .map((skill) => `- **${skill.name}**: ${skill.description}`),
  ].join("\n")
}

export const node = LayerNode.make({
  service: Service,
  layer: layer,
  deps: [Discovery.node, Config.node, EventV2Bridge.node, FSUtil.node, Global.node, RuntimeFlags.node],
})

export * as Skill from "."
