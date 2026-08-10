// Inline slash command detection (KLA-10). Commands may appear anywhere in a
// prompt — leading "/name args", mid-sentence, or trailing — not only at the
// start of the input.

// Find the first inline slash command in a prompt that matches a known command.
// Returns the command name, the arguments that follow it on the same line, and
// the surrounding context (preamble = text before, postamble = text after).
export function findInlineCommand(
  text: string,
  commands: { name: string }[],
): { name: string; args: string; preamble: string; postamble: string } | undefined {
  const known = new Set(commands.map((c) => c.name))
  const token = /(^|\s)\/([A-Za-z0-9_-]+)(?=\s|$)/g
  let match: RegExpExecArray | null
  while ((match = token.exec(text)) !== null) {
    const name = match[2]
    if (!known.has(name)) continue

    const lead = match.index + match[1].length
    const nameEnd = lead + name.length + 1
    const rest = text.slice(nameEnd)
    const lineEnd = rest.search(/\n/)
    const argsLine = lineEnd === -1 ? rest : rest.slice(0, lineEnd)

    return {
      name,
      args: argsLine.trim(),
      preamble: text.slice(0, match.index + match[1].length).trim(),
      postamble: text.slice(nameEnd + argsLine.length).trim(),
    }
  }
  return undefined
}

// Compose a single prompt string that keeps inline command context: the command
// is executed, and the surrounding prose is passed along as the arguments so the
// user's intent ("Hey, /sdd the auth module") is preserved for the command.
export function inlineCommandPrompt(found: { preamble: string; args: string; postamble: string }): string {
  const parts = [found.preamble, found.args, found.postamble].filter(Boolean)
  return parts.join("\n\n")
}
