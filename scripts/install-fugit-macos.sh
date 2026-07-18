#!/bin/bash

# Installs the latest public Fugit release. User data in
# ~/Library/Application Support is not touched when Fugit.app is replaced.

set -euo pipefail

readonly APP_NAME="Fugit.app"
readonly ZIP_URL="https://github.com/jann5/fugit/releases/latest/download/Fugit.zip"
readonly INSTALL_DIR="${FUGIT_INSTALL_DIR:-$HOME/Applications}"
readonly TARGET_APP="$INSTALL_DIR/$APP_NAME"

for command in curl ditto xattr codesign open; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "Brakuje polecenia: $command" >&2
    exit 1
  }
done

work_dir="$(mktemp -d "${TMPDIR:-/tmp}/fugit-install.XXXXXX")"
trap 'rm -rf "$work_dir"' EXIT

archive="$work_dir/Fugit.zip"
unpacked="$work_dir/unpacked"

echo "Pobieram najnowszy release Fugit..."
curl --fail --location --retry 2 --output "$archive" "$ZIP_URL"

mkdir -p "$unpacked"
ditto -x -k "$archive" "$unpacked"

source_app="$unpacked/$APP_NAME"
if [[ ! -d "$source_app" ]]; then
  echo "Archiwum nie zawiera $APP_NAME." >&2
  exit 1
fi

if ! codesign --verify --deep --strict "$source_app"; then
  echo "Podpis pobranej aplikacji jest nieprawidłowy — instalacja przerwana." >&2
  exit 1
fi

mkdir -p "$INSTALL_DIR"
if [[ -e "$TARGET_APP" ]]; then
  echo "Zastępuję istniejącą kopię w $TARGET_APP"
  rm -rf "$TARGET_APP"
fi

ditto "$source_app" "$TARGET_APP"
xattr -dr com.apple.quarantine "$TARGET_APP"

echo "Gotowe: $TARGET_APP"
echo "Aplikacja pochodzi z najnowszego GitHub Release."
open "$TARGET_APP"
