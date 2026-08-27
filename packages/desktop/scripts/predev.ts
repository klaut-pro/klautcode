import { $ } from "bun"
import { existsSync } from "node:fs"

import { downloadCliToResources } from "./utils"

await $`bun run install-electron`

await $`bun ./scripts/copy-icons.ts ${process.env.KLAUTCODE_CHANNEL ?? "prod"}`

await $`cd ../klautcode && bun script/build-node.ts`
// Reuse a locally cached CLI binary so `bun run dev` does not depend on the
// published @klautcode/cli-* npm packages (which 404 for dev builds). The CLI
// version is pinned in utils.ts, so the cached copy is authoritative.
if (!existsSync("resources/klautcode-cli")) await downloadCliToResources()
