import { Catalog } from "@klautcode/core/catalog"
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { Api } from "../api"
import { readAuthKeys } from "./auth-keys"
import { response } from "../location"

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
