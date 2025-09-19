# AI agent instructions (training-planner)

Short, project-specific rules to make agents productive and safe here.

- Stack
  - Vue 3 + TS + Vite; Pinia stores; Vant UI; Tauri 2 (mobile); SQLite via `@tauri-apps/plugin-sql`.
- Domain
  - Planner supports weekly/custom cycles. Weekly uses sparse rotation: rotate workouts among active training days only; rest days remain rest.
  - Config JSON is in `planner.currentProgram.config` with `cycleType`, `weekly.days` or `custom.days`, and `dayOffset`.
- Sparse rotation contract
  - Treat `dayOffset` as trainingShift over active days in weekly cycles.
  - activeDays = indices where `weekly.days[i] > 0`.
  - For calendar day d: find k = activeDays.indexOf(d); if k >= 0 then programDay = activeDays[(k + trainingShift) % activeDays.length].
  - All UI metadata and lookups for weekly must use programDay, not calendar day.
- Use centralized getters
  - Read shifted program from sessions store: `useSessionsApiStore().getAllShiftedExercises` and `getShiftedExercises(dayIndex)`.
  - Next workout: `nextWorkout`, `nextWorkoutExercises`, `nextWorkoutSummary`, `nextWorkoutDate`.
  - Do not recompute rotation in components; rely on sessions store.
- Components
  - PlannerTabAll: chips/meta must come from programDay mapping (see `metaFor`/`musclesFor` in `src/pages/Planner.vue`).
  - WorkoutEditPopup: persists metadata to the effective programDay so it follows shifts; clears state on close.
  - WorkoutCard: emits edit/delete/add with `cycleType`, `dayIndex`, `slot`.
- Stores
  - sessions.api.ts builds `shiftedProgram` with sparse rotation and normalizes shifts; bump `shiftedProgramVersion` to refresh.
  - planner store updates `dayOffset`; call sessions.invalidateAndReload after mutations affecting shifts.
  - workouts store/APIs read/write by (program_id, cycle_type, day_index, slot).
- Testing
  - Vitest for unit; Playwright for e2e. Prefer adding focused tests when changing shift logic.
- Conventions
  - Use script setup SFCs; import from 'vue' primitives explicitly.
  - Keep edits surgical; avoid reformatting unrelated code.
  - Never invent file paths. Prefer project composables and stores over ad-hoc logic.
- Safety
  - No secrets in code. No network calls unless required. Follow Microsoft content policies.

Quick recipes
- Map calendar day to program day (weekly): see Sparse rotation contract above; or call sessions getters instead.
- Load all exercises for All tab (weekly): `useSessionsApiStore().getAllShiftedExercises`.
- Add exercise to a day: attach via stores using provided IDs; keep slot positions (<1000 => A, >=1000 => B).
