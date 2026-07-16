# Electron Renderer Security

Kap renderers must not import Electron or Node modules directly. Browser windows run with:

- `contextIsolation: true`
- `nodeIntegration: false`
- a preload script at `main/preload.ts`

## Renderer Access Pattern

Use the preload bridge exposed as `window.kap`. Source modules should import the wrapper:

```ts
import kap from '../utils/kap';
import {ipcRenderer} from '../utils/ipc';
```

Do not add:

```ts
import electron from 'electron';
const electron = require('electron');
const remote = require('@electron/remote');
```

## Adding Main-Process Access

Add a named method to `main/preload.ts` and a matching handler in `main/renderer-api.ts`.

Rules:

- Expose the smallest operation the renderer needs, not a generic `require`, `shell`, `app`, or `BrowserWindow` object.
- Validate channel inputs in the main process when values come from user input or plugin metadata.
- Keep privileged work in `main/`; return plain serializable data to renderers.
- Use `renderer/utils/menu-actions.ts` for renderer-built menu templates so clicks are represented by action IDs, not main-process objects.

## Settings and Plugins

Settings and plugin configuration are main-process-owned. Renderers may call the bridge methods for reads, writes, and subscriptions, but must not instantiate `electron-store`, `InstalledPlugin`, or plugin modules directly.

## Content Security Policy

The global CSP is defined in `renderer/pages/_app.tsx`. If a feature needs a new source, prefer a narrow directive such as `img-src` or `connect-src` over widening `default-src`.

Avoid adding new inline script requirements. Next.js 10 currently requires `'unsafe-inline'` for existing exported pages; do not use that as a reason to add arbitrary inline scripts.
