#!/usr/bin/env bash
set -euo pipefail

APP_NAME="Fugit"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET_INPUT="${1:-universal-apple-darwin}"
BUILD_MODE="${2:-release}"
TARGET_TRIPLE="$TARGET_INPUT"
if [[ "$TARGET_TRIPLE" == "native" ]]; then
  if [[ "$(uname -m)" == "arm64" ]]; then
    TARGET_TRIPLE="aarch64-apple-darwin"
  else
    TARGET_TRIPLE="x86_64-apple-darwin"
  fi
fi
if [[ "$BUILD_MODE" != "release" && "$BUILD_MODE" != "local" ]]; then
  echo "Invalid build mode: $BUILD_MODE"
  echo "Use one of: release, local"
  exit 1
fi
TARGET_RELEASE_DIR="$ROOT_DIR/src-tauri/target/$TARGET_TRIPLE/release"
APP_BUNDLE_DIR="$TARGET_RELEASE_DIR/bundle/macos"
APP_PATH="$APP_BUNDLE_DIR/$APP_NAME.app"
DMG_OUT_DIR="$TARGET_RELEASE_DIR/bundle/dmg"
DMG_OUT_PATH="$DMG_OUT_DIR/$APP_NAME.dmg"
BG_PATH="$ROOT_DIR/src-tauri/dmg/background.png"
DOWNLOADS_DIR="$ROOT_DIR/downloads"
DOWNLOADS_DMG_PATH="$DOWNLOADS_DIR/$APP_NAME.dmg"
SIGN_IDENTITY="${APPLE_SIGN_IDENTITY:-}"
ENTITLEMENTS_PATH="$ROOT_DIR/src-tauri/Entitlements.plist"
NOTARY_PROFILE="${APPLE_NOTARY_PROFILE:-}"
APPLE_ID="${APPLE_ID:-}"
APPLE_APP_SPECIFIC_PASSWORD="${APPLE_APP_SPECIFIC_PASSWORD:-}"
APPLE_TEAM_ID="${APPLE_TEAM_ID:-}"

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

if [[ "$TARGET_TRIPLE" == "universal-apple-darwin" ]]; then
  rustup target add aarch64-apple-darwin x86_64-apple-darwin >/dev/null
fi

if [[ "$BUILD_MODE" == "release" ]]; then
  if [[ -z "$SIGN_IDENTITY" ]]; then
    echo "Missing APPLE_SIGN_IDENTITY for release build."
    echo "Example:"
    echo '  export APPLE_SIGN_IDENTITY="Developer ID Application: Your Name (TEAMID)"'
    exit 1
  fi
fi

echo "1/6 Building macOS app bundle ($TARGET_TRIPLE)..."
npm run tauri build -- --target "$TARGET_TRIPLE" --bundles app

if [[ ! -d "$APP_PATH" ]]; then
  echo "App bundle not found: $APP_PATH"
  exit 1
fi

echo "2/6 Signing app bundle..."
if [[ "$BUILD_MODE" == "release" ]]; then
  codesign --force --deep --timestamp --options runtime --entitlements "$ENTITLEMENTS_PATH" --sign "$SIGN_IDENTITY" "$APP_PATH"
else
  echo "Local mode: ad-hoc signing (not suitable for public distribution)."
  codesign --force --deep --sign - "$APP_PATH"
fi
codesign --verify --deep --strict --verbose=2 "$APP_PATH"

echo "3/6 Generating DMG background..."
swift "$ROOT_DIR/scripts/generate-dmg-background.swift"

echo "4/6 Building custom DMG..."
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

echo "5/6 Signing DMG..."
if [[ "$BUILD_MODE" == "release" ]]; then
  codesign --force --timestamp --sign "$SIGN_IDENTITY" "$DMG_OUT_PATH"
else
  codesign --force --sign - "$DMG_OUT_PATH" >/dev/null 2>&1 || true
fi

if [[ "$BUILD_MODE" == "release" ]]; then
  if [[ -n "$NOTARY_PROFILE" ]]; then
    xcrun notarytool submit "$DMG_OUT_PATH" --keychain-profile "$NOTARY_PROFILE" --wait
  elif [[ -n "$APPLE_ID" && -n "$APPLE_APP_SPECIFIC_PASSWORD" && -n "$APPLE_TEAM_ID" ]]; then
    xcrun notarytool submit "$DMG_OUT_PATH" --apple-id "$APPLE_ID" --password "$APPLE_APP_SPECIFIC_PASSWORD" --team-id "$APPLE_TEAM_ID" --wait
  else
    echo "Missing notarization credentials."
    echo "Set APPLE_NOTARY_PROFILE or APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD + APPLE_TEAM_ID."
    exit 1
  fi
  xcrun stapler staple "$APP_PATH"
  xcrun stapler staple "$DMG_OUT_PATH"
  spctl --assess --type execute -vv "$APP_PATH"
  spctl --assess --type open --context context:primary-signature -vv "$DMG_OUT_PATH"
fi

echo "6/6 Finalizing output..."
if [[ "$BUILD_MODE" == "release" ]]; then
  mkdir -p "$DOWNLOADS_DIR"
  cp "$DMG_OUT_PATH" "$DOWNLOADS_DMG_PATH"
  echo "Ready for GitHub: $DOWNLOADS_DMG_PATH"
else
  echo "Local build kept at: $DMG_OUT_PATH"
  echo "Skipping copy to downloads/ in local mode to avoid publishing unsigned DMG."
fi

echo "Done: $DMG_OUT_PATH"
