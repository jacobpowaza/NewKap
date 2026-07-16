# Kap

Kap is a focused macOS screen recorder that lives in the menu bar. This repository carries the community-maintained Electron 43 port, the repaired recording overlay, expanded recording preferences, and the startup work needed to keep Kap fast and quiet.

## What Changed

The current release restores Kap as a proper menu-bar utility:

- Kap stays out of the Dock through the macOS accessory activation policy and `LSUIElement` bundle metadata.
- Packaged builds identify themselves as **Kap** in menus, notifications, permission prompts, Activity Monitor, crash reports, and bundle metadata.
- The development launcher brands Electron's local host bundle as Kap before startup, including its icon and helper display names.
- Preferences opens reliably and exposes recording, audio, export, shortcut, login, notification, and sound settings.
- The tray menu provides quick access to countdown, cursor, audio source, recent recordings, and the full Preferences window.
- Cropper windows load on every display, wait for their controls to paint before accepting mouse input, and do not create duplicate overlays while opening.
- Renderer, IPC, permission, and recording failures now retain actionable context instead of disappearing into empty catches.

## The Overlay Freeze

The tray-click freeze was not a slow permission request or a blocked main thread. The optimization in `9fec762` skipped `electron-next` whenever an exported renderer already existed. In a packaged build, however, `electron-next` also installs the `file:` protocol mapping used by HTML references such as `/_next/...`.

The cropper `BrowserWindow`s were created and shown, but every renderer bundle failed with `net::ERR_FILE_NOT_FOUND`. Because those windows are transparent, full-screen, and always on top, they intercepted input while displaying nothing. That looked exactly like an application freeze. The renderer never reached its application entry point.

The repair is deliberately small: `electron-next('./renderer')` now always initializes its protocol mapping, while development-only precompilation remains conditional. Once renderer loading resumed, two Electron 43 compatibility failures became visible and were fixed at their boundaries:

- `@electron/remote` is initialized once in main, enabled per window, and app-relative remote requires are resolved by main.
- Renderer-side IPC responders and the few old `electron-util` remote calls use local compatibility helpers instead of Electron's removed built-in `remote` API.

The deprecated `session.getPreloads` and `session.setPreloads` warnings came from `electron-timber`, whose preload also depended on the removed built-in remote API. Its runtime hook is no longer installed. The warnings were related to that dependency, not to screen capture or the overlay failure.

## Performance

Kap's startup path used to spend roughly 16 seconds preparing Next.js and another 15 seconds precompiling a page even when a static renderer was already available. Static builds now skip the development server and page precompile without skipping the protocol setup they still need.

Local verification reached tray-ready in about **1.5 seconds**, down from roughly **30 seconds** on the old path: approximately a **20x startup improvement**. A tray click loaded and displayed cropper renderers for two monitors in about **1.1 seconds**. In short, Kap now launches absurdly faster and the click actually arrives at a working overlay.

## Recording Settings

Preferences persists these options through `electron-store`:

- Countdown enabled state and duration
- Cursor visibility and mouse-click highlighting
- Start and stop recording shortcuts
- Standard, high, or maximum recording quality
- 30 or 60 frames per second
- Microphone input, including the system default and installed loopback devices
- Default export format and save location
- Launch at login
- Notifications and notification sounds

The recording pipeline consumes the same settings directly. Quality maps to Aperture codecs with an H.264 fallback, frame rate and cursor options are passed into capture, selected audio devices are resolved at recording time, and the editor starts with the configured export format.

macOS does not expose system output audio as an ordinary microphone. To capture it, install a loopback audio device; Kap lists it alongside other inputs rather than pretending an unavailable source exists.

## Development

### Requirements

- macOS
- Node `22.22.2` (see `.nvmrc`; supported range is Node 20 through 22)
- Yarn `1.22.x`
- Xcode command-line tools and the native build tools required by Aperture

Install and start:

