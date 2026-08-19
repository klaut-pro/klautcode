import { base64Encode } from "@klautcode/core/util/encode"
import { Wildcard } from "@klautcode/core/util/wildcard"

export function acceptKey(sessionID: string, directory?: string) {
  if (!directory) return sessionID
  return `${base64Encode(directory)}/${sessionID}`
}

export function directoryAcceptKey(directory: string) {
  return `${base64Encode(directory)}/*`
}

/** Global auto-accept for every request of one permission type (e.g. external_directory). */
export function globalAcceptKey(permission: string) {
  return `*:${permission}`
}

export function isGlobalAutoAccepting(autoAccept: Record<string, boolean>, permission: string) {
  return autoAccept[globalAcceptKey(permission)] === true
}

function accepted(autoAccept: Record<string, boolean>, sessionID: string, directory?: string) {
  const key = acceptKey(sessionID, directory)
  return autoAccept[key] ?? autoAccept[sessionID]
}

export function isDirectoryAutoAccepting(autoAccept: Record<string, boolean>, directory: string) {
  const key = directoryAcceptKey(directory)
  return autoAccept[key] ?? false
}

function sessionLineage(session: { id: string; parentID?: string }[], sessionID: string) {
  const parent = session.reduce((acc, item) => {
    if (item.parentID) acc.set(item.id, item.parentID)
    return acc
  }, new Map<string, string>())
  const seen = new Set([sessionID])
  const ids = [sessionID]

  for (const id of ids) {
    const parentID = parent.get(id)
    if (!parentID || seen.has(parentID)) continue
    seen.add(parentID)
    ids.push(parentID)
  }

  return ids
}

export function autoRespondsPermission(
  autoAccept: Record<string, boolean>,
  session: { id: string; parentID?: string }[],
  permission: { sessionID: string; permission?: string },
  directory?: string,
) {
  const global = permission.permission ? isGlobalAutoAccepting(autoAccept, permission.permission) : false
  if (global) return true
  const value = sessionAutoAccept(autoAccept, session, permission, directory)
  if (value !== undefined) return value
  return directory ? isDirectoryAutoAccepting(autoAccept, directory) : false
}

export function sessionAutoAccept(
  autoAccept: Record<string, boolean>,
  session: { id: string; parentID?: string }[],
  permission: { sessionID: string },
  directory?: string,
) {
  return sessionLineage(session, permission.sessionID)
    .map((id) => accepted(autoAccept, id, directory))
    .find((item): item is boolean => item !== undefined)
}

export type ConfigPermissionRule = { permission: string; pattern: string; action: "allow" | "ask" | "deny" }

// Mirrors the server's `Permission.fromConfig` so the client can honor the
// global config permission (Settings -> Permissions) when deciding whether to
// auto-respond to a prompt, even if the server still asks.
export function permissionConfigRules(permission: unknown): ConfigPermissionRule[] {
  const rules: ConfigPermissionRule[] = []
  const entries =
    typeof permission === "string" ? ([["*", permission]] as const) : Object.entries(permission ?? {})
  for (const [key, value] of entries) {
    if (value === "allow" || value === "ask" || value === "deny") {
      rules.push({ permission: key, pattern: "*", action: value })
      continue
    }
    if (typeof value !== "object" || value === null || Array.isArray(value)) continue
    for (const [pattern, action] of Object.entries(value)) {
      if (action === "allow" || action === "ask" || action === "deny") {
        rules.push({ permission: key, pattern, action })
      }
    }
  }
  return rules
}

export function configAllowsPermission(
  configPermission: unknown,
  permission: { permission: string; patterns: string[] },
) {
  const rules = permissionConfigRules(configPermission)
  if (rules.length === 0) return false
  return permission.patterns.every((pattern) => {
    for (let i = rules.length - 1; i >= 0; i--) {
      const rule = rules[i]
      if (Wildcard.match(permission.permission, rule.permission) && Wildcard.match(pattern, rule.pattern)) {
        return rule.action === "allow"
      }
    }
    return false
  })
}

export function isAllowAllPermission(permission: unknown) {
  if (permission === "allow") return true
  if (typeof permission !== "object" || permission === null || Array.isArray(permission)) return false
  const rules = permissionConfigRules(permission)
  return rules.length > 0 && rules.every((rule) => rule.action === "allow")
}
