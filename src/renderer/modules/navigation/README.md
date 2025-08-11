# Navigation Module

Navigation helpers and key-driven actions for selection and sending songs to targets.

### Structure
```
navigation/
├── navigation-functions.js
├── event-handlers.js
├── index.js              # Singleton; `init()` wires handlers
└── README.md
```

## Exports and interface
- Default export: singleton instance
- Methods: `sendToHotkeys`, `sendToHoldingTank`, `selectNext`, `selectPrev`, `init()`

## Usage
```javascript
import navigation from './modules/navigation/index.js';

navigation.init();
navigation.sendToHotkeys();
navigation.selectNext();
```

## Notes
- Event handlers are attached via `setupNavigationEventHandlers()` during `init()`
- Integrates with hotkeys and holding-tank modules