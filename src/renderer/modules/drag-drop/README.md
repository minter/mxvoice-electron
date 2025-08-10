# Drag & Drop Module

Handles drag operations for songs and columns and wires up DOM event handlers. Hotkey- and holding-tank-specific drop logic lives in their respective modules.

### Structure
```
drag-drop/
├── drag-drop-functions.js  # songDrag, columnDrag
├── event-handlers.js       # setup handlers
├── index.js                # Singleton with methods; init attaches handlers
└── README.md
```

## Exports and interface

- Default export: singleton instance
- Methods:
  - `songDrag(event)`
  - `columnDrag(event)`
  - `init()` (alias of `initializeDragDrop()`)

Note: `hotkeyDrop`, `allowHotkeyDrop`, and `holdingTankDrop` are implemented in their own modules and not exported here.

## Usage
```javascript
import dragDrop from './modules/drag-drop/index.js';

// Initialize (attaches event handlers)
dragDrop.init();

// Programmatic usage
$('#some-row').on('dragstart', (e) => dragDrop.songDrag(e.originalEvent));
```

## Features
- Visual feedback and data transfer for song drags
- Column reorder via drag handlers
- Event handler wiring via `setupDragDropEventHandlers()`

## Dependencies
- jQuery, animation utils; integrates with hotkeys/holding-tank modules for drop behavior