#!/usr/bin/env bash
set -euo pipefail

# Build and upload Android APK to a GitHub Release using gh CLI.
# Requires: gh auth login; Android toolchain; repo: fkupme/training-planner

REPO="fkupme/training-planner"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PKG_JSON="$PROJECT_ROOT/package.json"

VERSION=$(node -pe "require('$PKG_JSON').version")
TAG="v$VERSION"

BUILD=${BUILD:-1}
ARTIFACTS=${ARTIFACTS:-apk} # apk | aab | both

echo "Preparing release $TAG for $REPO"

if [[ "$BUILD" == "1" ]]; then
  echo "Building Android APK..."
  (cd "$PROJECT_ROOT" && npm run android:build)
fi

APK=${APK:-}
AAB=${AAB:-}

# Prefer known Gradle output paths when not overridden
APK=${APK:-$(ls "$PROJECT_ROOT"/src-tauri/gen/android/app/build/outputs/apk/universal/release/*.apk 2>/dev/null | head -n1 || true)}
AAB=${AAB:-$(ls "$PROJECT_ROOT"/src-tauri/gen/android/app/build/outputs/bundle/universalRelease/*.aab 2>/dev/null | head -n1 || true)}

echo "Artifacts mode: $ARTIFACTS"
if [[ "$ARTIFACTS" == "apk" || "$ARTIFACTS" == "both" ]]; then
  if [[ -z "${APK:-}" ]]; then
    echo "APK not found automatically. Provide APK env var."
    exit 1
  fi
  echo "APK found: $APK"
fi
if [[ "$ARTIFACTS" == "aab" || "$ARTIFACTS" == "both" ]]; then
  if [[ -z "${AAB:-}" ]]; then
    echo "AAB not found automatically. Provide AAB env var."
    exit 1
  fi
  echo "AAB found: $AAB"
fi

# Create release if not exists; else upload asset
ensure_release() {
  if gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
    return 0
  fi
  gh release create "$TAG" \
    --repo "$REPO" \
    --title "Android $TAG" \
    --notes "Android release $TAG"
}

ensure_release

upload_asset() {
  local file="$1"
  [[ -f "$file" ]] || { echo "Missing asset: $file"; exit 1; }
  gh release upload "$TAG" "$file" --repo "$REPO" --clobber
}

if [[ "$ARTIFACTS" == "apk" || "$ARTIFACTS" == "both" ]]; then
  upload_asset "$APK"
fi
if [[ "$ARTIFACTS" == "aab" || "$ARTIFACTS" == "both" ]]; then
  upload_asset "$AAB"
fi

echo "Done."
