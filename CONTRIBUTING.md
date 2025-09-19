# Contributing to Training Planner

Thanks for considering a contribution! This guide helps you get productive quickly.

## Getting started

- Node 20+, Rust toolchain, and Tauri CLI
- Clone and install:
  - `npm i`
- Dev servers:
  - Web: `npm run dev`
  - Desktop (Tauri): `npm run tauri dev`
  - Android: `npm run android:init` then `npm run android:dev`

## Project conventions

- Vue 3 + TypeScript, script-setup SFCs
- Pinia stores and composables are preferred over ad-hoc logic
- Sparse rotation logic must use central sessions store getters (see docs)
- Keep edits surgical; avoid wide formatting changes

## Testing

- Unit: Vitest — `npm run test:stats` for quick pass; add focused tests for cycle shifting
- E2E (optional locally): Playwright in `tests/e2e`

## Branch & PR flow

1. Fork and create a feature branch
2. Add/adjust tests where behavior changes
3. Run `npm run build` (typecheck+build) and unit tests locally
4. Open a PR with:
   - What/Why summary
   - Screenshots for UI changes
   - Notes on migration if needed

## Commit style

- Conventional-ish, concise:
  - `feat(i18n): add ru + en locales`
  - `fix(sessions): normalize shift on day change`

## Areas of interest

- i18n (multi-language)
- iOS build support
- Background sessions & notifications
- Move DB/SQL to Rust side

## Code of Conduct

Be respectful and constructive. We’ll add a formal CODE_OF_CONDUCT if the community grows.