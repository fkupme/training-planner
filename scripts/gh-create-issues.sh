#!/usr/bin/env bash
set -euo pipefail

# Create GitHub issues from docs/issues/*.md using gh CLI.
# Requirements: gh CLI authenticated (gh auth login) and repo set to fkupme/training-planner.

REPO="fkupme/training-planner"
ISSUES_DIR="docs/issues"

declare -A TITLES
TITLES[001-i18n-multilanguage.md]="Implement i18n (multi-language)"
TITLES[002-ios-build-support.md]="Add iOS build support (Tauri Mobile)"
TITLES[003-background-session-runtime.md]="Background session runtime (timers/notifications)"
TITLES[004-push-notifications-front.md]="Local notifications for reminders/sessions"
TITLES[005-move-db-sql-to-rust.md]="Migrate DB/SQL logic to Rust side"

LABELS="enhancement,roadmap"

for f in $(ls "$ISSUES_DIR"/*.md | sort); do
  file=$(basename "$f")
  title=${TITLES[$file]:-"Feature: ${file}"}
  echo "Creating issue: $title"
  gh issue create \
    --repo "$REPO" \
    --title "$title" \
    --body-file "$f" \
    --label "$LABELS"
done

echo "All issues created."
