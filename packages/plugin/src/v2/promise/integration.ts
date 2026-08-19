import type { IntegrationDraft, IntegrationMethodRegistration } from "../effect/integration.ts"
import type { CredentialValue } from "@klautcode/sdk/v2/types"
import type { Hooks } from "./registration.ts"

export type { IntegrationDraft, IntegrationMethodRegistration }

export interface IntegrationHooks extends Hooks<{ transform: IntegrationDraft }> {
  readonly connection: {
    readonly active: (integrationID: string) => Promise<import("@klautcode/sdk/v2/types").ConnectionInfo | undefined>
    readonly resolve: (
      connection: import("@klautcode/sdk/v2/types").ConnectionInfo,
    ) => Promise<CredentialValue | undefined>
  }
}
