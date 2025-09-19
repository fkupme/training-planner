## Summary

Implement push-like notifications for reminders and session events on the client.

## Motivation

Increase adherence and UX with timely alerts for workouts, rest timers, and supplement schedules.

## Scope

- Use local notifications (`@tauri-apps/plugin-notification`) for reminders and rest intervals
- Schedule notifications based on planner and reminders store
- Handle actions (snooze/complete) and update state accordingly
- Permission flow and UX copy for enabling notifications

## Non-goals

- Remote push notifications from server (no backend)

## Proposed approach

- Centralize notification scheduling in a service (Rust side preferred for background reliability)
- Expose schedule/cancel APIs to JS via Tauri commands
- Integrate with existing reminders store and session timers

## Acceptance criteria

- [ ] Permission prompt shown once and status reflected in Settings
- [ ] Reminders create scheduled local notifications
- [ ] Rest timer sends alerts reliably with app backgrounded
- [ ] User actions on notifications update app state

## Risks / Notes

- Platform differences in actions/buttons handling

## References

- Tauri Notification plugin docs
