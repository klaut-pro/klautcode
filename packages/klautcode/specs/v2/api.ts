// @ts-nocheck

import { Klautcode } from "@klautcode/core"
import { ReadTool } from "@klautcode/core/tools"

const klautcode = Klautcode.make({})

klautcode.tool.add(ReadTool)

klautcode.tool.add({
  name: "bash",
  schema: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "The command to run.",
      },
    },
    required: ["command"],
  },
  execute(input, ctx) {},
})

klautcode.auth.add({
  provider: "openai",
  type: "api",
  value: process.env.OPENAI_API_KEY,
})

klautcode.agent.add({
  name: "build",
  permissions: [],
  model: {
    id: "gpt-5-5",
    provider: "openai",
    variant: "xhigh",
  },
})

const sessionID = await klautcode.session.create({
  agent: "build",
})

klautcode.subscribe((event) => {
  console.log(event)
})

await klautcode.session.prompt({
  sessionID,
  text: "hey what is up",
})

await klautcode.session.prompt({
  sessionID,
  text: "what is up with this",
  files: [
    {
      mime: "image/png",
      uri: "data:image/png;base64,xxxx",
    },
  ],
})

await klautcode.session.wait()

console.log(await klautcode.session.messages(sessionID))
