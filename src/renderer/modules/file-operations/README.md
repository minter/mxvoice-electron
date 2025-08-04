# File Operations Module

## Overview

The File Operations module handles all file I/O operations in the application, including opening and saving hotkey files, holding tank files, directory picking, and update installation.

## Functions

### Core File Operations (`file-operations.js`)

- **`openHotkeyFile()`** - Opens a hotkey file with modern API fallback
- **`openHoldingTankFile()`** - Opens a holding tank file with modern API fallback  
- **`saveHotkeyFile()`** - Saves current hotkey configuration to file
- **`saveHoldingTankFile()`** - Saves current holding tank configuration to file

### System Operations (`system-operations.js`)

- **`pickDirectory(event, element)`** - Opens directory picker dialog
- **`installUpdate()`** - Installs application updates with restart

## Features

- **Modern API Support** - Uses `window.electronAPI` when available
- **Legacy Fallback** - Falls back to `ipcRenderer` for compatibility
- **Error Handling** - Graceful error handling with console warnings
- **jQuery Integration** - Uses jQuery for DOM manipulation

## Usage

```javascript
import { openHotkeyFile, saveHotkeyFile, pickDirectory } from './modules/file-operations/index.js';

// Open a hotkey file
openHotkeyFile();

// Save current hotkey configuration
saveHotkeyFile();

// Pick a directory
pickDirectory(event, element);
```

## Dependencies

- `window.electronAPI` - Modern Electron API
- `ipcRenderer` - Legacy Electron IPC
- `jQuery` - DOM manipulation
- `defaultPath` - Global variable for directory picker

## Architecture

The module is organized into two files:
- `file-operations.js` - Core file I/O functions
- `system-operations.js` - System-level operations

Both files are imported and re-exported through the main `index.js` file for easy module loading. 