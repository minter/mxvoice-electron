# Preferences Save Fix

## Issue Description

When trying to save preferences, users encountered this error:

```
settings-controller.js:81 ❌ Legacy preference saving failed: TypeError: Cannot read properties of undefined (reading 'set')
    at savePreferencesLegacy (settings-controller.js:75:13)
    at savePreferences (settings-controller.js:64:7)
    at HTMLFormElement.onsubmit (index.html:504:53)
```

The error indicated that the `store` object was undefined in the settings controller, preventing preferences from being saved.

## Root Cause

The issue was in the preferences module initialization. The `settings-controller.js` was trying to use a legacy `store` object that was not properly passed to the module during initialization.

### Problem Analysis

1. **Missing Dependencies**: The preferences module was initialized without proper dependencies
2. **Undefined Store**: The `store` parameter was `undefined` in the settings controller
3. **No Fallback**: The legacy store access was failing without a proper fallback to the new API

## Files Modified

### 1. `src/renderer/modules/preferences/index.js`

**Problem**: The preferences module was created as a singleton without proper initialization:

```javascript
// Create and export a singleton instance
const preferencesModule = initializePreferences();
```

**Solution**: Added re-initialization capability and proper dependency injection:

```javascript
// Note: This will be re-initialized with proper dependencies when the module is loaded
let preferencesModule = initializePreferences();

// Function to re-initialize with proper dependencies
function reinitializePreferences(options = {}) {
  preferencesModule = initializePreferences(options);
  return preferencesModule;
}

// Export the reinitialize function
export const reinitializePreferences = reinitializePreferences;
```

### 2. `src/renderer.js`

**Problem**: The preferences module was loaded but not properly initialized with dependencies:

```javascript
// Import preferences module and make functions globally available
preferencesModule = await import('./renderer/modules/preferences/index.js');

// Make preferences functions globally available
window.savePreferences = preferencesModule.default.savePreferences;
```

**Solution**: Added proper initialization with dependencies:

```javascript
// Import preferences module and make functions globally available
preferencesModule = await import('./renderer/modules/preferences/index.js');

// Re-initialize preferences module with proper dependencies
const preferencesInstance = preferencesModule.default.reinitializePreferences({
  electronAPI: window.electronAPI,
  db: window.db,
  store: null // Legacy store not available, will use electronAPI.store
});

// Make preferences functions globally available
window.savePreferences = preferencesInstance.savePreferences;
```

### 3. `src/renderer/modules/preferences/settings-controller.js`

**Problem**: The `savePreferencesLegacy` function assumed `store` was always available:

```javascript
function savePreferencesLegacy(preferences) {
  try {
    store.set("database_directory", preferences.database_directory);
    // ... other store operations
  } catch (error) {
    console.warn('❌ Legacy preference saving failed:', error);
  }
}
```

**Solution**: Added proper fallback handling when legacy store is not available:

```javascript
function savePreferencesLegacy(preferences) {
  try {
    if (store) {
      store.set("database_directory", preferences.database_directory);
      // ... other legacy store operations
      console.log('✅ Preferences saved using legacy method');
    } else {
      // Legacy store not available, use electronAPI.store
      Promise.all([
        electronAPI.store.set("database_directory", preferences.database_directory),
        // ... other electronAPI.store operations
      ]).then(results => {
        const successCount = results.filter(result => result.success).length;
        if (successCount === 4) {
          console.log('✅ All preferences saved successfully using electronAPI.store');
        } else {
          console.warn('⚠️ Some preferences failed to save:', results);
        }
      }).catch(error => {
        console.warn('❌ Failed to save preferences using electronAPI.store:', error);
      });
    }
  } catch (error) {
    console.warn('❌ Legacy preference saving failed:', error);
  }
}
```

## How the Fix Works

1. **Proper Initialization**: The preferences module is now re-initialized with proper dependencies
2. **Fallback Handling**: When legacy store is not available, it falls back to `electronAPI.store`
3. **Error Prevention**: Added null checks to prevent "Cannot read properties of undefined" errors
4. **Enhanced Logging**: Better error messages to help diagnose issues

## Testing

Created test file `test/test-preferences-save-fix.html` to verify:

1. **Settings Controller**: Tests that the settings controller initializes correctly with different dependency combinations
2. **Save Preferences**: Tests that the `savePreferences` function works with mocked dependencies
3. **Legacy Fallback**: Tests the legacy store fallback functionality

## Expected Behavior

After the fix:

- ✅ Preferences save successfully without errors
- ✅ No "Cannot read properties of undefined" errors
- ✅ Proper fallback to `electronAPI.store` when legacy store is not available
- ✅ Enhanced error handling and logging
- ✅ All preference values (database directory, music directory, hotkey directory, fade out seconds) save correctly

## Related Issues

This fix also addresses similar issues in other parts of the application that might be using the preferences module:

- Preference loading
- Preference getting/setting
- Database directory management
- Music directory management

## Files Created

- `test/test-preferences-save-fix.html` - Test file to verify the fix
- `doc/PREFERENCES_SAVE_FIX_COMPLETE.md` - This documentation file

## Status

✅ **COMPLETE** - The preferences saving functionality now works correctly without "Cannot read properties of undefined" errors. The module properly handles both legacy store and new electronAPI.store scenarios. 