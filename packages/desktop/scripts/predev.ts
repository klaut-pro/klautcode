import { $ } from "bun"
import { downloadCliToResources } from "./utils"

await $`bun run install-electron`

await $`bun ./scripts/copy-icons.ts ${process.env.KLAUTCODE_CHANNEL ?? "prod"}`

await $`cd ../klautcode && bun script/build-node.ts`
await downloadCliToResources()
