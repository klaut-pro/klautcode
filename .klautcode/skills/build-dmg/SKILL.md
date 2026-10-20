---
name: build-dmg
description: Build the Klautcode desktop DMG for macOS
---

# Build DMG

Builds the Klautcode desktop app and packages it as a macOS DMG.

## Quick Start

```bash
./packages/desktop/scripts/build-dmg.sh
```

## Options

- **Full build** (CLI + renderer + DMG): `./packages/desktop/scripts/build-dmg.sh`
- **Fast rebuild** (renderer + DMG only, skips CLI rebuild): `./packages/desktop/scripts/build-dmg.sh --skip-cli`

The `--skip-cli` flag skips the CLI rebuild (faster when only UI/CSS/app source changed). Both modes refresh icons and metainfo.

## Output

The DMG is placed at `~/Downloads/klautcode-desktop-mac-arm64.dmg` (the old DMG is replaced automatically).

## Prerequisites

- macOS (for code signing and DMG creation)
- Electron dependencies installed (`bun install` in `packages/desktop`)
- `KLAUTCODE_CHANNEL=prod` is set by the script
