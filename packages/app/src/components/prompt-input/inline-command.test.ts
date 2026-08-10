import { describe, expect, test } from "bun:test"
import { findInlineCommand, inlineCommandPrompt } from "./inline-command"

const commands = [{ name: "sdd" }, { name: "review" }]

describe("findInlineCommand", () => {
  test("detects a leading command with args", () => {
    expect(findInlineCommand("/sdd auth module", commands)).toEqual({
      name: "sdd",
      args: "auth module",
      preamble: "",
      postamble: "",
    })
  })

  test("detects a command embedded mid-sentence", () => {
    expect(findInlineCommand("Hey, please /sdd the auth module", commands)).toEqual({
      name: "sdd",
      args: "the auth module",
      preamble: "Hey, please",
      postamble: "",
    })
  })

  test("detects a trailing command", () => {
    expect(findInlineCommand("Write a README /sdd architecture overview", commands)).toEqual({
      name: "sdd",
      args: "architecture overview",
      preamble: "Write a README",
      postamble: "",
    })
  })

  test("captures postamble after the command", () => {
    expect(findInlineCommand("/sdd the auth module then review it", commands)).toEqual({
      name: "sdd",
      args: "the auth module then review it",
      preamble: "",
      postamble: "",
    })
  })

  test("ignores unknown commands so the prose is preserved", () => {
    expect(findInlineCommand("run /nope and continue", commands)).toBeUndefined()
  })

  test("returns the first known command when several are present", () => {
    expect(findInlineCommand("start /review then /sdd finalize", commands)?.name).toBe("review")
  })
})

describe("inlineCommandPrompt", () => {
  test("joins preamble, args, and postamble", () => {
    expect(inlineCommandPrompt({ preamble: "Hey, please", args: "the auth module", postamble: "" })).toBe(
      "Hey, please\n\nthe auth module",
    )
  })

  test("omits empty sections", () => {
    expect(inlineCommandPrompt({ preamble: "", args: "auth module", postamble: "" })).toBe("auth module")
  })
})
