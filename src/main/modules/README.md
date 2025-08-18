# Main Process Modules

This directory contains modules that run in the main Electron process.

## Modules

### app-setup.js
Handles application setup, window creation, and lifecycle management.

### debug-log.js
Provides debug logging functionality for the main process.

### database-setup.js
Handles database initialization and setup for the main process. This module:
- Initializes the node-sqlite3-wasm WebAssembly module
- Creates and manages the SQLite database instance using the oo1 (object-oriented) API
- Sets up database schema and indexes
- Provides database save/load functionality with file serialization

**Key Features:**
- Uses the node-sqlite3-wasm package for maximum compatibility and performance
- Automatically handles WebAssembly module initialization
- Supports migration from legacy database formats with automatic backup creation
- Direct file-based database operations with automatic persistence
- Falls back to in-memory database if file operations fail
- Provides comprehensive error logging and fallback handling
- Modern ES module design with async/await patterns

### file-operations.js
Handles file system operations and file management.

### ipc-handlers.js
Manages all IPC (Inter-Process Communication) between main and renderer processes.

### log-service.js
Provides centralized logging service for file persistence and export.

## Usage

All modules are initialized in `src/main/index-modular.js` and dependencies are injected as needed.
