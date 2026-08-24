import type { UpdaterState } from "@/updater"

export function readyUpdateVersion(state: UpdaterState | undefined) {
  if (state?.status !== "ready") return
  return state.version
}
