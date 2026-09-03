export * as Token from "./token"

const CHARS_PER_TOKEN = 3

export const estimate = (input: string) => Math.max(0, Math.ceil(input.length / CHARS_PER_TOKEN))
