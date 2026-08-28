import { afterEach, describe, expect } from "bun:test"
import { ConfigV1 } from "@klautcode/core/v1/config/config"
import { Database } from "@klautcode/core/database/database"
import { LayerNode } from "@klautcode/core/effect/layer-node"
import { SessionProjector } from "@klautcode/core/session/projector"
import { Effect, Fiber, Layer } from "effect"
import path from "path"
import { EventV2Bridge } from "@/event-v2-bridge"
import { Agent as AgentSvc } from "../../src/agent/agent"
import { BackgroundJob } from "@/background/job"
import { Command } from "../../src/command"
import { Config } from "@/config/config"
import { LSP } from "@/lsp/lsp"
import { MCP } from "../../src/mcp"
import { Permission } from "../../src/permission"
import { Plugin } from "../../src/plugin"
import { Provider as ProviderSvc } from "@/provider/provider"
import { Env } from "../../src/env"
import { Git } from "../../src/git"
import { Image } from "../../src/image/image"
import { Question } from "../../src/question"
import { Todo } from "../../src/session/todo"
import { Session } from "@/session/session"
import { LLM } from "../../src/session/llm"
import { MessageV2 } from "../../src/session/message-v2"
import { FSUtil } from "@klautcode/core/fs-util"
import { SessionCompaction } from "../../src/session/compaction"
import { SessionSummary } from "../../src/session/summary"
import { Instruction } from "../../src/session/instruction"
import { SessionProcessor } from "../../src/session/processor"
import { SessionPrompt } from "../../src/session/prompt"
import { SessionRevert } from "../../src/session/revert"
import { SessionRunState } from "../../src/session/run-state"
import { SessionStatus } from "../../src/session/status"
import { Skill } from "../../src/skill"
import { SystemPrompt } from "../../src/session/system"
import { Snapshot } from "../../src/snapshot"
import { ToolRegistry } from "@/tool/registry"
import { Truncate } from "@/tool/truncate"
import { CrossSpawnSpawner } from "@klautcode/core/cross-spawn-spawner"
import { Ripgrep } from "@klautcode/core/ripgrep"
import { Format } from "../../src/format"
import { disposeAllInstances, TestInstance } from "../fixture/fixture"
import { pollWithTimeout, testEffect } from "../lib/effect"
import { raw, TestLLMServer } from "../lib/llm-server"
import { RuntimeFlags } from "@/effect/runtime-flags"
import { ProviderV2 } from "@klautcode/core/provider"
import { ModelV2 } from "@klautcode/core/model"

const summary = Layer.succeed(
  SessionSummary.Service,
  SessionSummary.Service.of({
    summarize: () => Effect.void,
    diff: () => Effect.succeed([]),
    computeDiff: () => Effect.succeed([]),
  }),
)

const lsp = Layer.succeed(
  LSP.Service,
  LSP.Service.of({
    init: () => Effect.void,
    status: () => Effect.succeed([]),
    hasClients: () => Effect.succeed(false),
    touchFile: () => Effect.void,
    diagnostics: () => Effect.succeed({}),
    hover: () => Effect.succeed(undefined),
    definition: () => Effect.succeed([]),
    references: () => Effect.succeed([]),
    implementation: () => Effect.succeed([]),
    documentSymbol: () => Effect.succeed([]),
    workspaceSymbol: () => Effect.succeed([]),
    prepareCallHierarchy: () => Effect.succeed([]),
    incomingCalls: () => Effect.succeed([]),
    outgoingCalls: () => Effect.succeed([]),
  }),
)

const makeMcp = () =>
  Layer.succeed(
    MCP.Service,
    MCP.Service.of({
      status: () => Effect.succeed({}),
      clients: () => Effect.succeed({}),
      instructions: () => Effect.succeed([]),
      tools: () => Effect.succeed({}),
      prompts: () => Effect.succeed({}),
      resources: () => Effect.succeed({}),
      resourceTemplates: () => Effect.succeed({}),
      add: () => Effect.succeed({ status: {} }),
      connect: () => Effect.void,
      disconnect: () => Effect.void,
      getPrompt: () => Effect.succeed(undefined),
      readResource: () => Effect.succeed(undefined),
      startAuth: () => Effect.die("unexpected MCP auth"),
      authenticate: () => Effect.die("unexpected MCP auth"),
      finishAuth: () => Effect.die("unexpected MCP auth"),
      removeAuth: () => Effect.void,
      supportsOAuth: () => Effect.succeed(false),
      hasStoredTokens: () => Effect.succeed(false),
      getAuthStatus: () => Effect.succeed("not_authenticated" as const),
    }),
  )

