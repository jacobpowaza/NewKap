<p align="center">
  <h1 align="center">NewKap</h1>
  <p align="center"><strong>Community-driven Kap fork focused on reliability and community maintenance</strong></p>
  <p align="center">An open-source screen recorder built with web technology</p>
</p>

---

## Install

    brew tap MuntasirMalek/newkap
    brew install --cask newkap

Automatically installs the right version for your Mac (Intel or Apple Silicon).

### Uninstall (clean, removes all app data)

    brew uninstall --zap --cask newkap

Or download the `.dmg` directly from [Releases](https://github.com/MuntasirMalek/NewKap/releases/latest).

---

## Why NewKap?

[Kap](https://github.com/wulkano/Kap) is an amazing open-source screen recorder, but it has not been actively maintained since 2022. The last release (v3.6.0) has critical bugs on macOS Sonoma and Sequoia, with 30+ open issues and 13 unmerged PRs sitting in the original repo.

**NewKap** is a community-driven continuation, like Neovim is to Vim. Our goals:

- Fix what is broken: macOS Sonoma/Sequoia compatibility, recording failures, app hangs
- Community-owned: no single point of failure; the community drives development
- Democratic governance: contributors vote on changes via GitHub Discussions
- Regular releases: if it is fixed, ship it

## What is Fixed (v4.0.0)

| Issue | Fix |
|-------|-----|
| Could not start recording within 5 seconds | Increased timeout to 30s with automatic retry |
| App will not quit / hangs on close | Proper async cleanup with 5s force-quit fallback |
| App startup is slow / hangs | Non-blocking plugin upgrade and update checks |
| Screen capture permission crash on Sonoma | Safe-load fallback for native permission module |
| System Preferences links broken | Updated to System Settings for Sonoma/Sequoia |
| Audio device crashes | Device caching with graceful error fallback |
| Unhandled promise rejections | Expanded error handling throughout the app |
| Recording history cleanup crash | Safe per-file deletion with existence checks |

## Install

Download the latest .dmg from [Releases](https://github.com/MuntasirMalek/NewKap/releases):

- **Intel Mac**: NewKap-4.0.0-x64.dmg
- **Apple Silicon (M1/M2/M3)**: NewKap-4.0.0-arm64.dmg

### First Launch (unsigned build)

Since NewKap is not code-signed, macOS will block it on first launch:

1. Drag NewKap to your Applications folder
2. Right-click the app then Open (not double-click)
3. Click Open in the security dialog
4. Grant Screen Recording permission in System Settings then Privacy and Security then Screen Recording

## Build from Source

Clone and install:

    git clone https://github.com/MuntasirMalek/NewKap.git
    cd NewKap
    yarn install --ignore-engines

Development:

    unset ELECTRON_RUN_AS_NODE
    yarn start

Build distributable:

    NODE_OPTIONS="--openssl-legacy-provider" CSC_IDENTITY_AUTO_DISCOVERY=false yarn dist

Note: If running from VS Code terminal, you must unset ELECTRON_RUN_AS_NODE first.

## Community Governance

NewKap is community-governed. Here is how it works:

### Contributing Changes

1. Fork the repo, create a branch, make your changes
2. Open a Pull Request with a clear description
3. The community reviews and votes via thumbs-up/thumbs-down reactions on the PR
4. PRs with 3+ approvals and no blocking issues get merged

### Proposing Features

1. Open a [Discussion](https://github.com/MuntasirMalek/NewKap/discussions) in the Ideas category
2. The community votes with reactions
3. Ideas with strong support get added to the roadmap

### Becoming a Maintainer

Active contributors who have had 3+ PRs merged can request maintainer access. Maintainers can:
- Merge approved PRs
- Create releases
- Triage issues

See [CONTRIBUTING.md](CONTRIBUTING.md) for full details.

## Roadmap

- [ ] Upgrade to modern Electron (28+)
- [ ] Native Apple Silicon optimization
- [ ] macOS Sequoia full compatibility
- [ ] Plugin system modernization
- [ ] Improved export formats
- [ ] ProRes recording support

## Credits

NewKap is built on the incredible work of the [Kap](https://github.com/wulkano/Kap) team at [Wulkano](https://wulkano.com). We are grateful for the foundation they created.

## License

[MIT](LICENSE)
