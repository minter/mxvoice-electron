# Profile Migration Bug Fix

## Issue Summary

When creating a new profile with the same name as a previously deleted profile, the new profile would load songs and hotkeys from the old (global) `config.json` file, even though it should start completely fresh.

## Root Cause

The migration logic in `data-preloader.js` was designed to help users migrate from the old (pre-profiles) system to the new profile system. However, it had a critical flaw:

### The Bug Flow

1. User creates a new profile (e.g., "ComedySportz Saturday")
2. New profile is created successfully with no `state.json` file
3. App initialization calls `checkNeedsMigrationLoad()`
4. Function sees no `state.json` in the profile directory
5. Function checks global `config.json` at `~/Library/Application Support/Mx. Voice/config.json`
6. Finds legacy `hotkeys` and `holding_tank` HTML in global config.json
7. Returns `true` for "needs migration"
8. **Loads old hotkey/holding tank data from global config.json into the NEW profile**
9. User sees old songs/hotkeys in their brand new profile

## The Fix

Modified migration logic to ensure it only runs ONCE when upgrading from pre-4.1 to 4.1+:

### 1. Profile Name Check (`data-preloader.js`)
Only "Default User" profile can migrate from global config.json:

```javascript
// Get current profile name
const currentProfileResult = await electronAPI.profile.getCurrent();
const currentProfile = currentProfileResult?.profile;

// ONLY "Default User" can migrate from global config.json
if (currentProfile !== 'Default User') {
  return false; // Skip migration - start fresh
}
```

### 2. Migration Completed Flag (`data-preloader.js`)
Check if migration has already been completed:

```javascript
// Check if migration has already been completed
const preferencesResult = await electronAPI.profile.getPreference('migration_completed');
if (preferencesResult?.success && preferencesResult?.value === true) {
  this.logInfo('Migration already completed for Default User, skipping');
  return false;
}
```

### 3. Mark Migration Complete After Save (`renderer.js`)
After successfully saving migrated state, set the flag:

```javascript
// Save the profile state to capture the migrated hotkeys/holding tank
await moduleRegistry.profileState.saveProfileState();

// Mark migration as completed so it never runs again
await window.secureElectronAPI.profile.setPreference('migration_completed', true);
window.logInfo('✅ Migration marked as completed - will not run again');
```

### 4. Enhanced Logging
- Logs which profile is being checked
- Logs whether migration is needed and why
- Logs when migration is completed

## Why This Approach

- **"Default User" is special**: It's the only profile that might have existed before the profile system was implemented
- **One-time migration**: Migration only happens once per installation when upgrading from pre-4.1 to 4.1+
- **Persistent flag prevents re-running**: The `migration_completed` flag in Default User preferences ensures migration never runs again, even if state.json is deleted
- **New profiles should be pristine**: Users creating new profiles expect them to be empty
- **Re-creating a deleted profile should be fresh**: If you delete "ComedySportz Saturday" and create it again, it should start empty
- **Global config.json still used for directories**: Migration logic only affects hotkeys/holding_tank data; directory paths and other global settings still come from config.json

## Files Changed

1. **`src/renderer/modules/app-initialization/data-preloader.js`**
   - Modified `checkNeedsMigrationLoad()` to only allow migration for "Default User"
   - Added `migration_completed` preference check to prevent re-running
   - Added profile name checking and enhanced logging
   - Migration is now a ONE-TIME event when upgrading from pre-4.1

2. **`src/renderer.js`**
   - Added `migration_completed` flag setting after successful migration save
   - Ensures migration never runs again after first successful completion

3. **`src/renderer/modules/app-initialization/README.md`**
   - Updated documentation to reflect profile-aware one-time migration behavior

4. **`src/main/modules/profile-manager.js`**
   - Enhanced logging for profile creation and deletion
   - Added directory cleanup when creating profiles (defensive coding)
   - Logs detailed information about profile directory operations

5. **`src/renderer/modules/profile-state/index.js`**
   - Enhanced logging for state file loading
   - Shows detailed preview of what data is being loaded
   - Helps diagnose where profile data is coming from

## Testing the Fix

To verify the fix works:

1. **Delete a profile** that has songs/hotkeys
2. **Create a new profile with the same name**
3. **Open the new profile**
4. **Verify it's empty** (no songs, no hotkeys)

The new profile should start completely fresh, with no data from the old profile or from the global config.json.

## Additional Improvements

The enhanced logging added as part of this fix will help diagnose:
- Whether profiles are being properly deleted
- What data is being loaded from where
- If there are any filesystem issues with profile directories

## Related Issues

This bug was introduced when the profiles v2 system was implemented. The migration logic was well-intentioned (helping users migrate from the old system) but was too broad in its application.

The fix ensures migration only happens once per installation (for Default User only), and all other profiles are isolated from global state.

