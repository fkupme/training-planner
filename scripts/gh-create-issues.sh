#!/usr/bin/env bash
set -euo pipefail

# Create GitHub issues from docs/issues/*.md using gh CLI.
# Requirements: gh CLI authenticated (gh auth login) and repo set to fkupme/training-planner.

REPO="fkupme/training-planner"
ISSUES_DIR="docs/issues"
LABELS="enhancement,roadmap"

get_title() {
  local file="$1"
  case "$file" in
    001-i18n-multilanguage.md)
      echo "Implement i18n (multi-language)";;
    002-ios-build-support.md)
      echo "Add iOS build support (Tauri Mobile)";;
    003-background-session-runtime.md)
      echo "Background session runtime (timers/notifications)";;
    004-push-notifications-front.md)
      echo "Local notifications for reminders/sessions";;
    005-move-db-sql-to-rust.md)
      echo "Migrate DB/SQL logic to Rust side";;
    *)
      echo "Feature: $file";;
  esac
}

for f in $(ls "$ISSUES_DIR"/*.md | sort); do
  file=$(basename "$f")
  title=$(get_title "$file")
  echo "Creating issue: $title"
  gh issue create \
    --repo "$REPO" \
    --title "$title" \
    --body-file "$f" \
    --label "$LABELS"
done

echo "All issues created."
