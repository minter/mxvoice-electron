## Event Coordination Module

Coordinates DOM event handler modules and ensures correct initialization order.

### Structure
```
event-coordination/
├── index.js                # Coordinator class
├── search-events.js
├── audio-control-events.js
├── ui-interaction-events.js
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
