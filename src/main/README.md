# Modular Main Process Structure

This directory contains the modular main process scripts for the Electron application.

## Structure

```
src/main/
├── modules/
│   ├── app-setup.js        # Window creation, menu setup, app lifecycle
│   ├── ipc-handlers.js     # All IPC communication handlers
│   └── file-operations.js  # File and directory operations
├── index-modular.js        # Main modular coordinator
└── README.md              # This file
```

## Modules

### app-setup.js
- Handles window creation and configuration
- Manages application menu creation
- Sets up app lifecycle events
- Handles platform-specific features (Apple Silicon warnings, etc.)
- Exports: `createWindow()`, `createApplicationMenu()`, `setupAppLifecycle()`, UI operation functions

### ipc-handlers.js
- Contains all IPC handlers for renderer communication
- Manages database operations through IPC
- Handles file system operations through IPC
- Manages store operations through IPC
- Handles audio operations through IPC
- Exports: `initializeIpcHandlers()`, `registerAllHandlers()`, `removeAllHandlers()`, `testIpcHandlers()`

### file-operations.js
- Handles hotkey file loading and saving
- Manages holding tank file operations
- Handles directory and file dialogs
- Manages preference migration
- Exports: `loadHotkeysFile()`, `saveHotkeysFile()`, `addDirectoryDialog()`, `addFileDialog()`, `migrateOldPreferences()`

## Usage

### ✅ COMPLETED: Migration to Modular Implementation
The original `src/index.js` (1203 lines) has been successfully replaced with a modular approach using `src/main/index-modular.js` (242 lines) which:
1. Imports all modules
2. Sets up dependencies and configuration
3. Initializes database and store
4. Creates window and menu
5. Registers IPC handlers
6. Coordinates all components

## Migration Path

1. **Phase 1**: ✅ Keep current `index.js` working
2. **Phase 2**: ✅ Test modular implementation alongside current
3. **Phase 3**: ✅ Switch to modular implementation
4. **Phase 4**: ✅ Remove old `index.js` - **COMPLETED**

## Testing

Run the test script to verify modular components:
```bash
node src/test-modular-main.js
```

## Benefits

- **Maintainability**: Smaller, focused modules
- **Testability**: Each module can be tested independently
- **Reusability**: Modules can be reused in different contexts
- **Clarity**: Clear separation of concerns
- **Debugging**: Easier to isolate and fix issues

## Current Status

✅ **App Setup**: Complete with window creation and menu setup
✅ **IPC Handlers**: Complete with all event handlers
✅ **File Operations**: Complete with all file operations
✅ **Modular Coordinator**: Complete and functional
✅ **Testing**: Test scripts available
✅ **Migration**: Successfully completed - original index.js removed

## Next Steps

The main process modularization is **COMPLETE**. The next phase is renderer process modularization:

- **Renderer Process**: `src/renderer.js` (3112 lines) - Needs modularization
- **Preload Process**: `src/preload/` - Already modularized
- **Shared Modules**: `src/shared/` - Ready for common utilities 