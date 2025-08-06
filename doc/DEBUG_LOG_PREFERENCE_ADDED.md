# Debug Log Preference Feature

## Overview

A new debug log preference has been added to the MxVoice application that allows users to toggle debug logging on or off. This preference is accessible through the settings modal and persists across application sessions.

## Features

### ✅ Debug Log Toggle
- **Location**: Settings modal → Debug Options section
- **Type**: Checkbox control
- **Default**: Off (false)
- **Persistence**: Saved to the same settings store as other preferences

### ✅ UI Integration
- Added to the preferences modal in a new "Debug Options" fieldset
- Checkbox with descriptive label and help text
- Properly loads and saves the preference value

### ✅ Backend Integration
- Integrated with the existing preferences system
- Uses the same store API as other preferences
- Maintains backward compatibility with legacy store access

## Files Modified

### 1. `src/renderer/modules/preferences/settings-controller.js`
**Changes:**
- Added `debug_log_enabled` to the preferences object in `savePreferences()`
- Updated Promise.all to include the new preference (5 total preferences)
- Updated success count check from 4 to 5
- Added debug log preference to `savePreferencesLegacy()`

**Key Updates:**
```javascript
const preferences = {
  // ... existing preferences ...
  debug_log_enabled: $("#preferences-debug-log-enabled").is(":checked")
};
```

### 2. `src/renderer/modules/preferences/preference-manager.js`
**Changes:**
- Added `debug_log_enabled` to the Promise.all in `loadPreferences()`
- Updated the destructuring to include the new preference
- Added checkbox setting logic: `$("#preferences-debug-log-enabled").prop("checked", debugLog.value)`
- Updated `loadPreferencesLegacy()` to handle the new preference
- Added `getDebugLogEnabled()` function for programmatic access

**Key Updates:**
```javascript
Promise.all([
  // ... existing preferences ...
  electronAPI.store.get("debug_log_enabled")
]).then(([dbDir, musicDir, hotkeyDir, fadeSeconds, debugLog]) => {
  // ... existing assignments ...
  if (debugLog.success) $("#preferences-debug-log-enabled").prop("checked", debugLog.value);
});
```

### 3. `src/index.html`
**Changes:**
- Added new "Debug Options" fieldset to the preferences modal
- Added checkbox control with ID `preferences-debug-log-enabled`
- Included descriptive label and help text

**New HTML:**
```html
<fieldset>
  <legend>Debug Options</legend>
  <div class="form-group row">
    <div class="col-sm-9 offset-sm-3">
      <div class="form-check">
        <input type="checkbox" class="form-check-input" id="preferences-debug-log-enabled">
        <label class="form-check-label" for="preferences-debug-log-enabled">
          Enable Debug Log
        </label>
      </div>
      <small class="form-text text-muted">When enabled, additional debug information will be logged to the console.</small>
    </div>
  </div>
</fieldset>
```

### 4. `src/renderer.js`
**Changes:**
- Updated the preferences modal loading logic to include debug log preference
- Added `getDebugLogEnabled` to the global window object
- Updated both new API and legacy fallback paths

**Key Updates:**
```javascript
Promise.all([
  // ... existing preferences ...
  window.electronAPI.store.get("debug_log_enabled")
]).then(([dbDir, musicDir, hotkeyDir, fadeSeconds, debugLog]) => {
  // ... existing assignments ...
  if (debugLog.success) $("#preferences-debug-log-enabled").prop("checked", debugLog.value);
});
```

### 5. `src/renderer/modules/preferences/index.js`
**Changes:**
- Added `getDebugLogEnabled` to the module interface
- Added export for the new function

## API Reference

### New Functions

#### `getDebugLogEnabled()`
Returns a Promise that resolves to a boolean indicating whether debug logging is enabled.

```javascript
// Get debug log preference
const debugEnabled = await getDebugLogEnabled();
console.log('Debug logging enabled:', debugEnabled);
```

#### `setPreference("debug_log_enabled", value)`
Sets the debug log preference to the specified boolean value.

```javascript
// Enable debug logging
await setPreference("debug_log_enabled", true);

// Disable debug logging
await setPreference("debug_log_enabled", false);
```

## Usage Examples

### Checking Debug Log Status
```javascript
// Check if debug logging is enabled
const debugEnabled = await window.getDebugLogEnabled();
if (debugEnabled) {
  console.log('🔍 Debug logging is enabled');
} else {
  console.log('🔇 Debug logging is disabled');
}
```

### Conditional Debug Logging
```javascript
// Use the preference to conditionally log debug information
async function logDebugInfo(message) {
  const debugEnabled = await window.getDebugLogEnabled();
  if (debugEnabled) {
    console.log('🐛 DEBUG:', message);
  }
}
```

### Setting Debug Log Preference
```javascript
// Enable debug logging programmatically
await window.setPreference("debug_log_enabled", true);

// Disable debug logging programmatically
await window.setPreference("debug_log_enabled", false);
```

## Testing

A comprehensive test page has been created at `test/test-debug-log-preference.html` that verifies:

- ✅ Preference can be saved and loaded
- ✅ Default value is false (off)
- ✅ Value persists across sessions
- ✅ UI checkbox reflects the stored value
- ✅ Modal integration works correctly

## Backward Compatibility

The implementation maintains full backward compatibility:

- ✅ Existing preferences continue to work unchanged
- ✅ Legacy store access is supported as fallback
- ✅ No breaking changes to existing APIs
- ✅ Gradual migration path available

## Default Behavior

- **Default Value**: `false` (debug logging disabled)
- **Storage Key**: `debug_log_enabled`
- **Data Type**: Boolean
- **Persistence**: Same as other preferences

## Future Enhancements

Potential future improvements:

1. **Log Level Control**: Add different debug log levels (info, warn, error)
2. **Log File Output**: Option to write debug logs to a file
3. **Log Rotation**: Automatic log file rotation
4. **Debug Categories**: Enable/disable specific debug categories
5. **Real-time Toggle**: Ability to toggle debug logging without restart

## Implementation Notes

- The preference uses the same store API as other preferences
- Proper error handling and fallbacks are implemented
- The UI follows the existing design patterns
- The implementation is consistent with the modular architecture 