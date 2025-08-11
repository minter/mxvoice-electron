## Database Module

Unified interface for UI data population, store persistence, and DB CRUD.

### Structure
```
database/
├── data-population.js
├── store-operations.js
├── ui-operations.js
├── database-operations.js
├── index.js               # Singleton with bound methods
└── README.md
```

## Exports and interface

- Default export: singleton instance
- Named exports: direct function bindings (e.g., `populateCategorySelect`, `saveNewSong`, `executeQuery`)
- Lifecycle: `init()` sets up listeners; diagnostics via `test()` and `getInfo()`

## Usage

```javascript
import db from './modules/database/index.js';

db.init();
await db.populateCategorySelect();
const song = await db.getSongById('123');
```

## Function groups
- Data population: category select, hotkeys, holding tank, labels, modals
- Store operations: `saveHoldingTankToStore`, `saveHotkeysToStore`
- UI ops: `scaleScrollable`
- CRUD: categories, songs, bulk, query/statement execution

## Notes
- Logs through DebugLog if available
- Uses Electron secure APIs where available, with legacy fallbacks
- UI-facing helpers (e.g., hotkey/holding tank population) create DOM nodes programmatically and set text via `textContent` to avoid XSS. Drag events are wired using `addEventListener` rather than inline attributes.