# Main Process Modules

This directory contains modules that run in the main Electron process.

## Modules

### app-setup.js
Handles application setup, window creation, and lifecycle management.

### debug-log.js
Provides debug logging functionality for the main process.

### database-setup.js
Handles database initialization and setup for the main process. This module:
- Initializes SQL.js with proper WASM file path resolution for both development and production
- Creates and manages the SQLite database instance
- Sets up database schema and indexes
- Provides database save/load functionality

**Key Features:**
- Correctly resolves SQL.js WASM file paths in both development (`yarn start`) and production (built binary) environments
- Uses `process.resourcesPath` for production WASM file location
- Falls back to in-memory database if file operations fail
- Provides comprehensive error logging

### file-operations.js
Handles file system operations and file management.

### ipc-handlers.js
Manages all IPC (Inter-Process Communication) between main and renderer processes.

### log-service.js
Provides centralized logging service for file persistence and export.

## Usage

All modules are initialized in `src/main/index-modular.js` and dependencies are injected as needed.
