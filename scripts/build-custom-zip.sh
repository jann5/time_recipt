#!/usr/bin/env bash
set -euo pipefail

APP_NAME="Fugit"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET_INPUT="${1:-universal-apple-darwin}"
TARGET_TRIPLE="$TARGET_INPUT"
if [[ "$TARGET_TRIPLE" == "native" ]]; then
  if [[ "$(uname -m)" == "arm64" ]]; then
    TARGET_TRIPLE="aarch64-apple-darwin"
  else
    TARGET_TRIPLE="x86_64-apple-darwin"
  fi
fi

TARGET_RELEASE_DIR="$ROOT_DIR/src-tauri/target/$TARGET_TRIPLE/release"
APP_BUNDLE_DIR="$TARGET_RELEASE_DIR/bundle/macos"
APP_PATH="$APP_BUNDLE_DIR/$APP_NAME.app"
ZIP_OUT_DIR="$TARGET_RELEASE_DIR/bundle/zip"
ZIP_OUT_PATH="$ZIP_OUT_DIR/$APP_NAME.zip"
DOWNLOADS_DIR="$ROOT_DIR/downloads"
DOWNLOADS_ZIP_PATH="$DOWNLOADS_DIR/$APP_NAME.zip"

cd "$ROOT_DIR"

if [[ "$TARGET_TRIPLE" == "universal-apple-darwin" ]]; then
  rustup target add aarch64-apple-darwin x86_64-apple-darwin >/dev/null
fi

echo "1/4 Building macOS app bundle ($TARGET_TRIPLE)..."
npm run tauri build -- --target "$TARGET_TRIPLE" --bundles app

if [[ ! -d "$APP_PATH" ]]; then
  echo "App bundle not found: $APP_PATH"
  exit 1
fi

echo "2/4 Ad-hoc signing app bundle..."
codesign --force --deep --sign - "$APP_PATH"
codesign --verify --deep --strict --verbose=2 "$APP_PATH"

echo "3/4 Clearing quarantine attributes..."
xattr -cr "$APP_PATH" || true

echo "4/4 Packing ZIP..."
mkdir -p "$ZIP_OUT_DIR" "$DOWNLOADS_DIR"
rm -f "$ZIP_OUT_PATH" "$DOWNLOADS_ZIP_PATH"
(
  cd "$APP_BUNDLE_DIR"
  ditto -c -k --sequesterRsrc --keepParent "$APP_NAME.app" "$ZIP_OUT_PATH"
)
xattr -c "$ZIP_OUT_PATH" || true
cp "$ZIP_OUT_PATH" "$DOWNLOADS_ZIP_PATH"

echo "Done: $ZIP_OUT_PATH"
echo "Ready for GitHub: $DOWNLOADS_ZIP_PATH"
