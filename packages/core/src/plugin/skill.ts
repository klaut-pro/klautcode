/// <reference path="../markdown.d.ts" />

export * as SkillPlugin from "./skill"

import { define } from "./internal"
import { Effect } from "effect"
import { AbsolutePath } from "../schema"
import { SkillV2 } from "../skill"
import customizeKlautcodeContent from "./skill/customize-klautcode.md" with { type: "text" }

export const CustomizeKlautcodeContent = customizeKlautcodeContent

export const Plugin = define({
  id: "skill",
  effect: Effect.fn(function* (ctx) {
    yield* ctx.skill.transform((draft) => {
      draft.source(
        SkillV2.EmbeddedSource.make({
          type: "embedded",
          skill: SkillV2.Info.make({
            name: "customize-klautcode",
            description:
              "Use ONLY when the user is editing or creating klautcode's own configuration: klautcode.json, klautcode.jsonc, files under .klautcode/, or files under ~/.config/klautcode/. Also use when creating or fixing klautcode agents, subagents, commands, skills, plugins, MCP servers, or permission rules. Do not use for the user's own application code, or for any project that is not configuring klautcode itself.",
            location: AbsolutePath.make("/builtin/customize-klautcode.md"),
            content: CustomizeKlautcodeContent,
          }),
        }),
      )
    })
  }),
})
