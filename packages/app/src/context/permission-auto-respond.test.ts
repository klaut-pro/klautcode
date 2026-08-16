import { describe, expect, test } from "bun:test"
import type { PermissionRequest, Session } from "@klautcode/sdk/v2/client"
import { base64Encode } from "@klautcode/core/util/encode"
import {
  autoRespondsPermission,
  isDirectoryAutoAccepting,
  sessionAutoAccept,
  configAllowsPermission,
  isAllowAllPermission,
} from "./permission-auto-respond"

const session = (input: { id: string; parentID?: string }) =>
  ({
    id: input.id,
    parentID: input.parentID,
  }) as Session

const permission = (sessionID: string) =>
  ({
    sessionID,
  }) as Pick<PermissionRequest, "sessionID">

describe("autoRespondsPermission", () => {
  test("uses a parent session's directory-scoped auto-accept", () => {
    const directory = "/tmp/project"
    const sessions = [session({ id: "root" }), session({ id: "child", parentID: "root" })]
    const autoAccept = {
      [`${base64Encode(directory)}/root`]: true,
    }

    expect(autoRespondsPermission(autoAccept, sessions, permission("child"), directory)).toBe(true)
  })

  test("uses a parent session's legacy auto-accept key", () => {
    const sessions = [session({ id: "root" }), session({ id: "child", parentID: "root" })]

    expect(autoRespondsPermission({ root: true }, sessions, permission("child"), "/tmp/project")).toBe(true)
  })

  test("defaults to requiring approval when no lineage override exists", () => {
    const sessions = [session({ id: "root" }), session({ id: "child", parentID: "root" }), session({ id: "other" })]
    const autoAccept = {
      other: true,
    }

    expect(autoRespondsPermission(autoAccept, sessions, permission("child"), "/tmp/project")).toBe(false)
  })

  test("inherits a parent session's false override", () => {
    const directory = "/tmp/project"
    const sessions = [session({ id: "root" }), session({ id: "child", parentID: "root" })]
    const autoAccept = {
      [`${base64Encode(directory)}/root`]: false,
    }

    expect(autoRespondsPermission(autoAccept, sessions, permission("child"), directory)).toBe(false)
  })

  test("prefers a child override over parent override", () => {
    const directory = "/tmp/project"
    const sessions = [session({ id: "root" }), session({ id: "child", parentID: "root" })]
    const autoAccept = {
      [`${base64Encode(directory)}/root`]: false,
      [`${base64Encode(directory)}/child`]: true,
    }

    expect(autoRespondsPermission(autoAccept, sessions, permission("child"), directory)).toBe(true)
  })

  test("falls back to directory-level auto-accept", () => {
    const directory = "/tmp/project"
    const sessions = [session({ id: "root" })]
    const autoAccept = {
      [`${base64Encode(directory)}/*`]: true,
    }

    expect(autoRespondsPermission(autoAccept, sessions, permission("root"), directory)).toBe(true)
    expect(sessionAutoAccept(autoAccept, sessions, permission("root"), directory)).toBeUndefined()
  })

  test("session-level override takes precedence over directory-level", () => {
    const directory = "/tmp/project"
    const sessions = [session({ id: "root" })]
    const autoAccept = {
      [`${base64Encode(directory)}/*`]: true,
      [`${base64Encode(directory)}/root`]: false,
    }

    expect(autoRespondsPermission(autoAccept, sessions, permission("root"), directory)).toBe(false)
  })

  test("parent false override takes precedence over directory-level auto-accept", () => {
    const directory = "/tmp/project"
    const sessions = [session({ id: "root" }), session({ id: "child", parentID: "root" })]
    const autoAccept = {
      [`${base64Encode(directory)}/*`]: true,
      [`${base64Encode(directory)}/root`]: false,
    }

    expect(autoRespondsPermission(autoAccept, sessions, permission("child"), directory)).toBe(false)
  })

  test("parent true override takes precedence over disabled directory fallback", () => {
    const directory = "/tmp/project"
    const sessions = [session({ id: "root" }), session({ id: "child", parentID: "root" })]
    const autoAccept = {
      [`${base64Encode(directory)}/*`]: false,
      [`${base64Encode(directory)}/root`]: true,
    }

    expect(autoRespondsPermission(autoAccept, sessions, permission("child"), directory)).toBe(true)
  })
})

