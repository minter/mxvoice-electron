# Modular Preload Structure

This directory contains the modular preload scripts for the Electron application.

## Structure

```
src/preload/
├── modules/
│   ├── database-setup.js    # Database initialization and setup
│   ├── api-exposer.js       # Context bridge and API exposure
│   └── ipc-bridge.js        # IPC communication handlers
├── preload-modular.js       # Main modular preload coordinator
└── README.md               # This file
```

## Modules

### database-setup.js
- Handles SQLite database initialization
- Sets up database indexes for performance
- Provides fallback in-memory database for testing
- Exports: `initializeDatabase()`, `setupDatabaseIndexes()`, `getDatabase()`, `testDatabaseSetup()`

### api-exposer.js
- Manages context bridge and API exposure
- Provides modern `electronAPI` object
- Maintains backward compatibility with legacy globals
- Exports: `electronAPI`, `legacyGlobals`, `setupGlobalExposure()`, `setDatabaseInstance()`, `testApiExposer()`

### ipc-bridge.js
- Handles all IPC communication between renderer and main process
- Registers event handlers for UI operations
- Manages hotkey and holding tank operations
- Exports: `registerIpcHandlers()`, `removeIpcHandlers()`, `getIpcHandlers()`, `testIpcBridge()`

## Usage

### Current Implementation
The main `src/preload.js` (268 lines) contains all functionality in one file.

### Modular Implementation
The modular approach uses `src/preload-modular.js` which:
1. Imports all modules
2. Initializes database
3. Sets up global exposure
4. Registers IPC handlers
5. Coordinates all components

## Migration Path

1. **Phase 1**: Keep current `preload.js` working
2. **Phase 2**: Test modular implementation alongside current
3. **Phase 3**: Switch to modular implementation
4. **Phase 4**: Remove old `preload.js`

## Testing

Run the test script to verify modular components:
```bash
node src/test-modular-preload.js
```

## Benefits

- **Maintainability**: Smaller, focused modules
- **Testability**: Each module can be tested independently
- **Reusability**: Modules can be reused in different contexts
- **Clarity**: Clear separation of concerns
- **Debugging**: Easier to isolate and fix issues

## Current Status

✅ **Database Setup**: Complete with fallback support
✅ **API Exposer**: Complete with modern and legacy APIs
✅ **IPC Bridge**: Complete with all event handlers
✅ **Modular Coordinator**: Complete and functional
✅ **Testing**: Test scripts available

The modular preload is ready for testing and gradual migration. 