## Summary

Implement multi-language (i18n) support across the app.

## Motivation

Make the app accessible to a broader audience and allow switching languages on the fly. Persist language in settings and default to system locale.

## Scope

- Introduce Vue I18n (v9) integration for Vue 3 + TS
- Create base locales: `en` and `ru`
- Extract user-facing strings from pages/components into locale files
- Add a language switcher in Settings and a quick toggle in header (optional)
- Persist selection in settings store; load on startup
- Fallback handling when keys are missing

## Non-goals

- Full translation coverage for all content initially; can be iterative
- Server-side localization (no backend)

## Proposed approach

- Add dependency: `vue-i18n`
- Create `src/locales/en.json`, `src/locales/ru.json`
- Setup i18n plugin in `main.ts`; detect system locale via Tauri or browser and choose default
- Add composable `useI18nSettings` to get/set language via settings store
- Gradually replace strings in key views: `Planner.vue`, `Session.vue`, `Settings.vue`, `Supplements.vue`, `Timer.vue`

## Acceptance criteria

- [ ] App initializes with system locale; falls back to `en`
- [ ] Language switch in Settings updates UI immediately
- [ ] Selection persists and is restored on restart
- [ ] No console errors for missing keys on the main flows

## Risks / Notes

- Ensure test stability: snapshot tests may need i18n wrappers
- Keep keys semantic and grouped; avoid inline HTML in messages where possible

## References

- Vue I18n docs: https://vue-i18n.intlify.dev/
- Internal docs (rotation model): `docs/cycle-shifting-architecture.md`
