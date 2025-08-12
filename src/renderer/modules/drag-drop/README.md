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

// Programmatic usage (vanilla):
document.querySelector('#some-row')
  ?.addEventListener('dragstart', (e) => dragDrop.songDrag(e));
```

## Features
- Visual feedback and data transfer for song drags
- Column reorder via drag handlers
- Event handler wiring via `setupDragDropEventHandlers()`

## Security and DOM Guidance
- Consumers should attach drag listeners using `addEventListener('dragstart', songDrag)` and avoid inline attributes like `ondragstart`.
- When rendering draggable rows/spans, set user-provided values with `textContent` and never via `innerHTML`.

## Dependencies
- DOM APIs and project `Dom` utilities; integrates with hotkeys/holding-tank modules for drop behavior