const runtimeFlags = RuntimeFlags.layer({ experimentalEventSystem: true })

const testLLMServerNode = LayerNode.make({ service: TestLLMServer, layer: TestLLMServer.layer, deps: [] })

const root = LayerNode.group([
  SessionPrompt.node,
  Session.node,
  SessionProjector.node,
  MessageV2.node,
  Snapshot.node,
  LLM.node,
  Env.node,
  AgentSvc.node,
  Command.node,
  Permission.node,
  Plugin.node,
  Config.node,
  ProviderSvc.node,
  LSP.node,
  MCP.node,
  FSUtil.node,
  BackgroundJob.node,
  SessionStatus.node,
  SessionRunState.node,
  Database.node,
  EventV2Bridge.node,
  Question.node,
  Todo.node,
  ToolRegistry.node,
  Skill.node,
  Git.node,
  Ripgrep.node,
  Format.node,
  Truncate.node,
  SessionProcessor.node,
  Image.node,
  SessionCompaction.node,
  SessionRevert.node,
  Instruction.node,
  SystemPrompt.node,
  CrossSpawnSpawner.node,
  RuntimeFlags.node,
])

const layer = LayerNode.compile(LayerNode.group([root, testLLMServerNode]), [
  [SessionSummary.node, summary],
  [LSP.node, lsp],
  [MCP.node, makeMcp()],
  [RuntimeFlags.node, runtimeFlags],
])

const it = testEffect(layer)

const ref = {
  providerID: ProviderV2.ID.make("test"),
  modelID: ModelV2.ID.make("test-model"),
}

function providerCfg(url: string) {
  return {
    formatter: false,
    lsp: false,
    provider: {
      test: {
        name: "Test",
        id: "test",
        env: [],
        npm: "@ai-sdk/openai-compatible",
        models: {
          "test-model": {
            id: "test-model",
            name: "Test Model",
            attachment: false,
            reasoning: false,
            temperature: false,
            tool_call: true,
            release_date: "2025-01-01",
            limit: { context: 100_000, output: 10_000 },
            cost: { input: 0, output: 0 },
            options: {},
          },
        },
        options: { apiKey: "test-key", baseURL: url },
      },
    },
  } satisfies Partial<ConfigV1.Info>
}

const writeConfig = Effect.fn("test.writeConfig")(function* (dir: string, config: Partial<ConfigV1.Info>) {
  const fs = yield* FSUtil.Service
  yield* fs.writeWithDirs(path.join(dir, "klautcode.json"), JSON.stringify({ $schema: "https://code.klaut.pro/config.json", ...config }))
})

const useServerConfig = Effect.fn("test.useServerConfig")(function* (config: (url: string) => Partial<ConfigV1.Info>) {
  const { directory: dir } = yield* TestInstance
  const llm = yield* TestLLMServer
  yield* writeConfig(dir, config(llm.url))
  return { dir, llm }
})

function defer() {
  let resolve!: (value: unknown) => void
  const promise = new Promise<unknown>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

// --- raw SSE helpers for multi-tool-call and delayed responses ---

function sseChunk(delta: Record<string, unknown>, finish?: string) {
  return {
    id: "chatcmpl-test",
    object: "chat.completion.chunk",
    choices: [{ delta, ...(finish ? { finish_reason: finish } : {}) }],
  }
}

function taskToolCalls(tasks: { id: string; prompt: string; description: string }[]) {
  const lines: unknown[] = [sseChunk({ role: "assistant" })]
  tasks.forEach((t, i) => {
    lines.push(
      sseChunk({
        tool_calls: [{ index: i, id: t.id, type: "function", function: { name: "task", arguments: "" } }],
      }),
    )
    lines.push(
      sseChunk({
        tool_calls: [
          { index: i, function: { arguments: JSON.stringify({ prompt: t.prompt, description: t.description, subagent_type: "general" }) } },
        ],
      }),
    )
  })
  lines.push(sseChunk({}, "tool_calls"))
  return raw({ chunks: lines })
}

function delayedText(text: string, wait: PromiseLike<unknown>) {
  return raw({
    wait,
    head: [sseChunk({ role: "assistant" })],
    tail: [sseChunk({ content: text }), sseChunk({}, "stop")],
  })
}

// --- request matching helpers ---

function lastUserText(body: unknown): string {
  if (!body || typeof body !== "object") return ""
  const messages = (body as { messages?: unknown[] }).messages
  if (!Array.isArray(messages)) return ""
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i] as { role?: string; content?: unknown } | undefined
    if (!m || m.role !== "user") continue
    if (typeof m.content === "string") return m.content
    if (Array.isArray(m.content))
      return m.content.map((c) => (typeof c === "string" ? c : ((c as { text?: string })?.text ?? ""))).join("")
  }
  return ""
}

