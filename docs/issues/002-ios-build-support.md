## Summary

Add iOS build and development support using Tauri Mobile (iOS).

## Motivation

Ship the app to iOS devices and prepare for TestFlight/App Store in the future.

## Scope

- Add Tauri iOS initialization and configs
- Document prerequisites: Xcode, CocoaPods, iOS toolchain
- Provide npm scripts to build and run on simulator/device
- Validate required plugins support on iOS: `notification`, `sql`, `store`, `opener`
- Add minimal entitlements/capabilities

## Non-goals

- App Store submission automation

## Proposed approach

- Use `tauri ios init` to scaffold iOS project
- Add scripts: `ios:init`, `ios:dev`, `ios:build`, `ios:studio` (Xcode)
- Configure bundle identifiers and signing in Xcode project
- Test plugin behavior; if SQLite plugin requires additional setup (e.g., file locations), document it

## Acceptance criteria

- [ ] `npm run ios:init` completes successfully on macOS
- [ ] `npm run ios:dev` runs on an iOS simulator and displays main screens
- [ ] `npm run ios:build` produces an IPA or Xcode archive

## Risks / Notes

- Code signing complexities; use manual signing for local dev
- SQLite and background execution policies differ on iOS; test thoroughly

## References

- Tauri Mobile iOS docs: https://tauri.app/start/mobiles/ios/
