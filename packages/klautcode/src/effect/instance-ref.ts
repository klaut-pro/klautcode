import { Context } from "effect"
import type { InstanceContext } from "@/project/instance-context"
import type { WorkspaceV2 } from "@klautcode/core/workspace"

export const InstanceRef = Context.Reference<InstanceContext | undefined>("~klautcode/InstanceRef", {
  defaultValue: () => undefined,
})

export const WorkspaceRef = Context.Reference<WorkspaceV2.ID | undefined>("~klautcode/WorkspaceRef", {
  defaultValue: () => undefined,
})
