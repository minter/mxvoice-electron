# Profile Launcher Architecture (V2)

## Overview

The new profile system uses a **launcher-first** architecture where profiles are selected before the main app launches, rather than being switched during runtime.

## Architecture

```
┌─────────────────────────────┐
│   Profile Launcher Window   │  ← Shows on app start (no --profile arg)
│  - List available profiles   │
│  - Create new profiles       │
│  - Delete profiles           │
│  - Launch with selection     │
└─────────────────────────────┘
              ↓
    User selects "Bob"
              ↓
┌─────────────────────────────┐
│   Main App (Bob's Context)  │  ← Launched with --profile="Bob"
│  - Single profile context    │
│  - Profile indicator (UI)    │
│  - Switch Profile menu       │  ← Closes app, reopens launcher
└─────────────────────────────┘
```

## Key Benefits

1. **Clean Separation** - Main app doesn't know about other profiles
2. **No State Complexity** - Each launch is independent
3. **Simpler Code** - No profile switching logic in main app
4. **Better Reliability** - No state transitions to manage
5. **Standard Pattern** - Same approach used by VS Code, Discord, Slack

## Files Created

### Main Process
- `src/main/modules/profile-manager.js` - Profile CRUD operations
- `src/main/modules/launcher-window.js` - Launcher window management
- `src/main/index-modular.js` - Modified to handle launcher vs. main app flow

### Renderer (Launcher)
- `src/launcher.html` - Launcher window HTML
- `src/launcher.js` - Launcher window renderer script
- `src/preload/launcher-preload.js` - Launcher preload script

### Renderer (Main App)
- Profile indicator added to `src/index.html`
- Profile indicator styling in `src/stylesheets/index.css`
- Profile loading in `src/renderer.js`
- "Switch Profile" menu in `src/main/modules/app-setup.js`

### IPC & Preload
- Profile IPC handlers in `src/main/modules/ipc-handlers.js`
- Profile API in `src/preload/modules/secure-api-exposer.js`

## How It Works

### On App Launch

1. **No `--profile` arg**: Show launcher window
   - List all available profiles
   - User selects or creates profile
   - Launch main app with `--profile="ProfileName"` argument
   - Close launcher window

2. **With `--profile="ProfileName"` arg**: Launch main app directly
   - Set `currentProfile` to provided name
   - Main app runs in single-profile context
   - Profile indicator shows current profile

### Profile Data Storage

```
userData/
├── profiles.json           # Profile registry
└── profiles/
    ├── Default User/
    │   ├── preferences.json
    │   ├── hotkeys/
    │   └── holding-tank/
    └── Bob/
        ├── preferences.json
        ├── hotkeys/
        └── holding-tank/
```

### Switching Profiles

1. User clicks "View → Switch Profile..." menu
2. Main app closes
3. App relaunches **without** `--profile` argument
4. Launcher window shows again
5. User selects different profile
6. Main app launches with new profile context

## Profile Manager API

### Main Process

```javascript
import * as profileManager from './modules/profile-manager.js';

// Initialize
profileManager.initializeProfileManager({ debugLog });

// Operations
const profiles = profileManager.getAvailableProfiles();
const result = profileManager.createProfile(name, description);
const result = profileManager.deleteProfile(name);
const prefs = profileManager.loadProfilePreferences(name);
profileManager.saveProfilePreferences(name, prefs);
```

### Renderer Process

```javascript
// Get current profile
const result = await window.secureElectronAPI.profile.getCurrent();
console.log(result.profile); // "Bob"

// Get profile directory
const result = await window.secureElectronAPI.profile.getDirectory('hotkeys');
console.log(result.directory); // "/path/to/profiles/Bob/hotkeys"

// Switch profiles (closes and relaunches)
await window.secureElectronAPI.profile.switchProfile();
```

## Migration from V1

The old profile system tried to handle multiple profiles within a running app, leading to:
- Complex state management
- Profile switching logic throughout codebase
- Race conditions in data loading
- Difficult-to-track "active profile" state

The new system eliminates all of this by treating the app as single-profile from start to finish.

## Testing

To test the profile launcher:

```bash
# Start normally - should show launcher
yarn start

# Start with specific profile - skips launcher
electron . --profile="Bob"
```

## Next Steps

Future enhancements could include:
1. Profile import/export
2. Profile templates
3. Profile-specific themes
4. Recent profiles list in launcher
5. Last-used profile auto-selection option

