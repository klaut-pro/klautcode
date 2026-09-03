#!/usr/bin/env bun
// Auto-discover Ollama models from a given URL and update klautcode.jsonc
// Usage: bun run script/autodiscover-ollama.ts [url]
// Default: http://10.63.81.100:11434

import { readFile, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import path from "node:path"

const url = process.argv[2] ?? "http://10.63.81.100:11434"
const base = url.replace(/\/$/, "")
const tagsUrl = `${base}/api/tags`
const v1Url = `${base}/v1/models`

const configPath = path.join(homedir(), ".config", "klautcode", "klautcode.jsonc")

async function fetchTags() {
  const res = await fetch(tagsUrl)
  if (!res.ok) throw new Error(`GET ${tagsUrl} -> ${res.status}`)
  const data = (await res.json()) as {
    models: Array<{
      name: string
      model: string
      details: { parameter_size: string; context_length: number }
      capabilities: string[]
    }>
  }
  return data.models
}

async function main() {
  console.log(`Discovering from ${base} ...`)
  const models = await fetchTags()
  console.log(`Found ${models.length} models:`)
  for (const m of models) console.log(` - ${m.name} (${m.details.parameter_size}, ctx=${m.details.context_length})`)

  const raw = await readFile(configPath, "utf-8")
  // Preserve formatting: parse via JSON (jsonc is json-compatible here)
  const cfg = JSON.parse(raw) as any
  cfg.provider ??= {}
  cfg.provider.ollama ??= { npm: "@ai-sdk/openai-compatible", name: "Ollama (local)", options: {} }
  cfg.provider.ollama.options ??= {}
  cfg.provider.ollama.options.baseURL = `${base}/v1`
  // Keep existing timeout settings, default to 15 min if missing
  cfg.provider.ollama.options.timeout ??= 900000
  cfg.provider.ollama.options.chunkTimeout ??= 900000
  cfg.provider.ollama.models ??= {}

  for (const m of models) {
    const id = m.name // use full tag as model ID (matches /v1/models)
    const limit = { context: m.details.context_length ?? 262144, output: 16384 }
    const name = id.replace(/:latest$/, "")
    const reasoning = m.capabilities?.includes("thinking") ?? false
    const tool_call = m.capabilities?.includes("tools") ?? false
    cfg.provider.ollama.models[id] = { name, reasoning, tool_call, limit }
    console.log(` -> ${id}: reasoning=${reasoning} tool_call=${tool_call} limit=${JSON.stringify(limit)}`)
  }

  // Optionally prune models that no longer exist on server (comment out to keep manual ones)
  // for (const id of Object.keys(cfg.provider.ollama.models)) {
  //   if (!models.some((m) => m.name === id)) delete cfg.provider.ollama.models[id]
  // }

  await writeFile(configPath, JSON.stringify(cfg, null, 2) + "\n", "utf-8")
  console.log(`Updated ${configPath}`)

  // Verify via /v1/models as well
  try {
    const v1 = await fetch(v1Url).then((r) => r.json())
    console.log(`\n/v1/models also reports ${v1.data?.length ?? 0} models`)
  } catch {}
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
