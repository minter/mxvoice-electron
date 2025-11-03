# Profile Switching Data Loss Fix - Implementation Summary

## Date: 2025-01-21

## Problem Statement
Users experienced complete data loss of hotkeys and holding tank data when switching between profiles or duplicating profiles. Data would be present initially but disappear after switching back and forth between profiles.

## Root Cause
Multiple interacting bugs caused a race condition during profile state restoration:

1. **Primary Bug - Restoration Race Condition:** When loading profile state, `restoreHoldingTankTabs()` called `addToHoldingTank()` for each song, which triggered `saveHoldingTankToStore()` → `saveProfileState()`. Since the DOM was only partially populated, each save overwrote the good state.json with incomplete data.

2. **Inappropriate Auto-Saves:** Both `setLabelFromSongId()` and `addToHoldingTank()` triggered saves on every call, meaning any batch operation (like loading a file or restoring state) would trigger N saves during the operation.

3. **Incorrect API Usage:** `saveProfileState()` takes no parameters but was being called with parameters that were silently ignored.

## Solution Implemented

### 1. Restoration Lock (Critical Fix)
**Files Modified:**
- `src/renderer/modules/profile-state/index.js`
- `src/renderer/modules/hotkeys/index.js`
- `src/renderer/modules/holding-tank/index.js`

**Changes:**
- Added global `window.isRestoringProfileState` flag
- Set to `true` at start of `loadProfileState()`
- Cleared to `false` when restoration completes or on error (all code paths)
- Both `saveHotkeysToStore()` and `saveHoldingTankToStore()` check this flag and skip saves if true

**Effect:** Prevents all saves during profile state restoration, eliminating the race condition.

### 2. Fixed Holding Tank Restoration
**File Modified:** `src/renderer/modules/profile-state/index.js`

**Changes:**
- Modified `restoreHoldingTankTabs()` to build DOM elements directly
- No longer calls `addToHoldingTank()` which would trigger saves
- Builds `<li>` elements with all attributes and event listeners manually
- Directly appends to DOM

**Effect:** Restoration no longer triggers any save calls, even without the lock.

### 3. Removed Inappropriate Auto-Saves
**Files Modified:**
- `src/renderer/modules/hotkeys/index.js`
- `src/renderer/modules/holding-tank/index.js`

**Changes:**
- Removed `saveHotkeysToStore()` call from `setLabelFromSongId()` (line 563 → now has comment)
- Removed `saveHotkeysToStore()` call from `fallbackSetLabelFromSongId()`
- Removed `saveHoldingTankToStore()` call from `addToHoldingTank()` (line 260 → now has comment)

**Effect:** Batch operations no longer trigger N saves during processing.

### 4. Added Single Save After Batch Operations
**Files Modified:**
- `src/renderer/modules/hotkeys/index.js`
- `src/renderer/modules/holding-tank/index.js`

**Changes:**
- Added `saveHotkeysToStore()` call at end of `_populateHotkeysImpl()` 
- Added `saveHoldingTankToStore()` call at end of `populateHoldingTank()`

**Effect:** File loading (.mrv/.hld) triggers ONE save after all data is loaded, not N saves during loading.

### 5. Fixed API Usage
**Files Modified:**
- `src/renderer/modules/hotkeys/index.js`
- `src/renderer/modules/holding-tank/index.js`
- `src/renderer/modules/profile-state/index.js`

**Changes:**
- Updated all `saveProfileState()` call sites to not pass parameters
- Added documentation to `saveProfileState()` function explaining it takes no parameters
- Updated README with corrected API usage examples

**Effect:** API is used correctly, making code intent clear.

### 6. Documentation Updates
**File Modified:** `src/renderer/modules/profile-state/README.md`

**Changes:**
- Added "Restoration Lock" feature to feature list
- Added detailed "Restoration Lock" section explaining the mechanism
- Fixed `saveProfileState()` usage examples to show no parameters
- Updated Export Interface documentation

**Effect:** Future developers understand the restoration lock mechanism and API.

## Edge Cases Covered

All 12 identified edge cases are covered by this fix:

