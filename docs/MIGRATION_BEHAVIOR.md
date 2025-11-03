# Profile Migration Behavior (4.1+)

## Overview

Starting in version 4.1, Mx. Voice uses a profile system that isolates user preferences and UI state per profile. This document explains how the one-time migration from the pre-4.1 global system works.

## Migration Rules

### When Migration Happens

Migration from the global `config.json` to profile-specific storage happens **ONCE** under these conditions:

1. **Profile must be "Default User"**
   - Only the "Default User" profile can migrate from global config.json
   - All other profiles (with any other name) start completely fresh
   
2. **First run after upgrading from pre-4.1**
   - Migration only happens when upgrading from a version before 4.1 (before profiles existed)
   - Detected when "Default User" has no `state.json` but global `config.json` has hotkey/holding tank data

3. **Migration not already completed**
   - Uses `migration_completed` preference flag in "Default User" profile
   - Once set to `true`, migration never runs again
   - Even if `state.json` is deleted, migration won't run again

### What Gets Migrated

**Migrated to Default User profile:**
- Hotkey assignments (all tabs)
- Holding tank content (all tabs)
- Tab names (if customized)

**Still used globally (NOT migrated):**
- `music_directory` - Where your music files are stored
- `hotkey_directory` - Where .mrv files are saved
- `database_directory` - Where the database is located
- `window_state` - Window position and size
- Other global settings

## Migration Flow

```
┌─────────────────────────────────────┐
│ User upgrades from 3.x to 4.1       │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│ App starts with "Default User"      │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│ Check: migration_completed flag?    │
└──────────────┬──────────────────────┘
               │
        ┌──────┴──────┐
        │             │
       NO            YES
        │             │
        ↓             ↓
┌──────────────┐  ┌──────────────────┐
│ Check for    │  │ Skip migration   │
│ legacy data  │  │ Start fresh      │
└──────┬───────┘  └──────────────────┘
       │
       ↓
┌──────────────────────────────────────┐
│ Load hotkeys/holding tank from       │
│ global config.json                   │
└──────────────┬───────────────────────┘
               │
               ↓
┌──────────────────────────────────────┐
│ Save to Default User/state.json     │
└──────────────┬───────────────────────┘
               │
               ↓
┌──────────────────────────────────────┐
│ Set migration_completed = true       │
│ (Never runs again)                   │
└──────────────────────────────────────┘
```

## New Profile Behavior

When creating a new profile (e.g., "ComedySportz Saturday"):

1. ✅ Starts completely empty
2. ✅ No hotkeys loaded
3. ✅ No holding tank items
4. ✅ Uses default preferences
5. ❌ NEVER migrates from global config.json
6. ❌ NEVER loads data from other profiles

## Re-creating a Deleted Profile

If you delete a profile and create a new one with the same name:

1. ✅ Starts completely fresh (empty)
2. ✅ Old profile directory was deleted
3. ✅ New profile directory created fresh
4. ❌ Does NOT restore old data
5. ❌ Does NOT migrate from global config.json

## Testing Migration Behavior

### Test 1: Fresh Install (No Migration)
```
Starting state: Clean install, no previous data
Expected: Default User starts empty
Result: ✅ No migration needed
```

### Test 2: Upgrade from 3.x (Migration)
```
Starting state: Upgrade from 3.1.5 with hotkeys/holding tank in config.json
Profile: Default User (first run)
Expected: Hotkeys and holding tank migrated to Default User profile
Result: ✅ Migration happens ONCE
Flag: migration_completed = true
```

### Test 3: Second Run After Migration
```
Starting state: Migration already completed (flag = true)
Profile: Default User
Expected: Loads from state.json, does NOT re-read config.json
Result: ✅ Migration skipped
```

### Test 4: New Profile Creation
```
Starting state: Any state
Profile: "ComedySportz Saturday" (newly created)
Expected: Empty profile, no migration
Result: ✅ Starts fresh
```

### Test 5: Delete state.json After Migration
```
Starting state: Migration completed, manually delete Default User/state.json
Profile: Default User
Expected: Does NOT re-migrate from config.json (flag still true)
Result: ✅ Starts fresh with empty state
```

## Troubleshooting

### Issue: New profile has old data
**Diagnosis:** This was the bug fixed in 4.1.0-pre.3
**Solution:** Upgrade to 4.1.0-pre.3 or later

### Issue: Migration keeps running
**Diagnosis:** `migration_completed` flag not being set
**Solution:** Check debug logs, ensure profile preferences are saving correctly

### Issue: Default User starts empty after upgrade
**Diagnosis:** Migration didn't detect legacy data in config.json
**Solution:** Check that config.json exists and has `hotkeys` or `holding_tank` with `songid=` attributes

## Debug Logging

Enable debug logging in preferences to see migration behavior:

```
Checking migration need for Default User profile
Migration already completed for Default User, skipping
```

or

```
ONE-TIME MIGRATION: Default User upgrading from pre-4.1, will load legacy data from global config.json
💾 Saving initial profile state after 3.1.5 → 4.1 migration...
✅ Migration marked as completed - will not run again
```

## Summary

- **One-time event**: Migration happens ONCE when upgrading from pre-4.1
- **Only Default User**: New profiles never migrate
- **Persistent flag**: `migration_completed` ensures no re-runs
- **Clean slate**: Deleting and re-creating profiles gives fresh start
- **Global settings preserved**: Directory paths still come from config.json

