import { Effect } from "effect"
import { define } from "../internal"

export const HetznerPlugin = define({
  id: "hetzner",
  effect: Effect.fn(function* (ctx) {
    yield* ctx.catalog.transform(
      Effect.fn(function* (evt) {
        for (const item of evt.provider.list()) {
          if (item.provider.disabled) continue
          if (item.provider.api.type !== "aisdk") continue
          if (item.provider.api.package !== "@ai-sdk/openai-compatible") continue
          if (item.provider.api.url !== "https://inference.hetzner.com/api/v1") continue
          evt.provider.update(item.provider.id, (provider) => {
            provider.request.headers["HTTP-Referer"] ??= "https://code.klaut.pro/"
            provider.request.headers["X-Title"] ??= "klautcode"
          })
        }
      }),
    )
  }),
})
