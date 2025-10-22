## Event Coordination Module

Coordinates DOM event handler modules and ensures correct initialization order.

### Structure
```
event-coordination/
├── index.js                # Coordinator class
├── search-events.js
├── audio-control-events.js
├── ui-interaction-events.js
├── hotkeys-events.js       # Hotkey event handling
├── dom-initialization.js
├── event-delegator.js
└── README.md
```

## Exports and interface
- Default export: `EventCoordination` class
- Named: `{ EventCoordination, initializeEventCoordination }`

Key methods:
- `initialize()` – builds submodules with `{ electronAPI, debugLog, moduleRegistry }`
- `attachEventHandlers()` – initializes DOM, sets up delegation, attaches handlers
- `detachEventHandlers()` – cleanup
- `getStatus()` – diagnostics

## Event Handler Modules

The system includes several specialized event handler modules:
- **SearchEvents**: Search functionality and form handling
- **AudioControlEvents**: Playback controls and audio management
- **UIInteractionEvents**: Modals, tabs, and general UI interactions
- **HotkeysEvents**: Hotkey playback, drag & drop, and tab management

## Usage
```javascript
import EventCoordination from './modules/event-coordination/index.js';

const events = new EventCoordination({
  electronAPI: window.electronAPI,
  debugLog: window.debugLog,
  moduleRegistry: window.moduleRegistry
});

await events.initialize();
await events.attachEventHandlers();
```

## Notes
- Ensures DOM structure init precedes handler attachment
- Integrates with module/function registries and DebugLog

## Security
- **UIInteractionEvents** sanitizes auto-update release notes using DOMPurify
- Release notes from GitHub are HTML-sanitized to prevent XSS attacks
- Only safe HTML tags (headings, paragraphs, lists, links) are allowed in release notes
