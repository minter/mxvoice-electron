# Preferences Module

The preferences module loads and saves application settings through `window.secureElectronAPI`.

### Storage routing

- Global store: `database_directory`, `music_directory`, `hotkey_directory`, `debug_log_enabled`.
- Profile preferences: theme, font and column settings, fade/crossfade, prerelease updates, holding-tank mode, and window state.

`profile-preference-adapter.js` owns this routing. Unknown keys are rejected, and profile preferences never fall back to global storage.

### Components

- `index.js` initializes and combines the module.
- `preference-manager.js` loads values into the modal and exposes typed convenience getters.
- `settings-controller.js` captures and saves form values, preserves existing directory values when fields are blank, applies theme changes, updates the audio directory cache, and records analytics consent.
- `profile-preference-adapter.js` routes reads and writes to the correct secure API namespace.

Bootstrap initializes the module with `{ electronAPI, moduleRegistry }`. Profile settings are saved atomically with `profile.setPreferences`; global settings may be saved in parallel.
