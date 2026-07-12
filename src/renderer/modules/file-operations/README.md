## File Operations Module

File import/export for hotkeys and holding tank, directory picking, and update installation.

### Structure
```
file-operations/
├── file-operations.js   # open/save hotkey/holding tank
├── system-operations.js # pickDirectory, installUpdate
├── index.js             # Singleton with bound methods
└── README.md
```

## Exports and interface
- Default export: singleton instance
- Methods: `openHotkeyFile`, `openHoldingTankFile`, `saveHotkeyFile`, `saveHoldingTankFile`, `pickDirectory`, `installUpdate`

## Usage
```javascript
import files from './modules/file-operations/index.js';

files.openHotkeyFile();
files.saveHoldingTankFile();
$('#pickBtn').on('click', (e) => files.pickDirectory(e, document.querySelector('#path')));
```

## Notes
- Uses Electron secure APIs when available
- Logs via DebugLog if present