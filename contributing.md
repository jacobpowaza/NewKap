# Contributing to NewKap

Thank you for your interest in contributing to NewKap! This project is community- every contribution matters.driven 

## How to Contribute

### Reporting Bugs

1. Check [existing issues](https://github.com/MuntasirMalek/NewKap/issues) first
2. Include your macOS version, Mac type (Intel/Apple Silicon), and steps to reproduce
3. Attach console logs if possible (open Console.app, filter by "NewKap")

### Submitting Changes

1. Fork the repository
2. Create a feature branch: `git checkout -b fix/your-fix-name`
3. Make your changes with clear, minimal commits
4. Test locally: `unset ELECTRON_RUN_AS_NODE && yarn start`
5. Push and open a Pull Request

### PR Review Process

NewKap uses **community voting** for PR approval:

- Any community member can review and vote with thumbs-up or thumbs-down reactions on the PR
- **3+ approvals** from different users = eligible for merge
- Any maintainer can merge an approved PR
- If a PR has been open for 7+ days with 3+ approvals and no objections, it will be merged

### Becoming a Maintainer

After 3+ merged PRs, you can request maintainer access by opening a Discussion. Maintainers can:
- Merge community-approved PRs
- Create releases
- Triage and label issues
- The goal is to have multiple maintainers so the project never depends on one person

## Development Setup

    git clone https://github.com/MuntasirMalek/NewKap.git
    cd NewKap
    yarn install --ignore-engines
    unset ELECTRON_RUN_AS_NODE
    yarn start

### Project Structure

    main/               Electron main process (TypeScript)
      aperture.ts         Screen recording logic
      index.ts            App entry point and lifecycle
      common/             Shared utilities (permissions, settings)
      utils/              Helper modules (devices, errors)
    renderer/           Next.js renderer (React)
      pages/              App windows (cropper, editor, preferences)
    scripts/            Build and patch scripts
    static/             Icons and static assets

### Key Commands

| Command | Description |
|---------|-------------|
| `yarn start` | Run in development mode |
| `yarn build` | Build main + renderer |
| `yarn dist` | Build distributable DMG |
| `npx tsc` | Compile TypeScript only |

### Important Notes

- Always `unset ELECTRON_RUN_AS_NODE` when running from VS Code terminal
- Use `--ignore-engines` with yarn if on Node 18+
- Use `NODE_OPTIONS="--openssl-legacy-provider"` for production builds
- Use `--no-verify` for git commits (xo linter has Node 18+ compatibility issues)
- Follow [`docs/electron-security.md`](docs/electron-security.md) when adding renderer access to Electron or main-process functionality

## Code of Conduct

Be kind, be respectful, be constructive. We are all here because we love this app.
