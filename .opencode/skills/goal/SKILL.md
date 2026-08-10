---
name: goal
description: Pursue a stated goal to full completion across multiple iterations instead of stopping after the first sub-goal. Use ONLY when the user states a goal, objective, or target outcome (e.g. "goal:", "achieve X", "goal is to", "/goal", "/loop") and expects the full outcome to be satisfied, not just the first step.
---

# Goal

A goal is an objective that is satisfied only when the user's stated outcome is fully met. Reaching one sub-goal is progress, not completion. Keep working through sub-goals until the goal is achieved, an iteration limit is reached, or the goal is shown to be infeasible.

## When to apply

- The user states a goal and expects the full outcome, not just a first step.
- A previous step completed but the overall goal remains unmet.
- The task is inherently iterative: build, verify, fix, re-verify.

## Loop protocol

1. **Restate the goal** in one sentence so the definition of done is explicit.
2. **Plan sub-goals** — break the goal into ordered, verifiable sub-goals.
3. **Execute the next sub-goal** toward the goal.
4. **Verify** whether the overall goal is now satisfied using concrete evidence (tests, commands, file contents), not assumption.
5. **Decide**: continue to the next sub-goal, or stop.
6. **Report** concise progress after every iteration: what was done, what remains, and the iteration count.

### Stop conditions

Stop the loop when any of these hold:

- **Goal achieved** — verification shows the stated outcome is fully met.
- **Iteration limit reached** — the configured `maxIterations` (default **5**) is exhausted; do not silently loop past it.
- **Infeasible** — further iterations cannot make progress with the available tools, or the goal is contradictory; explain why and stop.
- **User interruption** — the user interrupts mid-loop; present partial results and where you left off.

## Guidance

- Keep each iteration meaningful: make real progress toward the goal, then verify. Do not spin on the same failed step more than twice without changing approach.
- When a step fails, adapt: inspect the failure, adjust the approach, and retry as part of the same goal — a failed step does not abort the goal unless it proves infeasible.
- Verify with the best evidence available: run tests, read the actual output, check the filesystem. Do not claim completion from reasoning alone.
- Progress reports should be short — a line or two per iteration — so output does not flood the user. Only expand detail on failure or on user request.
- Respect tool permissions and rate limits: batch requests sensibly and do not hammer the same tool when an approach is clearly not converging.
- If the user asks for `maxIterations` or a count, honor it. Otherwise use the default of 5 unless the goal's scale clearly needs more.
- Partial results matter: if the loop stops early (limit, infeasible, or interrupt), summarize what is done, what is left, and how to resume.

## Example flow

```
goal: add dark mode to the settings page

1. restate: dark mode is done when settings has a working dark toggle persisted across reloads
2. plan: [theme store, toggle UI, persistence, verification]
3. iteration 1: add theme store; verify state switches
4. iteration 2: add toggle UI; verify it flips the theme
5. iteration 3: persist choice; verify across reload
6. iteration 4: run full check; goal achieved -> stop
```
