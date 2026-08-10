---
name: self-improve
description: Self-improving mode. After completing a task, reflect on what went wrong (failures, corrections, dead-ends) and persist actionable lessons to .klautcode/lessons.md, then update relevant skills. Use ONLY when the user enables self-improving mode or explicitly asks to learn from mistakes.
---

# Self-Improving Mode

After a task or request, reflect on what happened and capture actionable lessons so future sessions improve.

## When to apply

- The user enables self-improving mode (e.g. `/self-improve on`) or asks to "learn from mistakes".
- A task involved failures, corrections, dead-ends, or a better approach discovered along the way.

## Protocol

1. **Reflect**: after the task finishes, review what happened. Identify up to 3 concrete lessons: what went wrong, what the correction was, and what to do next time.
2. **Persist lessons**: append each lesson to `.klautcode/lessons.md` under a `## <date>` heading. Keep each lesson to 1-2 lines: the trigger, the failure, the fix.
3. **Update skills** (when a lesson generalizes): if a lesson changes how a recurring task should be done, update the relevant `SKILL.md` under `.klautcode/skills/` (or `~/.config/klautcode/skills/`) with a short "Lessons" note. Do not bloat skills with one-off fixes.
4. **Report**: tell the user what was learned and where it was saved.

## Guidance

- Only persist *actionable* lessons — a lesson must change future behavior. Skip noise.
- Do not log secrets, API keys, or private data in lessons.
- Keep lessons concise; prefer a clear "do X instead of Y" form.
- If no real lesson surfaced, do not fabricate one. Say nothing was learned.
- Respect the user's privacy: lessons are stored locally per project and are never sent anywhere.

## Example lesson

```markdown
## 2026-08-10
- Large test suite: run `bun test --only-failures` from the package dir, not repo root (repo-root guard fails).
```
