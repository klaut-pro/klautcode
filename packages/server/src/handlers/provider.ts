import { Catalog } from "@klautcode/core/catalog"
import { Global } from "@klautcode/core/global"
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { Api } from "../api"
import { ProviderNotFoundError } from "@klautcode/protocol/errors"
import { response } from "../location"

function readAuthKeys(): Set<string> {
  try {
    const raw = require("node:fs").readFileSync(Global.Path.data + "/auth.json", "utf8")
    const parsed = JSON.parse(raw) as Record<string, { type?: string }>
    return new Set(
      Object.entries(parsed)
        .filter(([, info]) => info.type === "api")
        .map(([id]) => id),
    )
  } catch {
    return new Set<string>()
  }
}

export const ProviderHandler = HttpApiBuilder.group(Api, "server.provider", (handlers) =>
  Effect.gen(function* () {
    const authKeys = readAuthKeys()

    return handlers
      .handle(
        "provider.list",
        Effect.fn(function* () {
          const catalog = yield* Catalog.Service
          const providers = (yield* catalog.provider.all()).filter(
            (provider) => !provider.disabled && (authKeys.has(provider.id) || typeof provider.request.body.apiKey === "string"),
          )
          return yield* response(Effect.succeed(providers))
        }),
      )
      .handle(
        "provider.get",
        Effect.fn(function* (ctx) {
          const catalog = yield* Catalog.Service
          const provider = yield* catalog.provider.get(ctx.params.providerID)
          if (!provider)
            return yield* new ProviderNotFoundError({
              providerID: ctx.params.providerID,
              message: `Provider not found: ${ctx.params.providerID}`,
            })
          return yield* response(Effect.succeed(provider))
        }),
      )
  }),
)