describe("isDirectoryAutoAccepting", () => {
  test("returns true when directory key is set", () => {
    const directory = "/tmp/project"
    const autoAccept = { [`${base64Encode(directory)}/*`]: true }
    expect(isDirectoryAutoAccepting(autoAccept, directory)).toBe(true)
  })

  test("returns false when directory key is not set", () => {
    expect(isDirectoryAutoAccepting({}, "/tmp/project")).toBe(false)
  })

  test("returns false when directory key is explicitly false", () => {
    const directory = "/tmp/project"
    const autoAccept = { [`${base64Encode(directory)}/*`]: false }
    expect(isDirectoryAutoAccepting(autoAccept, directory)).toBe(false)
  })
})

describe("configAllowsPermission", () => {
  test("allows a permission when the config has a wildcard allow", () => {
    expect(
      configAllowsPermission({ "*": "allow" }, { permission: "edit", patterns: ["src/foo.ts"] }),
    ).toBe(true)
  })

  test("allows a permission when the config allows that tool", () => {
    expect(
      configAllowsPermission({ edit: "allow" }, { permission: "edit", patterns: ["src/foo.ts"] }),
    ).toBe(true)
  })

  test("does not allow a permission that is not configured", () => {
    expect(
      configAllowsPermission({ edit: "allow" }, { permission: "read", patterns: ["src/foo.ts"] }),
    ).toBe(false)
  })

  test("respects pattern-specific rules with ask precedence", () => {
    expect(
      configAllowsPermission(
        { read: { "*": "allow", "*.env": "ask" } },
        { permission: "read", patterns: [".env"] },
      ),
    ).toBe(false)
    expect(
      configAllowsPermission(
        { read: { "*": "allow", "*.env": "ask" } },
        { permission: "read", patterns: ["src/foo.ts"] },
      ),
    ).toBe(true)
  })

  test("requires every pattern to be allowed", () => {
    expect(
      configAllowsPermission(
        { edit: "allow", read: "ask" },
        { permission: "edit", patterns: ["a.ts", "b.ts"] },
      ),
    ).toBe(true)
    expect(
      configAllowsPermission(
        { edit: "allow", read: "ask" },
        { permission: "read", patterns: ["a.ts", "b.ts"] },
      ),
    ).toBe(false)
  })

  test("normalizes a string config permission to a wildcard rule", () => {
    expect(configAllowsPermission("allow", { permission: "bash", patterns: ["*"] })).toBe(true)
    expect(configAllowsPermission("ask", { permission: "bash", patterns: ["*"] })).toBe(false)
  })

  test("returns false when no permission rules are configured", () => {
    expect(configAllowsPermission(undefined, { permission: "edit", patterns: ["a.ts"] })).toBe(false)
    expect(configAllowsPermission({}, { permission: "edit", patterns: ["a.ts"] })).toBe(false)
  })
})

describe("isAllowAllPermission", () => {
  test("accepts the string allow form", () => {
    expect(isAllowAllPermission("allow")).toBe(true)
    expect(isAllowAllPermission("ask")).toBe(false)
  })

  test("accepts an object whose rules all allow", () => {
    expect(isAllowAllPermission({ "*": "allow" })).toBe(true)
    expect(isAllowAllPermission({ edit: "allow", read: "allow" })).toBe(true)
    expect(isAllowAllPermission({ edit: "allow", read: "ask" })).toBe(false)
  })

  test("rejects empty or non-object input", () => {
    expect(isAllowAllPermission(undefined)).toBe(false)
    expect(isAllowAllPermission({})).toBe(false)
  })
})
