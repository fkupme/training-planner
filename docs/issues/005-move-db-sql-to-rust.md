## Summary

Migrate database access and SQL logic from JS to Rust (Tauri commands), keeping a clean API for the front-end.

## Motivation

Improve stability, performance, and background execution capabilities by consolidating data access on the Rust side.

## Scope

- Define a Rust data layer wrapping SQLite with migrations
- Expose typed Tauri commands for CRUD operations
- Move progression/shifting-sensitive queries to Rust
- Add integration tests (Rust-side) for critical paths
- Update JS stores/services to call Tauri commands instead of direct plugin calls

## Non-goals

- Cloud sync or remote DB

## Proposed approach

- Create a Rust module `db` with connection pool and migration runner
- Define commands: programs, workouts, exercises, sets, reminders, intake, results
- Use serde DTOs for safe type exchange
- Gradually migrate services starting from sessions and planner APIs

## Acceptance criteria

- [ ] All reads/writes go through Rust commands
- [ ] Migration scripts run automatically on app start
- [ ] Unit/integration tests cover core flows
- [ ] No regressions in UI stores

## Risks / Notes

- Keep command boundaries small and composable to avoid blocking UI
- Consider batching writes to reduce overhead

## References

- Tauri command docs
- Existing schema: `src/db/schema.ts`
