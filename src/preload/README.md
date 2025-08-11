## Modular Preload

Secure, context-isolated preload that exposes a vetted API to the renderer and bridges main-renderer events.

### Structure
```
src/preload/
├── modules/
│   ├── ipc-bridge.js          # Registers inbound events from main → renderer callbacks
│   ├── secure-api-exposer.js  # Exposes `secureElectronAPI` and legacy `electronAPI` via contextBridge
│   ├── api-exposer.js         # Legacy/global exposure helper (kept for migration)
│   └── database-setup.js      # (reserved) database helpers if needed
├── preload-modular.js         # Coordinator: register IPC handlers, expose secure API
└── README.md
```

### Modules

- `secure-api-exposer.js`
  - Exposes `secureElectronAPI` via `contextBridge.exposeInMainWorld`
  - Namespaces: `database`, `store`, `fileSystem`, `path`, `os`, `audio`, `app`, `fileOperations`, `ui`, `events`, `utils`, `testing`
  - Also exposes a compatibility `electronAPI` with a subset of methods
  - Exports: `secureElectronAPI`, `exposeSecureAPI`

- `ipc-bridge.js`
  - Registers handlers for events sent from main (e.g., `fkey_load`, `holding_tank_load`, UI commands)
  - For context isolation, many UI events are intended to be re-wired through the secure events API
  - Exports: `registerIpcHandlers`, `removeIpcHandlers`, `getIpcHandlers`, `testIpcBridge`

- `api-exposer.js` (legacy helper)
  - Provides `electronAPI` and legacy globals on `global` for non-isolated contexts
  - Kept for migration/backward compatibility; modern apps should prefer `secure-api-exposer.js`
  - Exports: `electronAPI`, `legacyGlobals`, `setupGlobalExposure`, `setDatabaseInstance`, `testApiExposer`

### Coordinator (`preload-modular.js`)
- Initializes a simple debug logger using `electron-log`
- Registers IPC handlers via `ipcBridge.registerIpcHandlers()`
- Exposes the secure API via `secureApiExposer.exposeSecureAPI()`
- Logs initialization status; no direct global mutations

### Usage from renderer
- Access secure API via `window.secureElectronAPI`
- Legacy code may use `window.electronAPI` (compatibility layer)

### Notes
- Context isolation must be enabled; no direct Node APIs are exposed
- All main interactions go through IPC with validation on the main side