1. ✅ Creating new profile - No restoration, no corruption
2. ✅ Duplicating profile - Restoration lock prevents corruption  
3. ✅ Switching between profiles - Restoration lock prevents corruption
4. ✅ Quit/restart - Normal saves work correctly
5. ✅ Deleting current profile - State saved before deletion
6. ✅ Loading .mrv file - Single save after load, not N saves during
7. ✅ Loading .hld file - Single save after load, not N saves during
8. ✅ First time using profile - No restoration, works fine
9. ✅ Manual add/remove operations - Still trigger saves (correct behavior)
10. ✅ App crash/force quit - Expected data loss since last save (acceptable)
11. ✅ Profile name special characters - Already handled correctly
12. ✅ Re-creating deleted profile - Starts fresh, no issues

## Files Changed Summary

1. **src/renderer/modules/profile-state/index.js** (Major changes)
   - Added restoration lock flag management
   - Fixed `restoreHoldingTankTabs()` to build DOM directly
   - Added documentation to `saveProfileState()`
   - Lock cleared in all code paths (5 early returns + 1 success + 1 error)

2. **src/renderer/modules/hotkeys/index.js** (Moderate changes)
   - Added restoration lock check to `saveHotkeysToStore()`
   - Fixed `saveProfileState()` API usage (removed parameters)
   - Removed save from `setLabelFromSongId()` and fallback
   - Added save to `_populateHotkeysImpl()`

3. **src/renderer/modules/holding-tank/index.js** (Moderate changes)
   - Added restoration lock check to `saveHoldingTankToStore()`
   - Fixed `saveProfileState()` API usage (removed parameters)
   - Removed save from `addToHoldingTank()`
   - Added save to `populateHoldingTank()`

4. **src/renderer/modules/profile-state/README.md** (Documentation)
   - Updated feature list
   - Added restoration lock section
   - Fixed API usage examples
   - Updated export interface documentation

## Testing Requirements

### Critical Tests (Must Pass)
1. **Duplicate Profile Test:**
   - Start with Profile A containing hotkeys and holding tank data
   - Duplicate to Profile B
   - Verify Profile B has all data
   - Switch back to Profile A
   - Verify Profile A still has all data
   - Switch to Profile B again
   - Verify Profile B still has all data

2. **Repeated Switching Test:**
   - Create Profile A and Profile B with different data
   - Switch A → B → A → B → A (5 switches)
   - Verify both profiles retain their original data

3. **File Loading Test:**
   - Load .mrv file with 12 hotkeys
   - Verify all 12 hotkeys appear
   - Check state.json contains all 12
   - Load .hld file with 10 songs
   - Verify all 10 songs appear
   - Check state.json contains all 10

### Secondary Tests (Should Pass)
4. Manual operations still save correctly
5. New profile creation starts empty
6. Profile deletion works correctly
7. Quit/restart preserves data
8. Multiple file loads work correctly

## Success Criteria

**Primary:** Users can duplicate profiles and switch between them multiple times without any data loss.

**Secondary:** 
- File loading (.mrv/.hld) works correctly without corruption
- Manual operations continue to save properly
- System is more performant (fewer unnecessary saves)

## Risk Assessment

**Risk Level:** Low
- Changes are surgical and well-contained
- Restoration lock is a simple boolean flag
- All code paths clear the lock
- Extensive edge case analysis completed

**Rollback Plan:** 
If issues occur, revert commits for these 4 files. The changes are isolated to profile state management and don't affect other systems.

## Performance Improvement

**Before:** 
- Loading 10 songs triggered 10 saves (N saves)
- Loading 12 hotkeys triggered 12 saves (N saves)
- Profile restoration triggered N saves during restoration

**After:**
- Loading 10 songs triggers 1 save (single save)
- Loading 12 hotkeys triggers 1 save (single save)
- Profile restoration triggers 0 saves during restoration, 0 saves after (state already loaded)

**Result:** Significantly fewer file I/O operations, faster loading, no race conditions.

## Notes

- The fix is **backward compatible** - old state.json files load correctly
- No database schema changes required
- No changes to state.json format
- Pre-duplication state save already existed in renderer.js (line 963) and works correctly
- Manual operations (drag-drop, remove, clear) still trigger saves as expected

