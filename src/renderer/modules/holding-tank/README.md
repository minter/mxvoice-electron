# Holding Tank Module

The Holding Tank module manages the storage and playlist functionality for Mx. Voice. It provides a flexible system for storing songs and managing playback modes.

## Overview

The holding tank operates in two distinct modes:

- **Storage Mode**: Simple storage of songs for later use
- **Playlist Mode**: Automatic playback of songs in sequence with autoplay functionality

## Features

- ✅ Add/remove songs from holding tank
- ✅ Save/load holding tank data to/from store
- ✅ Drag and drop functionality
- ✅ Mode switching (storage vs playlist)
- ✅ File import/export
- ✅ Tab management
- ✅ Autoplay management
- ✅ UI state management
- ✅ Responsive design with adaptive mode toggle

## Responsive Design

The holding tank mode toggle buttons automatically adapt to different screen sizes while maintaining horizontal alignment:

- **Large screens (>1400px)**: Display both icons and text labels side by side
- **Medium screens (≤1400px)**: Show only icons with hover tooltips, maintaining horizontal layout
- **Small screens (≤1200px)**: Optimized spacing and touch targets
- **Very small screens (≤1000px)**: Minimal spacing for extremely narrow columns

The buttons maintain proper horizontal alignment across all screen sizes, with hover tooltips providing context when text is hidden. The breakpoint at 1400px ensures icons remain properly aligned before text labels cause misalignment.

**Tooltip Behavior**: All tooltips have a 1-second delay before appearing, preventing accidental activation when quickly moving the mouse across the interface. The delay is centrally configured via CSS custom properties for easy modification.

## API Reference

### Core Functions

#### `initHoldingTank()`
Initializes the holding tank module and loads saved settings.

**Returns:** Promise<{success: boolean, mode?: string, error?: string}>

```javascript
import { initHoldingTank } from './modules/holding-tank';

initHoldingTank().then(result => {
  if (result.success) {
    console.log('Holding tank initialized in mode:', result.mode);
  }
});
```

#### `saveHoldingTankToStore()`
Saves the current holding tank state to the store.

**Returns:** Promise<{success: boolean, error?: string}>

#### `loadHoldingTankFromStore()`
Loads holding tank data from the store.

**Returns:** Promise<{success: boolean, data?: string, error?: string}>

### Data Management

#### `populateHoldingTank(songIds: string[])`
Populates the holding tank with an array of song IDs.

**Parameters:**
- `songIds`: Array of song IDs to add

**Returns:** Promise<{success: boolean, count: number}>

#### `addToHoldingTank(song_id: string, element: HTMLElement)`
Adds a single song to the holding tank.

**Parameters:**
- `song_id`: The song ID to add
- `element`: The target element to add the song to

**Returns:** Promise<{success: boolean, songId?: string, title?: string, error?: string}>

#### `removeFromHoldingTank()`
Removes the currently selected song from the holding tank.

**Returns:** Promise<{success: boolean, songId?: string, title?: string, error?: string}>

#### `clearHoldingTank()`
Clears all songs from the holding tank.

**Returns:** Promise<{success: boolean}>

### File Operations

#### `openHoldingTankFile()`
Opens a holding tank file for import.

**Returns:** Promise<{success: boolean, error?: string}>

#### `saveHoldingTankFile()`
Saves the current holding tank to a file.

**Returns:** Promise<{success: boolean, error?: string}>

### Mode Management

#### `setHoldingTankMode(mode: string)`
Sets the holding tank mode to either "storage" or "playlist".

**Parameters:**
- `mode`: Either "storage" or "playlist"

**Returns:** Promise<{success: boolean, error?: string}>

#### `getHoldingTankMode()`
Gets the current holding tank mode.

**Returns:** string - Either "storage" or "playlist"

#### `toggleAutoPlay()`
Legacy function for backward compatibility. Toggles between storage and playlist modes.

**Returns:** void

#### `cancel_autoplay()`
Cancels autoplay if not in the holding tank.

**Returns:** void

### UI Operations

#### `holdingTankDrop(event: DragEvent)`
Handles drag and drop events for the holding tank.

**Parameters:**
- `event`: The drag event

**Returns:** void

#### `sendToHoldingTank()`
Sends the currently selected song to the holding tank.

**Returns:** boolean

#### `renameHoldingTankTab()`
Renames the current holding tank tab.

**Returns:** Promise<{success: boolean, newName?: string, error?: string}>

## Usage Examples

### Basic Initialization

```javascript
import holdingTank from './modules/holding-tank/index.js';

// Initialize the module
holdingTank.initHoldingTank().then(result => {
  if (result.success) {
    console.log('Holding tank ready in mode:', result.mode);
  }
});
```

### Adding Songs

```javascript
// Add a single song
holdingTank.addToHoldingTank('123', document.querySelector('.holding_tank.active'))
  .then(result => {
    if (result.success) {
      console.log('Added song:', result.title);
    }
  });

// Populate with multiple songs
holdingTank.populateHoldingTank(['123', '456', '789'])
  .then(result => {
    console.log('Added', result.count, 'songs');
  });
```

### Mode Management

```javascript
// Switch to playlist mode
holdingTank.setHoldingTankMode('playlist').then(result => {
  if (result.success) {
    console.log('Switched to playlist mode');
  }
});

// Check current mode
const currentMode = holdingTank.getHoldingTankMode();
console.log('Current mode:', currentMode);
```

### File Operations

```javascript
// Save holding tank to file
holdingTank.saveHoldingTankFile().then(result => {
  if (result.success) {
    console.log('Holding tank saved to file');
  }
});

// Load holding tank from file
holdingTank.openHoldingTankFile().then(result => {
  if (result.success) {
    console.log('Holding tank loaded from file');
  }
});
```

## Event Handlers

The module integrates with the following event handlers:

### Click Events
- `.holding_tank .list-group-item` - Select songs in holding tank
- `.holding_tank .list-group-item` (double-click) - Play songs in playlist mode

### Drag and Drop Events
- `#holding_tank` (drop) - Handle dropped songs
- `#holding_tank` (dragover) - Show drop zone
- `#holding_tank` (dragleave) - Hide drop zone

Implementation notes:
- Song rows added to the holding tank are created via `document.createElement('li')` with text set via `textContent`.
- Drag behavior is bound with `addEventListener('dragstart', songDrag)` from `drag-drop/drag-drop-functions.js`. Inline attributes like `ondragstart` are not used.

### Keyboard Events
- `Shift+Tab` - Send selected song to holding tank

## Dependencies

The holding tank module depends on:

- **Store Service**: For persistent storage
- **Database Service**: For song data retrieval
- **File System Service**: For file operations
- **Path Service**: For path manipulation
- **DOM Utilities**: `Dom` from `modules/dom-utils/index.js` for selectors and class helpers
- **Custom UI Functions**: `customConfirm`, `customPrompt`

## State Management

The module maintains the following state:

- `holdingTankMode`: Current mode ("storage" or "playlist")
- `autoplay`: Whether autoplay is enabled
- `loop`: Whether loop mode is enabled

## Error Handling

All functions return consistent error objects:

```javascript
{
  success: boolean,
  error?: string,
  // Additional data depending on function
}
```

## Migration Notes

This module has been extracted from the main renderer.js file and includes:

- Modern Promise-based API
- Consistent error handling
- TypeScript-friendly return types
- Comprehensive documentation
- Backward compatibility functions

The module maintains compatibility with existing code while providing a cleaner, more maintainable interface. 