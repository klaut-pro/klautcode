import { FSUtil } from "@klautcode/core/fs-util"
import { TRUNCATION_DIR } from "@/tool/truncation-dir"
import { Effect } from "effect"
import path from "path"
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi"
import { InstanceHttpApi } from "../api"

export const toolOutputHandlers = HttpApiBuilder.group(InstanceHttpApi, "tool-output", (handlers) =>
  Effect.gen(function* () {
    const fs = yield* FSUtil.Service

    const content = Effect.fn("ToolOutputHttpApi.content")(function* (ctx: { query: { path: string } }) {
      // `path.resolve` normalizes absolute and relative input alike, so traversal
      // sequences land outside TRUNCATION_DIR and fail the containment check.
      const file = path.resolve(TRUNCATION_DIR, ctx.query.path)
      if (!FSUtil.contains(TRUNCATION_DIR, file)) return yield* new HttpApiError.BadRequest({})
      if (!(yield* fs.isFile(file))) return yield* new HttpApiError.NotFound({})
      const text = yield* fs.readFileStringSafe(file).pipe(Effect.orDie)
      if (text === undefined) return yield* new HttpApiError.NotFound({})
      return { content: text }
    })

    return handlers.handle("content", content)
  }),
)