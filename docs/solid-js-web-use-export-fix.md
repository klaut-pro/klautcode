# Fix: bun test "Export named 'use' not found in module 'solid-js/web/dist/server.js'"

## Symptom

`bun test` failed for the app package:

```
SyntaxError: Export named 'use' not found in module
'.../node_modules/.bun/solid-js@1.9.10/node_modules/solid-js/web/dist/server.js'.
```

9 tests failed and 6 unhandled errors were reported across the suite. The
failures were confined to `src/context/comments.test.ts`,
`src/context/terminal.test.ts`, and `src/components/prompt-input/submit.test.ts`
— but the root cause was global: **any** test whose module graph reaches certain
Solid-ecosystem packages could not load.

## Root cause

Three facts combine:

1. **`bun test` resolves `solid-js/web` to the SSR build.** The package's
   `exports` map lists a `node` condition pointing at `dist/server.js`, and bun
   applies the `node` condition in tests. That build exports the server render
   functions (`renderToString`, …) but **not** `use`.
2. **`use` only exists in the client/development builds.** Solid 1.9 added
   `use(fn, element, arg)` (the binder behind `use:` directives) to
   `solid-js/web`'s browser builds (`dist/web.js`, `dist/dev.js`). It was never
   added to the server build — grepping `dist/server.js` for the export finds
   only the SVG tag name `use`, and even solid-js 1.9.15 / 2.0.0-rc.3 lack it.
3. **Ecosystem packages import `use` unconditionally.** `@thisbeyond/solid-dnd`
   (0.7.5, latest) and `solid-sonner` (0.3.1/0.3.2, latest) both start their
   entry with `import { …, use } from "solid-js/web"`. Since `use` is never
   called on the server, these libraries are simply not SSR-import safe — any
   environment that links their client entry against the server build of
   solid-js/web dies with the export error.

Dead ends explored before settling on the fix: upgrading solid-js (the server
build never shipped `use`), upgrading solid-dnd/solid-sonner (already latest,
still import `use`), and `bunfig.toml [alias]` (bun test does not honor
aliases).

## Fix (`packages/app/happydom.ts`)

The test preload now maps the specifier to the **development build**, which
exports `use` **and** every SSR render function, so behavior is compatible:

```ts
mock.module("solid-js/web", async () => {
  const mod = await import(
    "../../node_modules/.bun/solid-js@1.9.10/node_modules/solid-js/web/dist/dev.js"
  )
  return { ...mod }
})
```

`mock.module` intercepts the specifier for every importer (including
node_modules), so the preload unblocks the whole suite without touching any
library or the app source.

## Verification

- Before: `9 fail / 6 errors` (comments, terminal, submit tests).
- After: **795 pass / 0 fail** across 113 files (app suite), app + ui
  typechecks green.
