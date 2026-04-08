## Library Transfer Module

Handles UI for exporting and importing the entire Mx. Voice library. Uses Bootstrap modals for progress display and import confirmation.

### Structure
```
library-transfer/
├── index.js   # Export/import UI, progress tracking, confirmation flow
└── README.md
```

### Exports

- `initializeLibraryTransfer(options)` — Initialize with electronAPI reference
- `exportLibrary()` — Start library export with progress modal
- `importLibrary()` — Start library import with confirmation and progress

### Usage

```javascript
import { initializeLibraryTransfer, exportLibrary } from './modules/library-transfer/index.js';

initializeLibraryTransfer({ electronAPI: window.secureElectronAPI });
await exportLibrary();
```

### Notes

- Export creates a zip archive of the database and audio files
- Import validates the archive and shows a confirmation dialog before proceeding
- Progress updates are displayed in Bootstrap modals during long operations
- Communicates with `library-transfer-manager.js` in the main process via IPC
