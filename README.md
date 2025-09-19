<div align="center">

# Training Planner

Plan, track, and progress your workouts — offline-first, mobile (Android via Tauri Mobile) and desktop ready.

[![GitHub stars](https://img.shields.io/github/stars/fkupme/training-planner?style=social)](https://github.com/fkupme/training-planner/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/fkupme/training-planner)](https://github.com/fkupme/training-planner/issues)
[![CI](https://github.com/fkupme/training-planner/actions/workflows/ci.yml/badge.svg)](https://github.com/fkupme/training-planner/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](#-license)
[![Version](https://img.shields.io/badge/version-v0.1.5-blue)](./package.json)
[![Vue 3](https://img.shields.io/badge/Vue-3-42b883?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tauri 2](https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white)](https://tauri.app)
[![Pinia](https://img.shields.io/badge/Pinia-3-f7d336)](https://pinia.vuejs.org/)
[![Vant UI](https://img.shields.io/badge/Vant-UI-07c160)](https://vant-ui.github.io/)

</div>

## Highlights

- Weekly and custom training cycles with sparse rotation (shift active training days only — rest days stay rest)
- Offline-first data via SQLite (`@tauri-apps/plugin-sql`)
- Local notifications for reminders (`@tauri-apps/plugin-notification`)
- Clean Vue 3 + TypeScript + Pinia architecture
- Tauri Mobile (Android) support and Desktop-ready foundation

## Screenshots

Add your screenshots or short GIFs here to show the flow. For now, placeholders:

![App preview](public/vite.svg)

## Tech stack

- Vue 3 (TypeScript), Vite, Vue Router, Pinia, Vant UI
- Tauri 2 (Mobile + Desktop), Rust side with plugins
- SQLite (local, via Tauri SQL plugin)
- Day.js / date-fns

## Quick start

Prerequisites:

- Node.js 20+ and a package manager (npm/pnpm/bun)
- Rust toolchain and Tauri CLI (`npm i -D @tauri-apps/cli` is already in devDependencies)
- For Android builds: Android Studio + SDK + NDK, Java 17 (see `scripts/android-setup-mac.sh`)

Install deps:

```bash
npm i
```

Run web dev server:

```bash
npm run dev
```

Run desktop (Tauri) dev:

```bash
npm run tauri dev
```

Android (Tauri Mobile):

```bash
# one-time
npm run android:init

# run on device/emulator
npm run android:dev

# if your env vars are local-only
npm run android:dev-local

# build APK/AAB
npm run android:build
```

Other useful scripts:

- `npm run preview` — local preview of built web assets
- `npm run android:studio` — open the Android project in Android Studio
- `npm run android:uninstall` — uninstall the app from a device/emulator

## Planner model: sparse rotation (weekly cycles)

To keep rest days intact while rotating training days across the week:

- Treat `planner.currentProgram.config.dayOffset` as a shift over active days
- Active days are indices where `weekly.days[i] > 0`
- For a calendar day `d`, find `k = activeDays.indexOf(d)`; if `k >= 0` then `programDay = activeDays[(k + trainingShift) % activeDays.length]`
- Always read the shifted program from the sessions store getters:
  - `useSessionsApiStore().getAllShiftedExercises()`
  - `getShiftedExercises(dayIndex)`
  - `nextWorkout`, `nextWorkoutExercises`, `nextWorkoutSummary`, `nextWorkoutDate`

More details:

- Docs: `docs/cycle-shifting-architecture.md` and `docs/supplements-architecture.md`

## Development

- Typecheck + build: `npm run build`
- Codebase uses script-setup SFCs and centralized Pinia stores
- Sessions store constructs `shiftedProgram` and normalizes shifts; bump `shiftedProgramVersion` to refresh
- After changes affecting shifts, call `sessions.invalidateAndReload`

### Testing

- Unit: Vitest (see `src/__tests__`), e.g. `npx vitest run`
- E2E: Playwright (see `tests/e2e`)

## Roadmap

- Training diary and results analytics
- Interval timer and rest alerts (sound/vibration)
- Data export/import and backups
- Optional sync in the future

## Contributing

Contributions are welcome. A simple flow:

1. Fork and create a feature branch
2. Add/adjust unit tests for changes in shifting logic when relevant
3. Keep edits surgical; prefer stores/composables over ad-hoc logic
4. Run `npm run build` and at least the unit tests
5. Open a PR with a clear description and screenshots if UI changes

## Localization

- RU: проект задуман как офлайн‑планировщик тренировок с «разрежённой» ротацией тренировочных дней, напоминаниями и журналом результатов.

## Star history

[![Star History Chart](https://api.star-history.com/svg?repos=fkupme/training-planner&type=Date)](https://star-history.com/#fkupme/training-planner&Date)

## 📝 License

This project is licensed under the MIT License — see the [LICENSE](./LICENSE) file for details.
