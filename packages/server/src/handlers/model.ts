import { Catalog } from "@klautcode/core/catalog"
import { Global } from "@klautcode/core/global"
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { Api } from "../api"
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

export const ModelHandler = HttpApiBuilder.group(Api, "server.model", (handlers) =>
  Effect.gen(function* () {
    const authKeys = readAuthKeys()
    return handlers.handle(
      "model.list",
      Effect.fn(function* () {
        const catalog = yield* Catalog.Service
        const providers = new Set(
          (yield* catalog.provider.all())
            .filter(
              (provider) =>
                !provider.disabled &&
                (authKeys.has(provider.id) || typeof provider.request.body.apiKey === "string"),
            )
            .map((provider) => provider.id),
        )
        return yield* response(
          Effect.succeed((yield* catalog.model.all()).filter((model) => providers.has(model.providerID))),
        )
      }),
    )
  }),
)
