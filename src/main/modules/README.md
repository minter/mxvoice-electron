# Main Process Modules

This directory contains modules that run in the main Electron process.

## Modules

### app-setup.js
Handles application setup, window creation, and lifecycle management. Enhanced with:
- **Window state persistence**: Saves and restores window position, size, maximized/fullscreen state
- **Multi-monitor support**: Tracks display ID and validates display availability on startup
- **Event-driven saving**: Automatically saves state on window resize, move, maximize, minimize, and close events
- **Backward compatibility**: Integrates with existing UI state persistence patterns

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
Manages all IPC (Inter-Process Communication) between main and renderer processes. Enhanced with:
- **Streaming file operations**: Uses Node.js streams for efficient memory usage during large file copies
- **Progress tracking**: Provides real-time progress updates for long-running file operations
- **Error handling and cleanup**: Robust error handling with automatic cleanup of partial files
- **Stream management**: Proper stream lifecycle management with automatic cleanup

**Key Features:**
- `file-copy`: Streaming file copy with memory efficiency
- `file-copy-with-progress`: File copy with progress tracking capabilities
- Automatic destination directory creation
- Partial file cleanup on errors
- Comprehensive error logging and recovery

### log-service.js
Provides centralized logging service for file persistence and export.

## Usage

All modules are initialized in `src/main/index-modular.js` and dependencies are injected as needed.
