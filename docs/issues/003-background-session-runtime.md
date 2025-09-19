## Summary

Run training sessions reliably in the background (screen off / app minimized).

## Motivation

Users expect timers, rest notifications, and session tracking to continue without the app in foreground.

## Scope

- Keep timers and state updates active while app is backgrounded
- Deliver local notifications for rest intervals
- Ensure data consistency on app resume (no time drift)
- Android: consider Foreground Service; iOS: background modes constraints

## Non-goals

- Full-blown media service or health-kit integrations

## Proposed approach

- Move timing to Rust side for reliability; use a background task/worker
- Expose start/stop/pause session timing commands via Tauri commands
- Persist checkpoints (start time, remaining, last tick) in SQLite
- Use plugin-notification for local alerts
- Android: optionally add a foreground service with persistent notification (if needed)

## Acceptance criteria

- [ ] Rest timer continues with screen off; notifications fire on time
- [ ] Session state consistent after resume (no skipped/duplicated ticks)
- [ ] Battery usage acceptable during a typical session

## Risks / Notes

- iOS limitations on background execution; may need BGTask or rethink UX (scheduled notifications instead of continuous timer)
- Align with `sessions` store so UI remains source-of-truth for display only

## References

- Tauri background notes (mobile)
- iOS Background Tasks, Android Foreground Service docs
