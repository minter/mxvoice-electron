# Holding Tank Double-Click Fix

## Issue Description

When trying to play a song by double-clicking in the holding tank, users encountered the following errors:

```
Uncaught ReferenceError: toggle_selected_row is not defined
    at HTMLLIElement.<anonymous> (renderer.js:998:5)
renderer.js:1008 Uncaught ReferenceError: holdingTankMode is not defined
    at HTMLLIElement.<anonymous> (renderer.js:1008:5)
```

## Root Cause

The errors occurred because:

1. **Function Name Change**: During the modularization process, the function `toggle_selected_row()` was renamed to `toggleSelectedRow()` in the UI module, but some event handlers in `renderer.js` were still using the old function name.

2. **Variable Access Issue**: The `holdingTankMode` variable was moved to the mode management module and should be accessed through `window.getHoldingTankMode()` instead of being accessed directly.

## Fixes Applied

### 1. Updated Function Calls

**File**: `src/renderer.js`

**Lines Fixed**:
- Line 930: `toggle_selected_row(this)` → `toggleSelectedRow(this)`
- Line 934: `toggle_selected_row(this)` → `toggleSelectedRow(this)`
- Line 997: `toggle_selected_row(this)` → `toggleSelectedRow(this)`

### 2. Updated Variable Access

**File**: `src/renderer.js`

**Line Fixed**:
- Line 1007: `holdingTankMode === "playlist"` → `window.getHoldingTankMode() === "playlist"`

## Code Changes

### Before (Broken)
```javascript
$(".holding_tank").on("click", ".list-group-item", function (event) {
  toggle_selected_row(this);
});

$(".holding_tank").on("dblclick", ".list-group-item", function (event) {
  // ... other code ...
  if (holdingTankMode === "playlist") {
    // ... playlist logic ...
  }
  playSelected();
});
```

### After (Fixed)
```javascript
$(".holding_tank").on("click", ".list-group-item", function (event) {
  toggleSelectedRow(this);
});

$(".holding_tank").on("dblclick", ".list-group-item", function (event) {
  // ... other code ...
  if (window.getHoldingTankMode() === "playlist") {
    // ... playlist logic ...
  }
  playSelected();
});
```

## Verification

### Test File Created
- `test/test-holding-tank-double-click-fix.html` - Comprehensive test to verify the fixes work correctly

### Test Coverage
1. **Function Availability**: Verifies that `toggleSelectedRow`, `getHoldingTankMode`, `setHoldingTankMode`, and `playSelected` are all available
2. **Mode Management**: Tests switching between storage and playlist modes
3. **Row Selection**: Tests the row selection functionality
4. **Double-Click Behavior**: Simulates the actual double-click behavior with proper mode checking

## Module Dependencies

The fix ensures proper integration with:

- **UI Module**: Provides `toggleSelectedRow()` function
- **Mode Management Module**: Provides `getHoldingTankMode()` and `setHoldingTankMode()` functions
- **Audio Module**: Provides `playSelected()` function

## Impact

- ✅ **Fixed**: Double-clicking songs in holding tank now works without errors
- ✅ **Maintained**: All existing functionality preserved
- ✅ **Compatible**: Works with both storage and playlist modes
- ✅ **Modular**: Uses proper module-based function calls

## Testing Instructions

1. Start the application
2. Add songs to the holding tank
3. Double-click on a song in the holding tank
4. Verify that:
   - No console errors appear
   - The song plays correctly
   - The song is properly selected
   - In playlist mode, the song is marked as "now playing"

## Related Documentation

- `doc/UI_MODULE_EXTRACTION_COMPLETE.md` - UI module extraction details
- `doc/MODE_MANAGEMENT_MODULE_EXTRACTION_COMPLETE.md` - Mode management module details
- `doc/HOLDING_TANK_MODULE_EXTRACTION_COMPLETE.md` - Holding tank module details 