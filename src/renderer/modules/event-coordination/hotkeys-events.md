# Hotkeys Events Module

## Overview

The Hotkeys Events Module handles all hotkey-related event handlers in the EventCoordination system. It provides centralized event handling for hotkey functionality while maintaining separation of concerns from the core HotkeysModule.

## Key Features

### 🎵 Playback Events
- **Double-click to play**: Attaches double-click handlers to hotkey elements
- **Song ID validation**: Ensures valid song IDs before attempting playback
- **Selection clearing**: Clears existing selections when playing from hotkeys

### 🎯 Drag & Drop Events
- **Visual feedback**: Adds/removes drop_target class for visual indication
- **Data validation**: Validates dropped data before processing
- **Module integration**: Delegates to HotkeysModule for actual drop processing

### 🏷️ Tab Management Events
- **Tab renaming**: Double-click on tab headers to rename
- **Module delegation**: Uses HotkeysModule's rename functionality

## Architecture

### Event Handler Storage
- Uses a Map to store all event handlers for proper cleanup
- Each handler includes element, event type, and handler function
- Enables proper detachment during cleanup/testing

### Module Integration
- Integrates with the moduleRegistry to access HotkeysModule functionality
- Maintains separation between event handling and business logic
- Provides fallback logging when module functions aren't available

## Usage

### Initialization
```javascript
const hotkeysEvents = new HotkeysEvents({
  electronAPI: window.electronAPI,
  db: window.db,
  store: window.store,
  debugLog: window.debugLog,
  moduleRegistry: window.moduleRegistry
});

await hotkeysEvents.attachHotkeysEvents();
```

### Cleanup
```javascript
hotkeysEvents.detachEvents();
```

### Status Check
```javascript
const status = hotkeysEvents.getStatus();
// Returns: { eventsAttached, handlerCount, hasModuleRegistry, hasHotkeysModule }
```

## Event Flow

1. **Module Initialization**: HotkeysEvents is created during EventCoordination init
2. **Event Attachment**: attachHotkeysEvents() is called during EventCoordination.attachEventHandlers()
3. **Handler Registration**: Event listeners are attached to DOM elements
4. **Event Processing**: Events are handled and delegated to appropriate modules
5. **Cleanup**: detachEvents() removes all handlers during cleanup

## Dependencies

- **HotkeysModule**: For business logic (drop processing, tab renaming)
- **DebugLog**: For logging and debugging
- **ModuleRegistry**: For accessing other modules
- **DOM Elements**: .hotkeys container and hotkey list items

## Notes

- **Separation of Concerns**: Event handling is separate from business logic
- **Backward Compatibility**: Works with existing HotkeysModule functionality
- **Error Handling**: Graceful fallbacks when dependencies aren't available
- **Testing Support**: Proper cleanup methods for test isolation
