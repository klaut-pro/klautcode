import { describe, expect, test } from "bun:test"

const source = await Bun.file(new URL("./project-chats-sidebar.tsx", import.meta.url)).text()

describe("project chats sidebar height", () => {
  test("expanded sidebar stretches to row height minus margins, not h-full", () => {
    // The sidebar sits in a `flex size-full` row next to the content column
    // (SessionPage / NewSessionPage). `h-full` (height:100%) plus the `my-2`
    // top/bottom margins made its footprint taller than the row: the bottom
    // landed 8px past the row (clipped at the window edge) while the middle
    // and right columns stopped 8px earlier — the three columns ended at
    // different heights. `self-stretch` lets the row's default align-items
    // size the sidebar to row height minus margins, so its bottom aligns with
    // the other columns (932 vs 948 before the fix).
    const sidebarOpen = source.indexOf('id="project-chats-sidebar"')
    expect(sidebarOpen).toBeGreaterThan(-1)
    const openClass = source.slice(sidebarOpen, sidebarOpen + 400)
    expect(openClass).toContain("self-stretch")
    expect(openClass).not.toContain("h-full")
  })

  test("collapsed rail stretches the same way (consistent column bottoms)", () => {
    // The collapsed rail must keep using self-stretch + my-2 so both sidebar
    // states end at the same bottom as the middle/right columns.
    const railOpen = source.indexOf('w-10 shrink-0 self-stretch my-2 ml-2')
    expect(railOpen).toBeGreaterThan(-1)
    const railClass = source.slice(railOpen, railOpen + 200)
    expect(railClass).toContain("self-stretch")
    expect(railClass).toContain("my-2 ml-2")
    expect(railClass).not.toContain("h-full")
  })
})