```bash
nvm use
yarn install --frozen-lockfile --ignore-engines
unset ELECTRON_RUN_AS_NODE
yarn start
```

The install uses `--ignore-engines` because an old lint resolver declares a stale Node range. This is not permission to install browser shims for Node built-ins: `fs`, `path`, `os`, `events`, `perf_hooks`, and `util` come from Node.

`yarn start` compiles main and launches through `scripts/run-electron.js`. On macOS that launcher applies Kap branding to the local Electron host once per installed Electron version, so development does not flash an Electron icon or name.

### Checks

```bash
yarn typecheck
yarn lint
yarn test:main
yarn build-renderer
```

CI runs the same compile, lint, test, and renderer build checks on macOS. Next 10 uses Webpack 4, so only the renderer build command receives Node's OpenSSL legacy-provider flag. The Electron launcher explicitly strips that flag before starting the runtime.

### Package

```bash
CSC_IDENTITY_AUTO_DISCOVERY=false yarn pack
```

The unsigned directory build is useful for local integration checks. Release builds still require the project's signing and notarization credentials. Packaged metadata is defined in `package.json`: product name `Kap`, bundle identifier `com.wulkano.kap`, Kap icon, usage descriptions, and `LSUIElement=true`.

## Architecture For Contributors

The relevant runtime path is intentionally narrow:

1. `main/index.ts` establishes Kap's activation policy, initializes remote once, prepares renderer routing, and constructs the tray.
2. `main/tray.ts` keeps click handling asynchronous and delegates overlay ownership to the window manager.
3. `main/windows/cropper.ts` checks permissions, enumerates Electron displays, creates one cropper per display, enables remote, waits for renderer load, and prevents overlapping opens.
4. `renderer/pages/cropper.js` receives display state and signals main only after the action bar has committed and painted; mouse events remain ignored until then.
5. `renderer/containers/cropper.js` owns selection state and passes capture settings to `main/aperture.ts`.
6. `main/common/settings.ts` is the canonical settings schema. Keep `renderer/common/settings.js` synchronized while the legacy renderer still imports it.

Keep startup imports deliberate. Window modules other than the cropper are deferred until after tray-ready, tray menu data is cached and refreshed asynchronously, and network-backed plugin discovery must never block Preferences from opening or switching pages.

When debugging renderer startup, preserve the order: prove `did-finish-load`, then preload/remote initialization, then IPC, then permissions and capture. A transparent failed window can look like a frozen main process even when main is healthy.

## macOS Behavior

Kap uses accessory activation plus `LSUIElement`, so it remains a menu-bar application even while Preferences or the cropper is visible. macOS intentionally omits UI-element applications from the standard Force Quit Applications list. Kap remains visible as Kap in Activity Monitor and always provides **Quit Kap** in its menus; these OS behaviors cannot be combined with a permanently hidden Dock icon in one process.

Screen Recording and Microphone access are managed in **System Settings > Privacy & Security**. Permission dialogs use the signed app bundle's identity, so final release signing is required for stable production permission records.

## Remaining Migration Work

The Electron 43 compatibility layer keeps `@electron/remote` contained, but removing remote entirely is still worthwhile as a separate migration. The project also still carries Next 10/Webpack 4 and older JavaScript preference components. Those upgrades are intentionally outside this bug fix; broad dependency removal, ESM conversion, and full TypeScript strict mode would obscure the proven runtime repair.

## Contributing

Keep changes evidence-driven and scoped. Include the failing execution point for bug fixes, avoid synchronous work in tray handlers and startup, add contextual error reporting at process boundaries, and run all four checks above before opening a pull request. See [CONTRIBUTING.md](CONTRIBUTING.md) for the community workflow.

Kap builds on the original work of the [Kap](https://github.com/wulkano/Kap) team and Wulkano contributors. This fork is maintained by the [NewKap](https://github.com/MuntasirMalek/NewKap) community under the [MIT License](LICENSE).
