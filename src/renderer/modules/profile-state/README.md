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
- **Race condition protection:** Profile name is explicitly passed to save handlers to prevent state being saved to wrong profile directory
- **Restoration lock:** Prevents saves during state restoration to avoid race conditions and data corruption
- **🔒 Critical Data Protection:** Multi-layered safeguards prevent empty states from overwriting valid user data

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

### Clear Restoration Lock

```javascript
import { clearProfileRestorationLock } from './modules/profile-state/index.js';

// Clear the restoration lock after full app initialization
// This MUST be called after all initialization is complete (including song table population)
clearProfileRestorationLock();
```

**Note:** This function is automatically called by the app bootstrap after initialization completes. Manual calls are only needed in special circumstances.

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

## Restoration Lock (Extended)

A global flag `window.isRestoringProfileState` protects against saves during the **entire app initialization period**:

1. **Set at start of load:** `loadProfileState()` sets `window.isRestoringProfileState = true`
2. **Kept during full init:** Lock remains active through:
   - Hotkey/holding tank restoration
   - Song table population
   - Module initialization
   - Event registration
3. **Cleared after complete init:** `clearProfileRestorationLock()` called after app is fully ready
4. **Checked by all save functions:** `saveProfileState()`, `switchProfileWithSave()`, and `beforeunload` handler all check this flag

This prevents the critical race condition where:
- Profile loads with valid state (4 hotkeys, 1 holding tank song)
- DOM is being populated from database
- A save is triggered before song table has rows
- Empty state gets extracted and saved
- User's carefully-built configuration is lost forever

**Key Insight:** By extending the lock to cover the entire initialization, we ensure NO saves can happen during the vulnerable window.

## 🔒 Critical Data Protection (v4.1.1)

**Problem:** Empty states were sometimes saved during profile switches, overwriting valid user data due to a race condition where state was extracted before app initialization (including song table population) was complete.

**Root Cause:** Profile loads → State restoration begins → `isRestoringProfileState` cleared too early → Song table not yet populated → Save triggered → Empty state extracted → Valid data overwritten.

**Simple, Robust Solution:**

### Extended Restoration Lock (PRIMARY PROTECTION)

**The Core Fix:** Extend `window.isRestoringProfileState` to cover the **entire app initialization period**, not just hotkey/holding tank restoration.

**How It Works:**
1. **Lock Set:** `window.isRestoringProfileState = true` when `loadProfileState()` starts
2. **Hotkeys/Holding Tank Restored:** Profile state restored to DOM
3. **Lock Stays Active:** Lock is NOT cleared yet (this is the fix!)
4. **App Initialization Continues:** Song table populated, modules initialized, events registered
5. **Lock Cleared:** `clearProfileRestorationLock()` called after full app initialization
6. **Saves Allowed:** All save operations now proceed normally

**Why This Works:**
- ANY save attempt during the entire initialization window is blocked
- No complex conditions or timing windows needed
- Simple, predictable, and easy to understand
- Covers ALL race condition scenarios

**Code Flow:**
```javascript
// Start of profile load
window.isRestoringProfileState = true; 

// ... restore hotkeys and holding tank ...
// ... continue app initialization ...
// ... populate song table ...
// ... initialize all modules ...

// End of app initialization
clearProfileRestorationLock(); // Now saves are allowed
```

### Layer 2: Save Function Protection
All save functions check the restoration lock:
- `saveProfileState()` - Checks lock, returns early if active
- `switchProfileWithSave()` - Checks lock, skips save if active  
- `beforeunload` handler - Checks lock, returns early if active

### Layer 3: Automatic Backup
- **Before every overwrite:** Creates `state.json.backup`
- **Last known good state:** Manual recovery possible if needed
- **Both processes:** Backup in renderer and main process

### Layer 4: Main Process Logging
- **Monitors operations:** Logs warnings when empty states save over data
- **Audit trail:** Creates log history for debugging
- **Not blocking:** Trusts renderer-side restoration lock

### Example Log Output (Save Blocked During Init)

```
[WARN] Refusing to save - restoration in progress
{
  "module": "profile-state",
  "function": "saveProfileState",
  "reason": "restoration_lock_active"
}
```

### Example Log Output (Init Complete, Lock Cleared)

```
[INFO] Restoration lock cleared - app initialization complete
{
  "module": "profile-state",
  "function": "clearProfileRestorationLock"
}
```

**Result:** 
- ✅ **NO saves during profile load** - The only unacceptable scenario is now impossible
- ✅ **Legitimate user actions work** - After init completes, users can clear and save empty states
- ✅ **New empty profiles work** - Lock only active during load, not during normal use
- ✅ **Simple and reliable** - One clear protection mechanism, no complex conditions

## Race Condition Fix (v4.1.0)

**Problem Fixed:** Profile state was sometimes saved to the wrong profile directory during profile switching due to a race condition between the renderer extracting state and the main process determining which profile to save to.

**Solution:** Modified save handlers to explicitly accept the profile name as a parameter instead of relying on the global `currentProfile` variable:

```javascript
// Before (race condition prone)
window.secureElectronAPI.profile.saveState(state);

// After (race condition protected)
window.secureElectronAPI.profile.saveState(state, currentProfileName);
```

This ensures that state is always saved to the correct profile directory, preventing data loss during profile switching.

## Export Interface

```javascript
// Initialize module (sets up auto-save)
export function initializeProfileState(options): Object
  // options: { hotkeysModule, holdingTankModule }

// Extract current state without saving
export function extractProfileState(): Object

// Save state to file (takes NO parameters, extracts from DOM)
export function saveProfileState(): Promise<{success: boolean, error?: string}>

// Load state from file
export function loadProfileState(options): Promise<{success: boolean, loaded: boolean, error?: string}>
  // options: { hotkeysModule, holdingTankModule }

// Clear restoration lock after full app initialization (IMPORTANT!)
export function clearProfileRestorationLock(): void
  // Call this ONLY after complete app initialization including song table population

// Switch profiles with explicit state save
export function switchProfileWithSave(): Promise<{success: boolean, error?: string}>
```

## Dependencies

- `window.secureElectronAPI.profile.getDirectory()` - Get profile-specific paths
- `window.secureElectronAPI.fileSystem` - File operations
- `window.secureElectronAPI.database` - Song validation
- `hotkeysModule` - Hotkey restoration
- `holdingTankModule` - Holding tank restoration