function hasToolMessage(body: unknown): boolean {
  if (!body || typeof body !== "object") return false
  const messages = (body as { messages?: unknown[] }).messages
  if (!Array.isArray(messages)) return false
  return messages.some((m) => (m as { role?: string })?.role === "tool")
}

afterEach(async () => {
  await disposeAllInstances()
})

describe("tool.task multitask queue delegation", () => {
  it.instance(
    "starts multiple queued task calls as parallel subagents",
    () =>
      Effect.gen(function* () {
        const { llm } = yield* useServerConfig(providerCfg)
        const prompt = yield* SessionPrompt.Service
        const sessions = yield* Session.Service
        const chat = yield* sessions.create({
          title: "Pinned",
          permission: [{ permission: "*", pattern: "*", action: "allow" }],
        })

        const gateA = defer()
        const gateB = defer()
        const arrivals: Record<string, number> = {}

        const matchParentFirst = (hit: { body: unknown }) =>
          lastUserText(hit.body).includes("PARALLEL_PROBE_PROMPT") && !hasToolMessage(hit.body)
        const matchA = (hit: { body: unknown }) => {
          const m = lastUserText(hit.body).includes("PARALLEL_PROBE_ALPHA")
          if (m) arrivals.alpha = Date.now()
          return m
        }
        const matchB = (hit: { body: unknown }) => {
          const m = lastUserText(hit.body).includes("PARALLEL_PROBE_BETA")
          if (m) arrivals.beta = Date.now()
          return m
        }

        yield* llm.pushMatch(
          matchParentFirst,
          taskToolCalls([
            { id: "call_alpha", prompt: "PARALLEL_PROBE_ALPHA", description: "alpha" },
            { id: "call_beta", prompt: "PARALLEL_PROBE_BETA", description: "beta" },
          ]),
        )
        yield* llm.pushMatch(matchA, delayedText("alpha done", gateA.promise))
        yield* llm.pushMatch(matchB, delayedText("beta done", gateB.promise))
        yield* llm.text("all done")

        const fiber = yield* prompt
          .prompt({
            sessionID: chat.id,
            agent: "build",
            model: { providerID: ref.providerID, modelID: ref.modelID },
            parts: [{ type: "text", text: "PARALLEL_PROBE_PROMPT" }],
          })
          .pipe(Effect.forkChild)

        // Both subagent LLM requests must arrive before either is released. If the
        // queue delegation serializes subagents, the second request cannot arrive
        // until the first completes (which is gated behind gateA/gateB), so this
        // poll times out and fails the test.
        yield* pollWithTimeout(
          Effect.sync(() => (arrivals.alpha && arrivals.beta ? true : undefined)),
          "queued task calls did not start parallel subagents (only " +
            JSON.stringify(arrivals) +
            " arrived)",
          "15 seconds",
        )

        gateA.resolve(undefined)
        gateB.resolve(undefined)

        const result = yield* Fiber.join(fiber)
        expect(result.info.role).toBe("assistant")

        const kids = yield* sessions.children(chat.id)
        expect(kids).toHaveLength(2)

        const outputs = (yield* llm.hits)
          .map((hit) => JSON.stringify(hit.body))
          .filter((s) => s.includes("PARALLEL_PROBE_ALPHA") || s.includes("PARALLEL_PROBE_BETA"))
        expect(outputs.length).toBeGreaterThanOrEqual(2)
      }),
  )
})