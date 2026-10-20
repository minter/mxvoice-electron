## File Operations Module

Directory picking and update installation. (Hotkey and holding-tank files are import-only, through the Shows menu handled in the main process.)

### Structure
```
file-operations/
├── system-operations.js # pickDirectory, installUpdate
├── index.js             # Singleton with bound methods
└── README.md
```

## Exports and interface
- Default export: singleton instance
- Methods: `pickDirectory`, `installUpdate`

## Usage
```javascript
import files from './modules/file-operations/index.js';

$('#pickBtn').on('click', (e) => files.pickDirectory(e, document.querySelector('#path')));
```

## Notes
- Uses Electron secure APIs when available
- Logs via DebugLog if present