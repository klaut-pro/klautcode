export * from "./client.js"
export * from "./server.js"

import { createKlautcodeClient } from "./client.js"
import { createKlautcodeServer } from "./server.js"
import type { ServerOptions } from "./server.js"

export * as data from "./data.js"

export async function createKlautcode(options?: ServerOptions) {
  const server = await createKlautcodeServer({
    ...options,
  })

  const client = createKlautcodeClient({
    baseUrl: server.url,
  })

  return {
    client,
    server,
  }
}
