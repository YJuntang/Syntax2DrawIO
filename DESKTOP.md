# Desktop Packaging

Syntax2DrawIO now supports a Tauri-based desktop shell in addition to the existing web build.

## Local Development

- Install dependencies:
  - `npm ci`
- Start the desktop app in development mode:
  - `npm run desktop:dev`
- Inspect the local desktop environment:
  - `npm run desktop:info`

## Local Builds

- Build the desktop app for the current machine:
  - `npm run desktop:build`
- Build a macOS universal DMG:
  - `npm run desktop:build:mac-universal`
- Build a Windows x64 MSI:
  - `npm run desktop:build:win-x64`

## Release Automation

The GitHub Actions workflow at `.github/workflows/release-desktop.yml` creates draft GitHub Releases with:

- macOS universal DMG bundles
- Windows x64 MSI bundles
- SHA-256 checksum files

The workflow triggers on:

- pushed tags matching `desktop-v*`
- manual `workflow_dispatch`

## Unsigned First Release

Desktop v1 is intentionally unsigned.

Expected user-facing behavior:

- macOS Gatekeeper may warn that the app is from an unidentified developer.
- Windows SmartScreen may warn before launch.

That is expected until signing credentials are added.

## Signing-Ready Secrets

The workflow is structured so these can be layered in later for macOS notarization:

- `APPLE_CERTIFICATE`
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_SIGNING_IDENTITY`
- `APPLE_ID`
- `APPLE_PASSWORD`
- `APPLE_TEAM_ID`

Windows signing is not wired in yet, but the release workflow leaves room for a certificate import and signing step before artifact upload.

## Desktop Behavior Notes

- Mermaid conversion works fully offline.
- PlantUML preview and visual fallback layers use the configured HTTPS PlantUML renderer, so internet is required unless that renderer is local and reachable.
- Desktop open/save flows use native dialogs.
- External links are opened through the OS default browser instead of inside the app window.
