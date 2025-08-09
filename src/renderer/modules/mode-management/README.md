# Mode Management Module

## Overview

The Mode Management Module handles mode switching functionality for the application. It manages the holding tank mode (storage vs playlist) and autoplay functionality.

## Functions

### `initModeManagement()`
Initializes the mode management module by loading the saved mode from store or defaulting to storage mode.

**Returns:** `Promise<Object>` - Result of initialization

### `setHoldingTankMode(mode)`
Sets the holding tank mode to either "storage" or "playlist".

**Parameters:**
- `mode` (string) - The mode to set ('storage' or 'playlist')

**Returns:** `Promise<Object>` - Result of the operation

### `getHoldingTankMode()`
Gets the current holding tank mode.

**Returns:** `string` - Current mode ('storage' or 'playlist')

### `toggleAutoPlay()`
Toggles between storage and playlist modes.

**Returns:** `Promise<Object>` - Result of the operation

### `getAutoPlayState()`
Gets the current autoplay state.

**Returns:** `boolean` - Current autoplay state

### `setAudioContext(audioContext)`
Sets the audio context reference for mode management.

**Parameters:**
- `audioContext` (Object) - The audio context object

### `resetToDefaultMode()`
Resets mode to default (storage).

**Returns:** `Promise<Object>` - Result of the operation

## Usage

```javascript
import modeManagement from './modules/mode-management/index.js';

// Initialize the module
await modeManagement.initModeManagement();

// Set mode to playlist
await modeManagement.setHoldingTankMode('playlist');

// Toggle between modes
await modeManagement.toggleAutoPlay();

// Get current mode
const currentMode = modeManagement.getHoldingTankMode();
```

## Dependencies

- jQuery for DOM manipulation
- window.electronAPI.store for persistent storage
- Global audio context (sound variable)

## Integration

This module is integrated with the main renderer.js file and provides mode switching functionality for the holding tank feature. 