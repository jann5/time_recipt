#!/usr/bin/env bash
set -euo pipefail

APP_NAME="Fugit"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_BUNDLE_DIR="$ROOT_DIR/src-tauri/target/release/bundle/macos"
APP_PATH="$APP_BUNDLE_DIR/$APP_NAME.app"
DMG_OUT_DIR="$ROOT_DIR/src-tauri/target/release/bundle/dmg"
DMG_OUT_PATH="$DMG_OUT_DIR/$APP_NAME.dmg"
BG_PATH="$ROOT_DIR/src-tauri/dmg/background.png"

cd "$ROOT_DIR"

if ! command -v create-dmg >/dev/null 2>&1; then
  echo "Missing dependency: create-dmg"
  echo "Install with: brew install create-dmg"
  exit 1
fi

# Keep Swift/Clang module cache local to project (works in sandboxed environments).
export SWIFT_MODULE_CACHE_PATH="$ROOT_DIR/.cache/swift-module-cache"
export CLANG_MODULE_CACHE_PATH="$ROOT_DIR/.cache/clang-module-cache"
mkdir -p "$SWIFT_MODULE_CACHE_PATH" "$CLANG_MODULE_CACHE_PATH"

echo "1/3 Building macOS app bundle..."
npm run tauri build -- --bundles app

if [[ ! -d "$APP_PATH" ]]; then
  echo "App bundle not found: $APP_PATH"
  exit 1
fi

echo "2/3 Generating DMG background..."
swift "$ROOT_DIR/scripts/generate-dmg-background.swift"

echo "3/3 Building custom DMG..."
mkdir -p "$DMG_OUT_DIR"
rm -f "$DMG_OUT_PATH"
rm -f "$APP_BUNDLE_DIR"/rw.*.dmg || true

# Cleanup stale mounted DMG volumes from previous failed runs.
for vol in /Volumes/dmg.* "/Volumes/$APP_NAME"; do
  if [[ -d "$vol" ]]; then
    hdiutil detach "$vol" -quiet || true
  fi
done

create-dmg \
  --volname "$APP_NAME" \
  --volicon "$ROOT_DIR/src-tauri/icons/icon.icns" \
  --window-pos 180 140 \
  --window-size 456 276 \
  --disk-image-size 256 \
  --background "$BG_PATH" \
  --icon-size 84 \
  --icon "$APP_NAME.app" 126 150 \
  --app-drop-link 332 150 \
  --hide-extension "$APP_NAME.app" \
  "$DMG_OUT_PATH" \
  "$APP_BUNDLE_DIR"

rm -f "$APP_BUNDLE_DIR"/rw.*.dmg || true

echo "Done: $DMG_OUT_PATH"
