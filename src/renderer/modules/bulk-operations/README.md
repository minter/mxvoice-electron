## Bulk Operations Module

Handles bulk import of songs from directories and batch processing. Provides UI handlers and helpers to scan paths, extract metadata, and persist to the database.

### Structure
```
bulk-operations/
├── bulk-operations.js   # Core operations: add/process/save
├── event-handlers.js    # DOM event hookups for bulk UI
├── index.js             # Module entry; singleton instance with methods
└── README.md
```

## Exports and interface

- Default export: singleton instance with methods
- Methods:
  - `showBulkAddModal(directory)`
  - `addSongsByPath(pathArray, category)`
  - `saveBulkUpload(event)`
  - `init()` (alias of internal `initializeBulkOperations()`)

Event handlers are wired internally via `init()` using `setupBulkEventHandlers()`.

## Usage

```javascript
import bulk from './modules/bulk-operations/index.js';

// Initialize (attaches event handlers)
bulk.init();

// Show modal
bulk.showBulkAddModal('/path/to/directory');

// Process paths
bulk.addSongsByPath(['/path/a.mp3', '/path/b.mp3'], 'ROCK');

// Submit handler (vanilla)
document.querySelector('#bulk_upload_form')
  ?.addEventListener('submit', (e) => bulk.saveBulkUpload(e));
```

## Features
- Directory recursion, metadata extraction, file copying
- Category assignment and creation
- UI integration via modal and handlers

## Dependencies
- Electron APIs (secure adapters), database module, DOM APIs