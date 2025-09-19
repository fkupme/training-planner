# Android Release via GitHub CLI

This guide uploads the built APK to a GitHub Release tagged with the current package.json version.

## Prereqs
- GitHub CLI installed and authenticated: `gh auth login`
- Android toolchain works locally (you can `npm run android:build`)

## Build and publish

- Build + publish:
  - `npm run release:android`

- Publish an already-built APK (skip build):
  - `npm run release:android:skip-build`

The script will:
1. Read `version` from package.json and create tag `v<version>`
2. Build the APK (unless skipped)
3. Find the APK path and upload it to the GitHub Release (create if missing)

If APK auto-discovery fails, set an explicit path:

```bash
APK=/absolute/path/to/app-release.apk npm run release:android:skip-build
```
