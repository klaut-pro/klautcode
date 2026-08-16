#!/usr/bin/env bun
import { $ } from "bun"
import { existsSync } from "node:fs"

import { downloadCliToResources, resolveChannel } from "./utils"

const channel = resolveChannel()
await $`bun ./scripts/copy-icons.ts ${channel}`
await $`bun ./scripts/copy-metainfo.ts ${channel}`

await $`cd ../klautcode && bun script/build-node.ts`
// Reuse a locally cached CLI binary so rebuilds do not depend on the published
// @klautcode/cli-* npm packages (which may not exist for dev builds).
if (channel === "dev" && !existsSync("resources/klautcode-cli")) await downloadCliToResources()
