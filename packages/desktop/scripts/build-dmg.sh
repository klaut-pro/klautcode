#!/usr/bin/env bash
set -euo pipefail

# Build the Klautcode desktop DMG.
#
# Usage:
#   ./scripts/build-dmg.sh           # Full rebuild (CLI + app + DMG)
#   ./scripts/build-dmg.sh --skip-cli  # Skip CLI rebuild (faster for UI-only changes)
#
# Output: ~/Downloads/klautcode-desktop-mac-arm64.dmg

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(cd "$DESKTOP_DIR/../.." && pwd)"
DOWNLOADS_DIR="$HOME/Downloads"
DMG_NAME="klautcode-desktop-mac-arm64"

SKIP_CLI=false
if [[ "${1:-}" == "--skip-cli" ]]; then
  SKIP_CLI=true
fi

export KLAUTCODE_CHANNEL=prod

cd "$DESKTOP_DIR"

# Always refresh icons and metainfo (cheap); skip CLI rebuild only for --skip-cli
bun ./scripts/copy-icons.ts prod
bun ./scripts/copy-metainfo.ts prod

if [[ "$SKIP_CLI" == "true" ]]; then
  echo ">>> Skipping CLI build (UI-only changes)"
  echo ">>> Building renderer..."
  npx electron-vite build
else
  echo ">>> Full build (CLI + renderer)..."
  cd "$ROOT_DIR/packages/klautcode"
  bun script/build-node.ts
  cd "$DESKTOP_DIR"
  npx electron-vite build
fi

echo ">>> Packaging DMG..."
bun run package

DMG_PATH="$DESKTOP_DIR/dist/$DMG_NAME.dmg"

if [[ -f "$DMG_PATH" ]]; then
  echo ">>> Installing DMG to Downloads..."
  rm -f "$DOWNLOADS_DIR/$DMG_NAME.dmg"
  cp "$DMG_PATH" "$DOWNLOADS_DIR/$DMG_NAME.dmg"
  echo ">>> Done: $DOWNLOADS_DIR/$DMG_NAME.dmg"
  ls -lh "$DOWNLOADS_DIR/$DMG_NAME.dmg"
else
  echo ">>> ERROR: DMG not found at $DMG_PATH"
  exit 1
fi
