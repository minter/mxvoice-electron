## Modular Preload

The sandboxed, context-isolated preload exposes the renderer's vetted IPC surface as `window.secureElectronAPI`.

### Build

The source preload is bundled because Electron sandboxed preloads cannot load local CommonJS modules directly.

```bash
npm run build:preload
```

`npm start`, `npm test`, and packaging commands also build the preload.

### Structure

- `preload-modular.cjs` coordinates initialization.
- `modules/secure-api-exposer.cjs` defines and exposes `secureElectronAPI`.
- `modules/ipc-bridge.cjs` registers main-to-renderer events.
- `preload-bundle.cjs` is the generated runtime bundle.
- `about-preload.cjs` and `launcher-preload.cjs` expose window-specific APIs.

The secure API is organized into namespaces including `database`, `store`, `fileSystem`, `path`, `os`, `audio`, `app`, `fileOperations`, `ui`, `events`, `utils`, `logs`, `analytics`, `profile`, and `library`. Channel names come from `src/shared/ipc-channels.cjs`; database access uses named operations rather than raw SQL.

No legacy `electronAPI` facade or direct Node.js access is exposed to the renderer.
