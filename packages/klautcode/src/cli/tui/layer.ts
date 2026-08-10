import { run as runTui, type TuiInput } from "@klautcode/tui"
import { Global } from "@klautcode/core/global"
import { AppNodeBuilder } from "@klautcode/core/effect/app-node-builder"
import { Effect } from "effect"

export function run(input: TuiInput) {
  return runTui(input).pipe(Effect.provide(AppNodeBuilder.build(Global.node)))
}
