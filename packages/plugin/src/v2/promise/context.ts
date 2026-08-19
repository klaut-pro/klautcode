import type { PluginOptions } from "../options.ts"
import type { AgentHooks } from "./agent.ts"
import type { AISDKHooks } from "./aisdk.ts"
import type { CatalogHooks } from "./catalog.ts"
import type { CommandHooks } from "./command.ts"
import type { IntegrationHooks } from "./integration.ts"
import type { PluginDomain } from "./plugin.ts"
import type { ReferenceHooks } from "./reference.ts"
import type { SkillHooks } from "./skill.ts"
import type { Reload } from "./registration.ts"

export interface PluginContext {
  readonly options: PluginOptions
  readonly agent: AgentHooks & Reload
  readonly aisdk: AISDKHooks
  readonly catalog: CatalogHooks & Reload
  readonly command: CommandHooks & Reload
  readonly integration: IntegrationHooks & Reload
  readonly plugin: PluginDomain
  readonly reference: ReferenceHooks & Reload
  readonly skill: SkillHooks & Reload
}
