# Modular Main Process

This directory contains the modular main process for the Electron app. The entry point is `index-modular.js`, which initializes services, creates the window, and wires IPC securely with context isolation.

## Structure

```text
src/main/
├── modules/
│   ├── app-setup.js        # Window/menu/app lifecycle, UI commands → renderer
│   ├── ipc-handlers.js     # Secure IPC: database, file system, store, audio, path, os, app, logs
│   ├── file-operations.js  # User dialogs + hotkey/holding-tank import/export, prefs migration
│   ├── debug-log.js        # Main-process DebugLog (uses electron-store & electron-log)
│   └── log-service.js      # Centralized log sink: daily file, retention, export, IPC endpoints
├── index-modular.js        # Coordinator: store, DB init, updater, modules init, createWindow
└── README.md
```

## Modules

- `app-setup.js`
  - Creates the `BrowserWindow` with secure `webPreferences` (contextIsolation on, preload set)
  - **Enhanced window state persistence**: saves/restores position, size, maximized state, fullscreen state, and display ID
  - **Multi-monitor support**: validates display existence and handles display changes gracefully
  - Builds the application menu (platform-aware), sends UI commands to renderer
  - Manages app lifecycle (activate, window-all-closed, ready-to-show updater checks)
  - Apple Silicon x64 warning for users on Rosetta
  - Exports: `initializeAppSetup`, `createWindow`, `createApplicationMenu`, `setupAppLifecycle`, `setupWindowStateSaving`, `saveWindowState`, `loadWindowState`, and UI senders

- `ipc-handlers.js`
  - Registers all secure IPC handlers (DB query/execute, store get/set/has/delete/clear, FS ops, path/os, audio controls, app ops, dialogs)
  - Adds Logs endpoints: `logs:write`, `logs:get-paths`, `logs:export`
  - Injects dependencies from coordinator (window, db, store, updater, debugLog, logService)
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

- `log-service.js`
  - Centralized log service configuring electron-log to write to `userData/logs/app-YYYY-MM-DD.log`
  - Rotation: daily file (selected at app start) with 5 MB size-based rollover
  - Retention: prune files older than 14 days at app start (configurable)
  - Export: concatenates recent N days into a single `.log` via `exportLogs({ days })`
  - Exports: `initMainLogService`, `getLogService`

## Coordinator (`index-modular.js`)

- Creates `electron-store` with defaults; initializes DebugLog
- Sets up auto-updater (logger, feed URL on macOS, sends release notes to renderer for sanitization)
- First-run flow: create folders, seed DB with starter content if needed
- Initializes SQLite WebAssembly database using `node-sqlite3-wasm`
- Creates the main window and application menu with enhanced state restoration
- Injects dependencies into modules; registers secure IPC handlers

## Window State Persistence

The application now maintains complete window state across sessions:

- **Position & Size**: Window coordinates and dimensions are saved and restored
- **Window State**: Maximized and fullscreen states are preserved
- **Multi-Monitor Support**: Display ID is saved and validated on startup
- **Event-Driven Saving**: State is automatically saved on resize, move, maximize, minimize, and close
- **Backward Compatibility**: Falls back to legacy width/height storage if no complete state exists
- **Store Integration**: Uses the same `electron-store` system as other UI state (column order, holding tank, etc.)

### Notes

- Context Isolation is enabled; all renderer access is via preload/IPC
- Audio playback for quick tests uses Howler in main (via IPC) when applicable
- Auto-updater sends release notes to renderer where they are sanitized using DOMPurify
- The application menu includes an "Export Logs…" item:
  - macOS: under the app menu (e.g., `Mx. Voice` → `Export Logs…`)
  - Windows/Linux: under `Help` → `Export Logs…`
- Standard roles are used for common actions:
  - Developer Tools uses the built-in role (`toggleDevTools`)
  - Quit uses the built-in role (`quit`) across platforms
- About: macOS uses the system About panel; Windows/Linux uses a custom dark-mode-aware About dialog under `Help`
- Support: A "Contact Support…" item opens your default mail client to `mailto:support@mxvoice.app`

### Adding a new IPC handler

1. Add the handler in `modules/ipc-handlers.js` within `registerAllHandlers()`
2. Validate inputs; return `{ success, data|error }`
3. Expose via preload secure bridge if needed

### Logs IPC Reference

- `logs:write` → Write a line through the centralized log service. Payload: `{ level, message, context?, meta? }`
- `logs:get-paths` → Returns `{ logsDir, current }`
- `logs:export` → Opens a save dialog and exports recent logs. Options: `{ days?: number }`

### Status

- App setup, IPC, file ops, and coordinator are complete and in use.
