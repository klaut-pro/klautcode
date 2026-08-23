import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiError, HttpApiGroup, OpenApi } from "effect/unstable/httpapi"
import { Authorization } from "../middleware/authorization"
import { described } from "./metadata"

export const ToolOutputQuery = Schema.Struct({
  path: Schema.String,
})

export const ToolOutputContent = Schema.Struct({
  content: Schema.String,
})

export const ToolOutputPaths = {
  content: "/tool-output/content",
} as const

export const ToolOutputApi = HttpApi.make("tool-output")
  .add(
    HttpApiGroup.make("tool-output")
      .add(
        HttpApiEndpoint.get("content", ToolOutputPaths.content, {
          query: ToolOutputQuery,
          success: described(ToolOutputContent, "Full tool output"),
          error: [HttpApiError.BadRequest, HttpApiError.NotFound],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "tool-output.read",
            summary: "Read full tool output",
            description: "Read the full output of a truncated tool result saved in the tool output directory.",
          }),
        ),
      )
      .annotateMerge(
        OpenApi.annotations({
          title: "tool-output",
          description: "Experimental HttpApi tool output routes.",
        }),
      )
      .middleware(Authorization),
  )
  .annotateMerge(
    OpenApi.annotations({
      title: "klautcode experimental HttpApi",
      version: "0.0.1",
      description: "Experimental HttpApi surface for selected instance routes.",
    }),
  )