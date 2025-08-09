# Hotkey Drag & Drop Fix

## Problem Description

The commit `65edd1c43521a39b48845c76fd60a406349e29be` introduced a breaking change that broke drag and drop functionality into hotkeys. The issue was caused by conflicting function assignments between the hotkeys module and the drag-drop module.

## Root Cause Analysis

### 1. Function Assignment Conflict

The renderer.js file was assigning drag and drop functions from two different modules to the same global window variables:

```javascript
// From hotkeys module (line 376)
window.hotkeyDrop = hotkeysInstance.hotkeyDrop.bind(hotkeysInstance);
window.allowHotkeyDrop = hotkeysInstance.allowHotkeyDrop.bind(hotkeysInstance);

// From drag-drop module (line 510-513) - OVERWRITING THE ABOVE!
window.hotkeyDrop = dragDropInstance.hotkeyDrop;
window.holdingTankDrop = dragDropInstance.holdingTankDrop;
window.allowHotkeyDrop = dragDropInstance.allowHotkeyDrop;
window.songDrag = dragDropInstance.songDrag;
```

### 2. Function Implementation Differences

The hotkeys module's `hotkeyDrop` function:
- Calls `this.setLabelFromSongId(song_id, target)` with proper context
- Has access to the hotkeys module instance and its methods
- Properly handles hotkey-specific functionality

The drag-drop module's `hotkeyDrop` function:
- Calls `setLabelFromSongId(song_id, target)` as a standalone function
- Doesn't have access to the hotkeys module context
- Is a generic drag-drop function not specific to hotkeys

### 3. Module Architecture Issues

The commit changed the drag-drop module from exporting individual functions to using a singleton class pattern, but the hotkeys module was still trying to use its own implementations while also binding to the hotkeyUI functions.

## Solution Implemented

### 1. Removed Conflicting Assignments

Removed the conflicting assignments from the drag-drop module loading in renderer.js:

```javascript
// BEFORE (conflicting)
window.hotkeyDrop = dragDropInstance.hotkeyDrop;
window.allowHotkeyDrop = dragDropInstance.allowHotkeyDrop;

// AFTER (fixed)
// Import functions directly from the functions file to avoid conflicts
const { songDrag, columnDrag } = await import('./renderer/modules/drag-drop/drag-drop-functions.js');
window.songDrag = songDrag;
window.columnDrag = columnDrag;
```

### 2. Fixed Hotkeys Module Function Usage

Updated the hotkeys module to properly use the hotkeyUI functions with correct parameters:

```javascript
// BEFORE (missing setLabelFromSongId parameter)
this.hotkeyDrop(event.originalEvent);

// AFTER (with proper parameters)
this.hotkeyDrop(event.originalEvent, { setLabelFromSongId: this.setLabelFromSongId.bind(this) });
```

### 3. Removed Duplicate Function Implementations

Removed the duplicate `hotkeyDrop` and `allowHotkeyDrop` methods from the hotkeys module since they were conflicting with the hotkeyUI implementations.

## Files Modified

1. **src/renderer.js**
   - Removed conflicting drag-drop function assignments
   - Now imports `songDrag` and `columnDrag` directly from drag-drop-functions.js
   - Added `holdingTankDrop` assignment from the holding-tank module

2. **src/renderer/modules/hotkeys/index.js**
   - Updated event listener to pass proper parameters to hotkeyDrop
   - Removed duplicate hotkeyDrop and allowHotkeyDrop method implementations
   - Updated comments to reflect the use of hotkeyUI functions

3. **src/renderer/modules/drag-drop/index.js**
   - Removed duplicate hotkeyDrop and allowHotkeyDrop method implementations
   - Removed conflicting exports to avoid module conflicts
   - Updated comments to reflect the use of hotkeyUI functions

4. **src/renderer/modules/drag-drop/drag-drop-functions.js**
   - Removed exports of hotkeyDrop and allowHotkeyDrop functions
   - Kept songDrag and columnDrag exports for general drag and drop functionality

## Testing

Created test files to verify the fix:
- `test/test-hotkey-drag-drop-fix.html`: Tests hotkey drag and drop functionality
- `test/test-drag-drop-functions.html`: Tests general drag and drop functions
- `test/test-holding-tank-drop-fix.html`: Tests holding tank drop functionality

## Verification Steps

1. Start the application
2. Try dragging a song from the database or search results into a hotkey slot
3. Verify that the song is properly assigned to the hotkey
4. Verify that the hotkey label updates correctly
5. Verify that the hotkey can be played by double-clicking

## Prevention

To prevent similar issues in the future:

1. **Avoid Function Name Conflicts**: Ensure that different modules don't export functions with the same names to the global scope
2. **Clear Module Responsibilities**: Each module should handle its own specific functionality
3. **Proper Function Binding**: When using functions from other modules, ensure proper context binding
4. **Test Drag and Drop**: Always test drag and drop functionality after module changes

## Related Issues

This fix resolves the drag and drop functionality that was broken in commit `65edd1c43521a39b48845c76fd60a406349e29be`. The fix ensures that:

- Hotkeys can receive dropped songs
- Song labels are properly updated in hotkey slots
- The hotkeys module maintains its own drag and drop functionality
- The drag-drop module handles general drag and drop operations
- No conflicts between module function assignments 