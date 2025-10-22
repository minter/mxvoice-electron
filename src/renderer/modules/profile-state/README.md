# Profile State Persistence Module

Automatically saves and restores profile-specific UI state without user interaction.

## Purpose

Preserves user's working state across app restarts and profile switches:
- All hotkey tabs (song IDs + custom tab names)
- All holding tank tabs (song IDs + custom tab names)

State is saved to `profiles/<ProfileName>/state.json` and automatically loaded on profile start.

## Features

- **Auto-save on:** Window close, app quit (via beforeunload), **and explicitly before profile switch**
- **Auto-load on:** Profile start (during app initialization)
- **Data validation:** Skips songs that have been deleted from database
- **Tab preservation:** Maintains custom tab names and song order
- **Explicit save before switch:** State is saved synchronously before profile switching to ensure no data loss
- **Restoration lock:** Prevents saves during state restoration to avoid race conditions and data corruption

## Usage

### Initialization

```javascript
import { initializeProfileState } from './modules/profile-state/index.js';

// Initialize during app bootstrap (pass module references for auto-save)
initializeProfileState({
  hotkeysModule: window.hotkeysModule,
  holdingTankModule: window.holdingTank
});
```

### Manual Save

```javascript
import { saveProfileState } from './modules/profile-state/index.js';

// Manually save current state (extracts from DOM, takes no parameters)
await saveProfileState();
```

**Note:** `saveProfileState()` takes NO parameters. It always extracts state from the current DOM.

### Manual Load

```javascript
import { loadProfileState } from './modules/profile-state/index.js';

// Load state with module instances for restoration
await loadProfileState({
  hotkeysModule: window.hotkeysModule,
  holdingTankModule: window.holdingTank
});
```

### Switch Profile with Save

```javascript
import { switchProfileWithSave } from './modules/profile-state/index.js';

// Switch profiles after explicitly saving current state
// This is automatically called when user selects "Switch Profile..." from menu
await switchProfileWithSave();
```

**Note:** Profile switching now explicitly saves state *before* initiating the switch, ensuring no data loss even if the window closes immediately.

## State Format

```json
{
  "version": "1.0.0",
  "timestamp": 1234567890,
  "hotkeys": [
    {
      "tabNumber": 1,
      "tabName": "Rock Songs",
      "hotkeys": {
        "f1": "song-id-1",
        "f2": "song-id-2"
      }
    }
  ],
  "holdingTank": [
    {
      "tabNumber": 1,
      "tabName": "Tonight's Set",
      "songIds": ["song-id-1", "song-id-2", "song-id-3"]
    }
  ]
}
```

## Integration Points

### App Bootstrap
Module is initialized during app bootstrap after hotkeys and holding tank modules are ready.

### App Initialization
State is loaded after database is ready but before UI is shown.

### Window Close
`beforeunload` event triggers automatic state save.

### Profile Switch
IPC handler saves state before closing app.

## Data Validation

When loading state:
- Each song ID is validated against the database
- Deleted songs are skipped (not restored)
- Invalid data is logged but doesn't break initialization
- Missing state file is treated as fresh start

## Differences from Manual Save/Load

| Feature | Auto-State | Manual Files (.mrv/.hld) |
|---------|-----------|-------------------------|
| User interaction | None (automatic) | User initiates |
| Scope | All tabs | Single tab |
| Persistence | Profile directory | User-chosen location |
| Format | JSON | Plain text array |
| Purpose | Preserve session | Export/import/backup |

## File Location

State files are stored per-profile:
```
userData/
└── profiles/
    ├── Default User/
    │   └── state.json
    └── Bob/
        └── state.json
```

## Restoration Lock

During profile state restoration, a global flag `window.isRestoringProfileState` is set to prevent saves:

1. **Set at start of restoration:** `loadProfileState()` sets `window.isRestoringProfileState = true`
2. **Checked by save functions:** Both `saveHotkeysToStore()` and `saveHoldingTankToStore()` check this flag and skip saves if true
3. **Cleared after restoration:** Flag is cleared when restoration completes or on error

This prevents race conditions where:
- DOM is being rebuilt from saved state
- Each DOM update would trigger a save
- Saves extract from partially-rebuilt DOM
- Good state.json gets overwritten with incomplete data

## Export Interface

```javascript
// Initialize module (sets up auto-save)
export function initializeProfileState(options): Object
  // options: { hotkeysModule, holdingTankModule }

// Extract current state without saving
export function extractProfileState(): Object

// Save state to file (takes NO parameters, extracts from DOM)
export function saveProfileState(): Promise<{success: boolean, error?: string}>
  // options: { hotkeysModule, holdingTankModule }

// Load state from file
export function loadProfileState(options): Promise<{success: boolean, loaded: boolean, error?: string}>
  // options: { hotkeysModule, holdingTankModule }
```

## Dependencies

- `window.secureElectronAPI.profile.getDirectory()` - Get profile-specific paths
- `window.secureElectronAPI.fileSystem` - File operations
- `window.secureElectronAPI.database` - Song validation
- `hotkeysModule` - Hotkey restoration
- `holdingTankModule` - Holding tank restoration

