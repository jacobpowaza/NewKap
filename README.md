<p align="center">
  <img src="renderer/public/static/kap-icon.png" width="96" height="96" alt="Kap icon">
</p>

<h1 align="center">Kap</h1>

Kap is a lightweight macOS screen recorder and screenshot tool that lives in the menu bar. This repository is a community-maintained Kap fork that keeps the original workflow alive on modern macOS and Electron while adding the v5.1 editor, screenshot, packaging, and branding fixes.

[![Latest release](https://img.shields.io/github/v/release/jacobpowaza/NewKap?label=release)](https://github.com/jacobpowaza/NewKap/releases/latest)
[![CI](https://github.com/jacobpowaza/NewKap/actions/workflows/ci.yml/badge.svg)](https://github.com/jacobpowaza/NewKap/actions/workflows/ci.yml)
[![macOS](https://img.shields.io/badge/macOS-12%2B-blue)](#compatibility)
[![Intel x64](https://img.shields.io/badge/Intel-x64-informational)](#download)
[![Apple Silicon arm64](https://img.shields.io/badge/Apple%20Silicon-arm64-informational)](#download)
[![License](https://img.shields.io/github/license/jacobpowaza/NewKap)](LICENSE.md)

## Download

Download Kap v5.1 from [GitHub Releases](https://github.com/jacobpowaza/NewKap/releases/latest).

| Mac | File |
| --- | --- |
| Apple Silicon Mac, including M1, M2, M3, M4, and newer | `Kap-5.1.0-mac-arm64.dmg` |
| Intel Mac | `Kap-5.1.0-mac-x64.dmg` |

To check which Mac you have, open **Apple menu -> About This Mac**. Macs that show **Chip** are Apple Silicon. Macs that show an Intel **Processor** use the x64 build.

Install:

1. Download the correct DMG.
2. Open the DMG.
3. Drag `Kap.app` into Applications.
4. Open Kap from Applications.
5. Grant Screen Recording permission when macOS asks.
6. Grant Microphone permission only if you want audio capture.

If macOS blocks an unsigned or unnotarized build, open **System Settings -> Privacy & Security** and review the message for `Kap.app`. Each GitHub Release states the exact signing and notarization status for its artifacts.

## Updating

Kap checks the latest public GitHub Release and can open the correct architecture-specific DMG for your Mac. Use **Check for Updates...** from the application menu or Preferences. The updater does not silently install updates; replace the app in Applications with the downloaded `Kap.app`.

Users currently on Kap v5.0 can detect Kap v5.1 after the `v5.1.0` release is published with `Kap-5.1.0-mac-x64.dmg` and `Kap-5.1.0-mac-arm64.dmg` assets.

## Kap v5.1

Kap v5.1 builds on the repaired v5 runtime and focuses on making capture, editing, exporting, and packaging reliable enough for daily use.

Main features and improvements:

- Menu-bar screen recording workflow with crop area selection, window/app selection, multi-display cropper windows, countdown, cursor options, click highlighting, and recording shortcuts.
- Screenshot mode from the capture overlay, including native macOS selection behavior and Command+C direct-to-clipboard capture.
- Timeline editor with click-to-seek playback, play/pause, five-second skip controls, Space-bar playback, splitting, trimming, deleting, copying, pasting, cutting, and duplicating.
- Freeze Frame support that inserts an adjustable still-image clip at the selected frame.
- Clip controls for speed, brightness, contrast, and saturation with edited video/GIF export.
- MP4, HEVC, AV1, GIF, APNG, and WebM export options.
- Persistent preferences for recording, audio, quality, frame rate, export format, save location, notifications, launch at login, countdown, cursor behavior, and keybinds.
- Cropper fixes for stale drag/resize state, invisible overlay readiness, snapping behavior, repeated open/close cycles, and crop persistence.
- Kap branding fixes so packaged builds use the Kap name, bundle metadata, helper names, Dock icon, and application icon instead of generic Electron branding where macOS allows.

## Previews

<table>
  <tr>
    <td width="50%">
      <img src="docs/previews/editor-preview.gif" alt="Kap v5.1 editor timeline preview">
    </td>
    <td width="50%">
      <img src="docs/previews/screenshot-edit-preview.gif" alt="Kap screenshot editing preview">
    </td>
  </tr>
  <tr>
    <td colspan="2">
      <img src="docs/previews/upgraded-settings.gif" alt="Kap upgraded settings preview">
      <br>
      <em>Yes, this GIF was recorded on Kap v5.1.</em>
    </td>
  </tr>
</table>

## Usage Overview

Open Kap from the menu bar, choose a crop or target window, then use the Record/Camera control to capture video or a screenshot. Finished recordings open in the editor, where you can trim, split, add freeze frames, adjust clips, preview playback, and export. Screenshots can be saved, copied, or edited from the screenshot preview workflow.

For audio recording, grant Microphone permission and choose an input in Preferences. For system audio, install a loopback device and select it as the audio input.

## Compatibility

Kap v5.1 is packaged for macOS 12 Monterey or later. Electron 43 is the runtime in this release; Electron v38 and newer require macOS 12 or later because Chromium removed older macOS support.

Supported downloads:

- Apple Silicon: `arm64`
- Intel Mac: `x64`

Known limitations:

- Kap is normally a menu-bar accessory app and intentionally stays out of the Dock while idle.
- macOS may omit accessory apps from the standard Force Quit Applications window. Use Activity Monitor or Kap's tray menu.
- System audio capture requires a loopback audio device.
- Signing and notarization depend on Apple Developer credentials available for the release build.

## Development

Requirements:

- macOS 12 or later for runtime parity with Electron 43.
- Node from `.nvmrc` or any Node version in the supported range `>=20 <23`.
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

When Apple signing and notarization credentials are configured, omit `CSC_IDENTITY_AUTO_DISCOVERY=false` and verify signing and notarization before publishing artifacts.

## Project Shape

- `main/` contains the Electron main process, recording, screenshot, conversion, updater, plugins, menus, and window managers.
- `renderer/` contains the Next.js/React windows for the cropper, preferences, editor, exports, dialogs, and screenshot preview.
- `static/` and `build/` contain packaged app assets.
- `test/` contains AVA tests and media fixtures.
- `docs/previews/` contains the README preview GIFs.

Static packaged builds load `renderer/out/*` through the `electron-next` file-protocol mapping. Keep that mapping intact when changing startup or cropper loading.

## Contributing

Use focused branches and keep unrelated changes out of release or bug-fix work.

```bash
git checkout -b fix/short-description
yarn typecheck
yarn lint
yarn test:main
yarn build-renderer
```

When changing cropper, tray, recording, screenshot, editor, conversion, or updater behavior, include the exact manual path you tested. For cropper changes, verify repeated open, close, reopen, Escape, mouseup outside the overlay, and multi-display behavior when hardware is available.

Bug reports should include:

- macOS version from `sw_vers`.
- Mac architecture from About This Mac.
- Kap version.
- Whether the build is signed/notarized.
- Steps to reproduce.
- Relevant terminal output when running from `yarn start`.

## Troubleshooting

### Screen recording does not start

Open **System Settings -> Privacy & Security -> Screen Recording** and grant access to Kap. Relaunch Kap after changing the permission.

### Microphone or audio input is missing

Open **System Settings -> Privacy & Security -> Microphone** and grant access to Kap. For system audio, install a loopback audio device and select it in Preferences.

### I downloaded the wrong DMG

Open **Apple menu -> About This Mac**. If it says **Chip**, use `arm64`. If it says **Processor** and names Intel, use `x64`.

### macOS warns about Gatekeeper

Check the GitHub Release notes for signing and notarization status. Unsigned or unnotarized builds may require manual approval in **System Settings -> Privacy & Security**.

### Cropper opens but the overlay is invisible or blocks clicks

Run from the terminal with `yarn start` and look for cropper logs. A healthy open shows renderer load followed by cropper readiness. Rebuild the renderer with `yarn build-renderer` if static assets are stale.

### Development still shows an Electron icon

`scripts/run-electron.js` brands the local Electron development host with Kap metadata. If macOS caches an old icon, quit Kap, rebuild, and relaunch.

## License

Kap is released under the [MIT License](LICENSE.md).

## Credits

Kap v5.1 builds on the original [Kap](https://github.com/wulkano/Kap) project and the work of Wulkano contributors, Kap maintainers, plugin authors, and the [NewKap](https://github.com/MuntasirMalek/NewKap) community. This fork focuses on keeping Kap usable on modern macOS while preserving the lightweight workflow that made Kap useful.
