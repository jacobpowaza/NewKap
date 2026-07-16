<p align="center">
  <img src="renderer/public/static/kap-icon.png" width="96" height="96" alt="Kap icon">
</p>

# Kap

Kap is a lightweight macOS screen recorder that lives in the menu bar. This community-maintained fork modernizes the Electron runtime, repairs the recording overlay, restores reliable packaging, and keeps the original fast capture workflow focused on recording, trimming, and exporting screen videos.

[![Latest release](https://img.shields.io/github/v/release/jacobpowaza/NewKap?label=release)](https://github.com/jacobpowaza/NewKap/releases/latest)
[![CI](https://github.com/jacobpowaza/NewKap/actions/workflows/ci.yml/badge.svg)](https://github.com/jacobpowaza/NewKap/actions/workflows/ci.yml)
[![macOS](https://img.shields.io/badge/macOS-12%2B-blue)](#compatibility)
[![Intel x64](https://img.shields.io/badge/Intel-x64-informational)](#download)
[![Apple Silicon arm64](https://img.shields.io/badge/Apple%20Silicon-arm64-informational)](#download)
[![License](https://img.shields.io/github/license/jacobpowaza/NewKap)](LICENSE.md)
[![Downloads](https://img.shields.io/github/downloads/jacobpowaza/NewKap/total)](https://github.com/jacobpowaza/NewKap/releases)
[![Stars](https://img.shields.io/github/stars/jacobpowaza/NewKap?style=social)](https://github.com/jacobpowaza/NewKap/stargazers)

## Download

Download Kap v5 from the [GitHub releases page](https://github.com/jacobpowaza/NewKap/releases/latest).

Choose the DMG for your Mac:

| Mac type | Download |
| --- | --- |
| Apple Silicon Mac, including M1, M2, M3, M4, and newer | `Kap-5.0.0-mac-arm64.dmg` |
| Intel Mac | `Kap-5.0.0-mac-x64.dmg` |

To check which Mac you have, open **Apple menu -> About This Mac** and look for **Chip** or **Processor**.

Install:

1. Download the correct DMG.
2. Open the DMG.
3. Drag `Kap.app` into Applications.
4. Open Kap.
5. Grant Screen Recording permission when macOS asks.
6. Grant Microphone permission only if you want audio capture.

If macOS blocks an unsigned or unnotarized build, open **System Settings -> Privacy & Security** and review the Gatekeeper message for `Kap.app`. Release notes for each build state the exact signing and notarization status.

## What Is Kap?

Kap records your Mac screen from a small menu-bar app. Open the tray icon, choose an area, window, or display-sized crop, then record with the countdown, cursor, audio, and quality settings you prefer. Finished recordings open in the editor for preview, trimming, conversion, copying, and saving.

Kap is designed for short product demos, bug reports, design reviews, documentation clips, and quick shareable recordings.

## Kap v5

Kap v5 is a repair and modernization release. It keeps the original menu-bar workflow, but fixes the pieces that made recent builds slow, invisible, or incorrectly branded.

Highlights:

- Electron 43 runtime compatibility work for main, renderer, IPC, and remote bridge paths.
- Repaired `electron-next` protocol setup so packaged cropper windows can load `/_next/*` renderer assets.
- Transparent cropper windows no longer appear before the renderer has loaded and painted controls.
- Cropper drag, resize, and pick state is reset on every open and close.
- Cursor movement alone cannot move or resize the crop selection.
- Start and stop recording shortcuts are real recording actions, not just overlay open/close actions.
- Development and packaged builds use Kap naming and icons instead of Electron branding where macOS allows.
- Preferences now persist recording, audio, export, notification, launch, countdown, cursor, and shortcut settings.
- Tray quick settings expose common capture controls without opening Preferences.
- Contextual error reporting is preserved at renderer, IPC, permission, conversion, and recording boundaries.

Performance improvements verified during development:

- Startup now skips unnecessary development-server and precompile work when a static renderer build exists.
- The renderer protocol mapping is still initialized for static builds, which avoids the invisible-overlay failure.
- Local verification in this fork reached tray-ready in about 1.5 seconds where the old development path took roughly 30 seconds. Treat this as an approximate development-path measurement, not a universal benchmark.

## Features

- Menu-bar screen recording workflow.
- Crop area selection with resize handles.
- App/window selection support through macOS window metadata.
- Multi-display cropper windows.
- Countdown toggle and adjustable countdown duration.
- Cursor visibility and click-highlight settings.
- Start and stop recording shortcuts.
- 30 FPS and 60 FPS recording options.
- Standard, high, and maximum recording quality options.
- Microphone input selection.
- Support for system-audio loopback devices when installed by the user.
- MP4, HEVC, AV1, GIF, APNG, and WebM export options.
- Save-location and default-export preferences.
- Notification and sound preferences.
- Launch-at-login preference.
- Recent recordings in the tray menu.
- Plugin support inherited from Kap.

## Compatibility

Kap v5 is packaged for macOS 12 Monterey or later. Electron 43 is the runtime in this release; Electron v38 and newer require macOS 12 or later because Chromium removed older macOS support.

Supported downloads:

- Apple Silicon: `arm64`
- Intel Mac: `x64`

Known limitations:

- Kap is a menu-bar accessory app, so it intentionally stays out of the Dock.
- macOS may omit accessory apps from the standard Force Quit Applications window. Use Activity Monitor or the tray menu's **Quit Kap** item.
- macOS does not expose system output audio as a normal microphone. Install a loopback audio device if you need system audio capture.
- Signing and notarization depend on available Apple Developer credentials for the release build.

## Screenshots

The repository currently includes the Kap icon and plugin media, but no current v5 interface screenshot set. Do not rely on old screenshots when validating the repaired cropper; launch the app and verify the live overlay.

## Developer Setup

Requirements:

- macOS 12 or later for runtime parity with Electron 43.
- Node `22.22.2` from `.nvmrc` or any Node version in the supported range `>=20 <23`.
- Yarn `1.22.x`.
- Xcode command-line tools.
- Native build tools required by Aperture and related recording dependencies.

Install and run:

```bash
git clone https://github.com/jacobpowaza/NewKap.git
cd NewKap
nvm use
yarn install --frozen-lockfile --ignore-engines
unset ELECTRON_RUN_AS_NODE
yarn start
```

The install command uses `--ignore-engines` because a legacy lint resolver declares a stale Node range. Do not add browser shims for Node built-ins such as `fs`, `path`, `os`, `events`, `perf_hooks`, or `util`; the renderer runs in Electron.

Quality checks:

```bash
yarn typecheck
yarn lint
yarn test:main
yarn build-renderer
```

Packaging:

```bash
yarn build
CSC_IDENTITY_AUTO_DISCOVERY=false yarn pack
CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --mac dmg --x64
CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --mac dmg --arm64
```

When Apple signing and notarization credentials are configured, omit `CSC_IDENTITY_AUTO_DISCOVERY=false` and use the repository's existing `electron-builder` signing and notarization configuration. Verify signing and notarization before publishing release artifacts.

## Architecture

Kap has a narrow runtime path:

1. `main/index.ts` sets macOS accessory behavior, prepares the renderer protocol, initializes `@electron/remote`, and wires the tray.
2. `main/tray.ts` owns the menu-bar click and recording-state tray behavior.
3. `main/windows/cropper.ts` checks permissions, creates per-display transparent cropper windows, waits for renderer readiness, and keeps stale overlay windows from accumulating.
4. `renderer/pages/cropper.js` renders the cropper page and sends a post-paint readiness signal before main enables mouse input.
5. `renderer/containers/cropper.js` owns crop selection, gesture state, countdown, and recording start parameters.
6. `main/aperture.ts` starts and stops recording, resolves audio devices, applies quality settings, and opens the editor after capture.
7. Conversion and export flow through `main/conversion.ts`, `main/converters/*`, and the editor renderer.

Static packaged builds load `renderer/out/*` through the `electron-next` file-protocol mapping. If that mapping is skipped, transparent cropper windows can open without visible controls and intercept input; v5 keeps that setup explicit.

## Contributing

Use focused branches and keep unrelated changes out of bug-fix PRs.

```bash
git checkout -b fix/short-description
yarn typecheck
yarn lint
yarn test:main
yarn build-renderer
```

When changing cropper, tray, recording, or startup behavior, include the exact manual path you tested. For cropper changes, verify repeated open, close, reopen, Escape, mouseup outside the overlay, and multi-display behavior when hardware is available.

Bug reports should include:

- macOS version from `sw_vers`.
- Mac architecture from About This Mac.
- Kap version.
- Whether the build is signed/notarized.
- Steps to reproduce.
- Relevant terminal output when running from `yarn start`.

## Troubleshooting

### Kap does not show in the Dock

That is expected. Kap is a menu-bar app and uses macOS accessory activation plus `LSUIElement`.

### Screen recording does not start

Open **System Settings -> Privacy & Security -> Screen Recording** and grant access to Kap. Relaunch Kap after changing the permission.

### Microphone or audio input is missing

Open **System Settings -> Privacy & Security -> Microphone** and grant access to Kap. For system audio, install a loopback audio device and select it in Preferences.

### I downloaded the wrong DMG

Open **Apple menu -> About This Mac**. If it says **Chip**, use `arm64`. If it says **Processor** and names Intel, use `x64`.

### macOS warns about Gatekeeper

Check the release notes for signing and notarization status. Unsigned or unnotarized builds may require manual approval in **System Settings -> Privacy & Security**.

### Cropper opens but the overlay is invisible or blocks clicks

Run from the terminal with `yarn start` and look for cropper logs. A healthy open shows renderer load followed by cropper readiness. Rebuild the renderer with `yarn build-renderer` if static assets are stale.

### Development still shows an Electron icon

`scripts/run-electron.js` brands the local Electron development host with Kap metadata and writes a stamp based on the Electron version and icon hash. If macOS caches an old icon, quit Kap, rebuild, and relaunch. Avoid system-wide icon-cache resets unless you are explicitly debugging macOS LaunchServices caching.

### Preferences do not persist

Kap stores settings through `electron-store` in the app support directory. Check that the app can write to `~/Library/Application Support/Kap`.

## Credits

Kap v5 builds on the original [Kap](https://github.com/wulkano/Kap) project and the work of Wulkano contributors, Kap maintainers, plugin authors, and the [NewKap](https://github.com/MuntasirMalek/NewKap) community. The current fork focuses on keeping Kap usable on modern macOS and Electron while preserving the lightweight workflow that made Kap useful.

## License

Kap is released under the [MIT License](LICENSE.md). See the repository history and license files for upstream attribution and contributor history.
