#!/usr/bin/env bun

// Fails when dist/latest-mac.yml's version does not match the release version
// the app was packaged with. The CI publish workflow runs the same invariant
// ("Verify update metadata matches release version"); this is the local twin so
// a manual release (docs/release-runbook.md) fails before upload instead of
// shipping update metadata that silently disables auto-update.
//
// Usage: bun scripts/check-update-metadata.ts <expected-version>

const expected = process.argv[2]
if (!expected) {
  console.error("usage: bun scripts/check-update-metadata.ts <expected-version>")
  process.exit(1)
}

const file = new URL("../dist/latest-mac.yml", import.meta.url)
const text = await Bun.file(file)
  .text()
  .catch(() => "")

const actual = text.match(/^version:\s*(.+)$/m)?.[1]?.trim()

if (actual !== expected) {
  console.error(
    `latest-mac.yml version '${actual ?? "(missing)"}' does not match release version '${expected}'. ` +
      `The app must be packaged with --config.extraMetadata.version=${expected}, ` +
      `or auto-update will never offer this release.`,
  )
  process.exit(1)
}

console.log(`update metadata OK: latest-mac.yml version ${actual}`)
