import { Config } from "effect"

export function truthy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "true" || value === "1"
}

const copy = process.env["KLAUTCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"]
const fff = process.env["KLAUTCODE_DISABLE_FFF"]

function enabledByExperimental(key: string) {
  return process.env[key] === undefined ? truthy("KLAUTCODE_EXPERIMENTAL") : truthy(key)
}

export const Flag = {
  OTEL_EXPORTER_OTLP_ENDPOINT: process.env["OTEL_EXPORTER_OTLP_ENDPOINT"],
  OTEL_EXPORTER_OTLP_HEADERS: process.env["OTEL_EXPORTER_OTLP_HEADERS"],

  KLAUTCODE_AUTO_HEAP_SNAPSHOT: truthy("KLAUTCODE_AUTO_HEAP_SNAPSHOT"),
  KLAUTCODE_GIT_BASH_PATH: process.env["KLAUTCODE_GIT_BASH_PATH"],
  KLAUTCODE_CONFIG: process.env["KLAUTCODE_CONFIG"],
  KLAUTCODE_CONFIG_CONTENT: process.env["KLAUTCODE_CONFIG_CONTENT"],
  KLAUTCODE_DISABLE_AUTOUPDATE: truthy("KLAUTCODE_DISABLE_AUTOUPDATE"),
  KLAUTCODE_ALWAYS_NOTIFY_UPDATE: truthy("KLAUTCODE_ALWAYS_NOTIFY_UPDATE"),
  KLAUTCODE_DISABLE_PRUNE: truthy("KLAUTCODE_DISABLE_PRUNE"),
  KLAUTCODE_DISABLE_TERMINAL_TITLE: truthy("KLAUTCODE_DISABLE_TERMINAL_TITLE"),
  KLAUTCODE_SHOW_TTFD: truthy("KLAUTCODE_SHOW_TTFD"),
  KLAUTCODE_DISABLE_AUTOCOMPACT: truthy("KLAUTCODE_DISABLE_AUTOCOMPACT"),
  KLAUTCODE_DISABLE_MODELS_FETCH: truthy("KLAUTCODE_DISABLE_MODELS_FETCH"),
  KLAUTCODE_DISABLE_MOUSE: truthy("KLAUTCODE_DISABLE_MOUSE"),
  KLAUTCODE_FAKE_VCS: process.env["KLAUTCODE_FAKE_VCS"],
  KLAUTCODE_SERVER_PASSWORD: process.env["KLAUTCODE_SERVER_PASSWORD"],
  KLAUTCODE_SERVER_USERNAME: process.env["KLAUTCODE_SERVER_USERNAME"],
  KLAUTCODE_DISABLE_FFF: fff === undefined ? process.platform === "win32" : truthy("KLAUTCODE_DISABLE_FFF"),

  // Experimental
  KLAUTCODE_EXPERIMENTAL_FILEWATCHER: Config.boolean("KLAUTCODE_EXPERIMENTAL_FILEWATCHER").pipe(
    Config.withDefault(false),
  ),
  KLAUTCODE_EXPERIMENTAL_DISABLE_FILEWATCHER: Config.boolean("KLAUTCODE_EXPERIMENTAL_DISABLE_FILEWATCHER").pipe(
    Config.withDefault(false),
  ),
  KLAUTCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT:
    copy === undefined ? process.platform === "win32" : truthy("KLAUTCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"),
  KLAUTCODE_MODELS_URL: process.env["KLAUTCODE_MODELS_URL"],
  KLAUTCODE_MODELS_PATH: process.env["KLAUTCODE_MODELS_PATH"],
  KLAUTCODE_DB: process.env["KLAUTCODE_DB"],

  KLAUTCODE_WORKSPACE_ID: process.env["KLAUTCODE_WORKSPACE_ID"],
  KLAUTCODE_EXPERIMENTAL_WORKSPACES: enabledByExperimental("KLAUTCODE_EXPERIMENTAL_WORKSPACES"),

  // Evaluated at access time (not module load) because tests, the CLI, and
  // external tooling set these env vars at runtime.
  get KLAUTCODE_DISABLE_PROJECT_CONFIG() {
    return truthy("KLAUTCODE_DISABLE_PROJECT_CONFIG")
  },
  get KLAUTCODE_EXPERIMENTAL_REFERENCES() {
    return enabledByExperimental("KLAUTCODE_EXPERIMENTAL_REFERENCES")
  },
  get KLAUTCODE_TUI_CONFIG() {
    return process.env["KLAUTCODE_TUI_CONFIG"]
  },
  get KLAUTCODE_CONFIG_DIR() {
    return process.env["KLAUTCODE_CONFIG_DIR"]
  },
  get KLAUTCODE_PURE() {
    return truthy("KLAUTCODE_PURE")
  },
  get KLAUTCODE_PERMISSION() {
    return process.env["KLAUTCODE_PERMISSION"]
  },
  get KLAUTCODE_PLUGIN_META_FILE() {
    return process.env["KLAUTCODE_PLUGIN_META_FILE"]
  },
  get KLAUTCODE_CLIENT() {
    return process.env["KLAUTCODE_CLIENT"] ?? "cli"
  },
}
