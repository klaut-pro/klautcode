import { Semaphore } from "effect"
import { availableParallelism } from "node:os"

// Multitask worker pool for subagents (Cursor-style). Subagents already run in
// parallel; this bounds how many may run at once. `"auto"` (default) sizes the
// pool to the machine's CPU core count so klautcode decides the worker count.

export type SubagentWorkers = number | "auto" | undefined

export const MAX_SUBAGENT_WORKERS = 16

export function resolveSubagentWorkers(subagentWorkers: SubagentWorkers): number {
  if (typeof subagentWorkers === "number" && subagentWorkers > 0) {
    return Math.min(Math.floor(subagentWorkers), MAX_SUBAGENT_WORKERS)
  }
  return Math.min(Math.max(availableParallelism(), 1), MAX_SUBAGENT_WORKERS)
}

let active: { workers: number; semaphore: Semaphore.Semaphore } | undefined

// One pool per process, keyed by the resolved worker count so a config change
// rebuilds the pool instead of leaking permits. Task-tool init is scoped per
// session, so sharing via module state is what makes the cap global.
export function subagentWorkerPool(workers: number): Semaphore.Semaphore {
  if (active?.workers === workers) return active.semaphore
  const semaphore = Semaphore.makeUnsafe(workers)
  active = { workers, semaphore }
  return semaphore
}
