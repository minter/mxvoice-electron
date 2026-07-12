## Database Module

Unified interface for database-backed UI operations and CRUD.

### Structure
```
database/
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

- UI ops: `scaleScrollable`
- CRUD: categories, songs, bulk, query/statement execution

## Notes
- Logs through DebugLog if available
- Uses the context-isolated secure database API.
- Hotkey and holding-tank rendering is owned by their respective modules.
