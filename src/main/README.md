## Modular Main Process

This directory contains the modular main process for the Electron app. The entry point is `index-modular.js`, which initializes services, creates the window, and wires IPC securely with context isolation.

### Structure
```
src/main/
├── modules/
│   ├── app-setup.js        # Window/menu/app lifecycle, UI commands → renderer
│   ├── ipc-handlers.js     # Secure IPC: database, file system, store, audio, path, os, app
│   ├── file-operations.js  # User dialogs + hotkey/holding-tank import/export, prefs migration
│   └── debug-log.js        # Main-process DebugLog (uses electron-store & electron-log)
├── index-modular.js        # Coordinator: store, DB init, updater, modules init, createWindow
└── README.md
```

### Modules

- `app-setup.js`
  - Creates the `BrowserWindow` with secure `webPreferences` (contextIsolation on, preload set)
  - Builds the application menu (platform-aware), sends UI commands to renderer
  - Manages app lifecycle (activate, window-all-closed, ready-to-show updater checks)
  - Apple Silicon x64 warning for users on Rosetta
  - Exports: `initializeAppSetup`, `createWindow`, `createApplicationMenu`, `setupAppLifecycle`, and UI senders

- `ipc-handlers.js`
  - Registers all secure IPC handlers (DB query/execute, store get/set/has/delete/clear, FS ops, path/os, audio controls, app ops, dialogs)
  - Injects dependencies from coordinator (window, db, store, updater, debugLog)
  - Exports: `initializeIpcHandlers`, `registerAllHandlers`, `removeAllHandlers`, `testIpcHandlers`

- `file-operations.js`
  - User-facing dialogs for opening/saving hotkey (`.mrv`) and holding-tank (`.hld`) files
  - Kicks bulk add / add single file flows in renderer via IPC
  - Migrates legacy preferences into `electron-store`
  - Exports: `initializeFileOperations`, `loadHotkeysFile`, `saveHotkeysFile`, `loadHoldingTankFile`, `saveHoldingTankFile`, `addDirectoryDialog`, `addFileDialog`, `migrateOldPreferences`

- `debug-log.js`
  - Main-process DebugLog with level control and preference-backed enablement via `electron-store`
  - Replaces direct `electron-log` usage with structured, leveled logs
  - Exports: `initializeMainDebugLog`

### Coordinator (`index-modular.js`)
- Creates `electron-store` with defaults; initializes DebugLog
- Sets up auto-updater (logger, feed URL on macOS)
- First-run flow: create folders, seed DB with starter content if needed
- Initializes SQLite DB (switches mrvoice.db/mxvoice.db as present)
- Creates the main window and application menu
- Injects dependencies into modules; registers secure IPC handlers

### Notes
- Context Isolation is enabled; all renderer access is via preload/IPC
- Audio playback for quick tests uses Howler in main (via IPC) when applicable

### Adding a new IPC handler
1. Add the handler in `modules/ipc-handlers.js` within `registerAllHandlers()`
2. Validate inputs; return `{ success, data|error }`
3. Expose via preload secure bridge if needed

### Status
- App setup, IPC, file ops, and coordinator are complete and in use.