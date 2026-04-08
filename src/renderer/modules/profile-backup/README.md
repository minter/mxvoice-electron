## Profile Backup Module

Handles backup restore dialogs and backup settings UI for profile backups.

### Structure
```
profile-backup/
├── index.js   # Backup restore dialog, settings management, menu handlers
└── README.md
```

### Exports

- `initializeProfileBackup(options)` — Initialize with electronAPI reference and set up menu handlers
- `openBackupRestoreDialog()` — Open the backup restore selection dialog
- `openBackupSettings()` — Open the backup settings modal
- `createManualBackup()` — Trigger a manual backup of the current profile

### Usage

```javascript
import { initializeProfileBackup, openBackupRestoreDialog } from './modules/profile-backup/index.js';

initializeProfileBackup({ electronAPI: window.secureElectronAPI });
await openBackupRestoreDialog();
```

### Notes

- Integrates with the application menu for backup-related actions
- Uses `profile-backup-manager.js` in the main process via IPC for actual backup operations
- Includes a lock to prevent duplicate backup creation
