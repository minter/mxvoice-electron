## Modular Preload

Secure, sandboxed, context-isolated preload that exposes a vetted API to the renderer and bridges main-renderer events.

### Build

The preload is bundled into a single file (`preload-bundle.cjs`) by esbuild because sandboxed preloads can only `require('electron')` — no local module imports are allowed. The bundle is generated automatically by `npm start`, `npm test`, and `npm run build`.

```bash
npm run build:preload
```

### Structure
```
src/preload/
├── modules/
│   ├── ipc-bridge.cjs          # Registers inbound events from main → renderer callbacks
│   ├── secure-api-exposer.cjs  # Exposes `secureElectronAPI` and legacy `electronAPI` via contextBridge
│   └── api-exposer.cjs         # Legacy/global exposure helper (kept for migration)
├── preload-modular.cjs         # Coordinator: register IPC handlers, expose secure API
├── preload-bundle.cjs          # Generated bundle (gitignored)
├── about-preload.cjs           # Minimal API for About dialog
├── launcher-preload.cjs        # Profile launcher API
└── README.md
```

### Modules

- `secure-api-exposer.cjs`
  - Exposes `secureElectronAPI` via `contextBridge.exposeInMainWorld`
  - Namespaces: `database`, `store`, `fileSystem`, `path`, `os`, `audio`, `app`, `fileOperations`, `ui`, `events`, `utils`, `logs`, `testing`
  - Database operations use named IPC handlers only — no raw SQL
  - Logs API:
    - `logs.write(level, message, context?, meta?)` → forwards to main; payload is sanitized for IPC
    - `logs.export({ days })` → triggers export in main
    - `logs.getPaths()` → returns `{ logsDir, current }`
  - Also exposes a compatibility `electronAPI` with a subset of methods, including `electronAPI.logs`
  - Exports: `secureElectronAPI`, `exposeSecureAPI`

- `ipc-bridge.cjs`
  - Registers handlers for events sent from main (e.g., `display_release_notes`, `update_download_progress`)
  - For context isolation, UI events are dispatched as CustomEvents on window
  - Exports: `registerIpcHandlers`, `removeIpcHandlers`, `getIpcHandlers`, `testIpcBridge`

- `api-exposer.cjs` (legacy helper)
  - Provides `electronAPI` and legacy globals for non-isolated contexts
  - Kept for migration/backward compatibility; modern apps should prefer `secure-api-exposer.cjs`

### Coordinator (`preload-modular.cjs`)
- IPC-based logging (sends messages to main process via `ipcRenderer.send`)
- Registers IPC handlers via `ipcBridge.registerIpcHandlers()`
- Exposes the secure API via `secureApiExposer.exposeSecureAPI()`
- Captures renderer unhandled errors/rejections and mirrors console error/warn into the centralized log service

### Usage from renderer
- Access secure API via `window.secureElectronAPI`
- Legacy code may use `window.electronAPI` (compatibility layer)

### Notes
- Sandbox: ON — preload runs in sandboxed context
- Context isolation: ON — no direct Node APIs are exposed
- All main interactions go through IPC with validation on the main side
- The bundled file is the only preload loaded at runtime; source files are for development
