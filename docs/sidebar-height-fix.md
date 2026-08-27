# Fix: left sidebar ends at a different height than the middle and right columns

**Visual proof:** `sidebar-height-fix.png` (packaged app — all three columns end at
the same bottom edge; the sidebar's rounded corner is no longer clipped).

## Symptom

The chats sidebar's bottom did not align with the middle chat column and the
right browser panel: the sidebar ran all the way to the window's bottom edge
(its rounded corner clipped), while the other two columns stopped 8px earlier
with a visible gap. Measured: sidebar bottom **948** vs middle/right bottom
**932** (window 940 tall).

## Root cause

The sidebar sits in a flex row next to the content column:

```jsx
<div class="flex size-full">
  <ProjectChatsSidebar />   // h-full + my-2
  <div class="flex-1 min-w-0">…</div>
</div>
```

`ProjectChatsSidebar` used `h-full` (height: 100% = exactly the row's height)
*plus* `my-2` top/bottom margins. In a flex row the margins are added outside
that explicit height, so the sidebar's footprint was 16px taller than the row:
its bottom landed 8px past the row (clipped at the window edge) while the
middle/right panels — inset by the row's `p-2` padding — stopped 8px earlier.
The sidebar's collapsed rail sibling already used `self-stretch` correctly; the
expanded sidebar was the odd one out.

## Fix (`packages/app/src/components/project-chats-sidebar.tsx`)

Replaced the expanded sidebar's `h-full` with `self-stretch`. The row's default
`align-items: stretch` then sizes the sidebar to row height minus its margins
(888px), so its bottom lands at 932 — flush with the middle and right columns.

## Verification

- Live A/B in the running app: `h-full` → sidebar bottom 948 (clipped);
  `self-stretch` → bottom 932, matching the panels exactly.
- Packaged app (rebuilt + reinstalled): sidebar bottom 932, review/browser
  panels 932 — all three columns aligned; screenshot above.
- Regression test `project-chats-sidebar.regression.test.ts` pins the expanded
  sidebar to `self-stretch` (not `h-full`) and the rail to the same pattern;
  verified it fails against the old `h-full` class. App typecheck green.
