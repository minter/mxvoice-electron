## Bulk Operations Module

Handles bulk import of songs from directories and batch processing. Provides UI handlers and helpers to scan paths, extract metadata, and persist to the database.

### Structure
```
bulk-operations/
├── bulk-operations.js     # Core operations: add/process/save
├── multi-song-import.js   # Multi-Song Import modal (2-N songs with per-song metadata)
├── event-handlers.js      # DOM event hookups for bulk UI
├── index.js               # Module entry; singleton instance with methods
└── README.md
```

## Exports and interface

- Default export: singleton instance with methods
- Methods:
  - `showBulkAddModal(directory)`
  - `showMultiSongImport(filePaths)` — Multi-Song Import modal for fine-tuning metadata per file
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

## Import Routing

The module uses an intelligent routing system for importing audio files:
- **1 file**: Individual Add Song modal (manual metadata entry)
- **2 to N files**: Multi-Song Import modal (scrollable list with per-song metadata fine-tuning)
- **> N files**: Traditional Bulk Add modal (assigns one category to all files)

The threshold N is configurable via `MULTI_SONG_THRESHOLD` in `multi-song-import.js` (default: 20).

## Features
- Directory recursion, metadata extraction, file copying
- Multi-song import with per-file metadata editing
- Category assignment and creation
- UI integration via modal and handlers
- Database-driven category name display (queries category description directly instead of relying on global state)

## Dependencies
- Electron APIs (secure adapters), database module, DOM APIs