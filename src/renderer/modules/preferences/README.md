# Preferences Module

The Preferences module provides all preferences and settings functionality for the MxVoice application. It includes preference management, settings UI, and configuration persistence.

## Module Structure

```
preferences/
├── index.js              # Main module entry point
├── preference-manager.js # Preference UI management
├── settings-controller.js # Settings saving and management
└── README.md            # This documentation
```

## Features

### Preference Manager (`preference-manager.js`)
- **openPreferencesModal()** - Open the preferences modal dialog
- **loadPreferences()** - Load preferences into the UI
- **getDatabaseDirectory()** - Get database directory preference
- **getMusicDirectory()** - Get music directory preference
- **getHotkeyDirectory()** - Get hotkey directory preference
- **getFadeOutSeconds()** - Get fade out duration preference

### Settings Controller (`settings-controller.js`)
- **savePreferences(event)** - Save preferences from the modal
- **getPreference(key)** - Get a specific preference value
- **setPreference(key, value)** - Set a specific preference value

## Usage

### Initialization

```javascript
import preferencesModule from './modules/preferences/index.js';

// Initialize with dependencies
const preferences = preferencesModule.initialize({
  electronAPI: window.electronAPI,
  db: database,
  store: store
});

// Use preference functions
preferences.openPreferencesModal();
preferences.savePreferences(event);
```

### Backward Compatibility

The module maintains backward compatibility with the existing `renderer.js` functions:

```javascript
// Legacy function calls still work
openPreferencesModal();
savePreferences(event);
```

## API Reference

### Preference Manager Functions

#### `openPreferencesModal()`
Opens the preferences modal dialog for user configuration.

#### `loadPreferences()`
Loads all stored preferences and populates the preferences modal UI.

#### `getDatabaseDirectory()`
Gets the database directory preference.

**Returns:** `Promise<string>` - Database directory path

#### `getMusicDirectory()`
Gets the music directory preference.

**Returns:** `Promise<string>` - Music directory path

#### `getHotkeyDirectory()`
Gets the hotkey directory preference.

**Returns:** `Promise<string>` - Hotkey directory path

#### `getFadeOutSeconds()`
Gets the fade out duration preference.

**Returns:** `Promise<number>` - Fade out duration in seconds

### Settings Controller Functions

#### `savePreferences(event)`
Saves preferences from the preferences modal form.

**Parameters:**
- `event` (Event) - The form submission event

#### `getPreference(key)`
Gets a specific preference value.

**Parameters:**
- `key` (string) - Preference key

**Returns:** `Promise<any>` - Preference value

#### `setPreference(key, value)`
Sets a specific preference value.

**Parameters:**
- `key` (string) - Preference key
- `value` (any) - Preference value

**Returns:** `Promise<boolean>` - Success status

## Preference Keys

The module manages the following preference keys:

- `database_directory` - Path to the database directory
- `music_directory` - Path to the music files directory
- `hotkey_directory` - Path to the hotkey files directory
- `fade_out_seconds` - Audio fade out duration in seconds

## Error Handling

The module includes comprehensive error handling:

- **API Fallbacks** - Falls back to legacy store access when new API is unavailable
- **Promise Handling** - Proper promise rejection handling
- **Logging** - Detailed console logging for debugging
- **Graceful Degradation** - Continues working even when some features fail

## Migration from renderer.js

### Functions Extracted

**Preference Manager:**
- `openPreferencesModal()` → `openPreferencesModal()`
- `loadPreferences()` → `loadPreferences()` (new function)

**Settings Controller:**
- `savePreferences(event)` → `savePreferences(event)`

### New Functions Added

- `getPreference(key)` - Get specific preference
- `setPreference(key, value)` - Set specific preference
- `getDatabaseDirectory()` - Get database directory
- `getMusicDirectory()` - Get music directory
- `getHotkeyDirectory()` - Get hotkey directory
- `getFadeOutSeconds()` - Get fade out duration

## Testing

The module includes comprehensive testing capabilities:

```javascript
// Test preferences module functionality
window.testPreferencesModule = function() {
  console.log('🧪 Testing Preferences Module...');
  
  if (window.preferencesModule) {
    console.log('✅ Preferences Module is available');
    // Test all functions...
  }
};
```

## Dependencies

- **electronAPI** - For modern store access
- **store** - For legacy store access
- **jQuery** - For DOM manipulation
- **Bootstrap** - For modal functionality

## Version History

### v1.0.0
- Initial module extraction
- Complete preference management functionality
- Backward compatibility maintained
- Comprehensive error handling
- Full documentation

## Contributing

When contributing to the Preferences module:

1. **Maintain Backward Compatibility** - Ensure legacy function calls still work
2. **Add Error Handling** - Include fallbacks for all operations
3. **Update Documentation** - Keep README.md current
4. **Test Thoroughly** - Verify all functions work in both new and legacy modes 