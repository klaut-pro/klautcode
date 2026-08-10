---
name: design
description: Design mode. Use when the user wants to preview, inspect, or edit a UI (web page, app, or component) in design mode — e.g. "design mode", "/design", "preview this page", "edit this element", "make this look better". Use ONLY when the task is about visual/UI design of a running page or component.
---

# Design Mode

Design mode lets you preview and edit a UI, resolving visual issues back to source.

## When to apply

- The user wants to inspect or change the look of a page, app, or component.
- A visual bug, layout issue, or design improvement needs investigating.

## Protocol

1. **Identify the target**: ask or determine the URL, route, or component to design against. If the user gives a URL, open it with browser automation (`agent-browser open <url>`) or fetch it with `webfetch`.
2. **Inspect the current design**: capture the rendered page (snapshot, screenshot, or DOM), note the layout, spacing, colors, typography, and any visual problems.
3. **Locate the source**: map the offending element back to its source file (component, CSS, or markup) so edits are precise.
4. **Propose changes**: describe the intended design change and how it maps to source before editing.
5. **Edit**: apply targeted changes to the source (component/CSS), keeping the change small and consistent with the existing design system.
6. **Verify**: re-preview the result and confirm the change matches the intent.

## Guidance

- Prefer the project's existing design tokens and components over ad hoc values.
- Keep edits minimal and reversible; one coherent change at a time.
- Respect responsive behavior: check narrow/wide widths where the design could break.
- Use the **goal** skill when the design task has multiple sub-goals that must all complete.
- Use the **self-improve** skill if a design iteration revealed a reusable lesson.

## Output

- Before/after description of what changed and where (file + element).
- Note any follow-up design work that remains.
