# Cutting a release manually (runbook)

The normal release flow is automated: pushing to `dev` triggers `release-prep`
(which drafts the next patch release via `script/version.ts`), and creating the
release triggers `publish` (which builds every platform artifact and attaches
them). When GitHub Actions is unavailable — e.g. hosted runners blocked by an
account billing issue ("recent account payments have failed") — you can cut a
release manually from a Mac. This is exactly what was done for v1.18.17.

## Prerequisites

- `gh` authenticated with write access to `klaut-pro/klautcode`.
- A Mac (mac-arm64 artifacts are the only ones buildable locally without the
  CI pipeline).
- The repo checked out on `main` at the commit you want to release.

## Steps

### 1. Pick the version and check the changelog scope

```bash
git fetch origin main
git log --oneline <last-release-tag>..origin/main   # e.g. v1.18.16..origin/main
```

If a stale draft already exists for the version (from a `release-prep` run that
predates newer commits), delete it — it will not contain the current work:

```bash
gh release delete v1.18.17 --yes   # only if the tag/commit it points at is stale
```

### 2. Generate release notes

```bash
git log v1.18.16..HEAD --format="%s" | sed 's/^/- /' > /tmp/notes.md
```

Group them into Features / Fixes / Tests / Docs & Chores for readability.

### 3. Create the release from current main

```bash
gh release create v1.18.17 \
  --target main \
  --title "v1.18.17" \
  --notes-file /tmp/notes.md
```

This publishes immediately (omit nothing; do **not** pass `-d` unless you want a
draft). Creating the release fires the `publish` workflow — it will fail to
start if runners are blocked, which is expected and harmless.

### 4. Build the mac-arm64 artifacts with the release version baked in

**Critical:** the app version in `packages/desktop/package.json` is *not* the
release version. The CI pipeline bumps it at build time; locally you must pass
`extraMetadata.version` or the built app and `latest-mac.yml` will report the
stale package.json version and auto-update will silently never offer the
release:

```bash
cd packages/desktop
bun run package:mac -- --config.extraMetadata.version=1.18.17
```

Verify before uploading:

```bash
head -1 dist/latest-mac.yml        # must say: version: 1.18.17
```

### 5. Upload the auto-update set

```bash
cd packages/desktop
gh release upload v1.18.17 \
  dist/klautcode-desktop-mac-arm64.dmg \
  dist/klautcode-desktop-mac-arm64.dmg.blockmap \
  dist/klautcode-desktop-mac-arm64.zip \
  dist/klautcode-desktop-mac-arm64.zip.blockmap \
  dist/latest-mac.yml \
  --clobber
```

### 6. Verify

```bash
gh release view v1.18.17 --json isDraft,isPrerelease,publishedAt
gh release download v1.18.17 -p latest-mac.yml --repo klaut-pro/klautcode --clobber && head -1 latest-mac.yml
```

The downloaded yml must show the release version.

## What a manual release does NOT include

- **CLI packages** (darwin/linux/windows zips) and **desktop builds for
  linux/windows/mac-x64**. Those come only from the CI `publish` workflow. Until
  the runner block is lifted, other platforms keep updating from the previous
  full release.
- Once runners work again, re-run the workflow to fill the gap:

```bash
gh workflow run publish.yml -f version=1.18.17
```

The workflow uploads with `--clobber` and re-publishes, so re-running against
an existing release is safe.
