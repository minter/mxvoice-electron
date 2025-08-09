# Hotkey Song ID Fix

## Issue Description

When pressing F-key hotkeys to play assigned songs, users encountered the following error:

```
Getting song ID from hotkey f1
Found song ID undefined
```

The system was unable to retrieve the song ID from hotkey elements, resulting in no songs being played when F-keys were pressed.

## Root Cause

The issue was caused by a mismatch between where the `songid` attribute was being set and where it was being read:

1. **Setting the attribute**: The `songid` attribute was being set on the `<span>` element inside the hotkey `<li>` element
2. **Reading the attribute**: The `playSongFromHotkey` function was looking for the `songid` attribute on the `<li>` element itself

This mismatch meant that when the function tried to retrieve the song ID, it was looking in the wrong place and always found `undefined`.

## Code Analysis

### Before (Broken)
```javascript
// In setLabelFromSongId function
$(element).find("span").attr("songid", song_id);  // ❌ Setting on span

// In playSongFromHotkey function  
const song_id = $(`.hotkeys.active #${hotkey}_hotkey`).attr("songid");  // ❌ Looking on li
```

### After (Fixed)
```javascript
// In setLabelFromSongId function
$(element).attr("songid", song_id);  // ✅ Setting on li element

// In playSongFromHotkey function  
const song_id = $(`.hotkeys.active #${hotkey}_hotkey`).attr("songid");  // ✅ Looking on li
```

## Files Fixed

### 1. `src/renderer/modules/hotkeys/index.js`

**Lines Fixed**:
- Line 319: `$(element).find("span").attr("songid", song_id)` → `$(element).attr("songid", song_id)`
- Line 365: `$(element).find("span").attr("songid", song_id)` → `$(element).attr("songid", song_id)`

### 2. `src/renderer/modules/hotkeys/hotkey-data.js`

**Lines Fixed**:
- Line 77: `$(element).find("span").attr("songid", song_id)` → `$(element).attr("songid", song_id)`
- Line 128: `$(element).find("span").attr("songid", song_id)` → `$(element).attr("songid", song_id)`

## HTML Structure

The hotkey elements have this structure:
```html
<li class="list-group-item text-nowrap unselectable context-menu" id="f1_hotkey">
    <div class="badge">F1</div>
    <span draggable='true' class='song' ondragstart='songDrag(event)'></span>
</li>
```

The fix ensures that:
- The `songid` attribute is set on the `<li>` element (the container)
- The song title is displayed in the `<span>` element (the content)
- The `playSongFromHotkey` function reads from the correct element

## Verification

### Test Files Created
1. **`test/test-hotkey-song-id-debug.html`** - Debug test to isolate the selector issue
2. **`test/test-hotkey-song-id-fix.html`** - Comprehensive test to verify the complete fix

### Test Coverage
1. **Selector Testing**: Verifies that jQuery selectors work correctly
2. **Attribute Setting**: Tests setting `songid` on the correct element
3. **Attribute Reading**: Tests reading `songid` from the correct element
4. **Function Integration**: Tests the complete `playSongFromHotkey` workflow
5. **Hotkey Assignment**: Tests the `sendToHotkeys` function

## Impact

- ✅ **Fixed**: F-key hotkeys now properly play assigned songs
- ✅ **Maintained**: All existing hotkey functionality preserved
- ✅ **Consistent**: Attribute placement now matches reading location
- ✅ **Reliable**: Hotkey assignments persist correctly

## Testing Instructions

1. **Start the application** with `yarn start`
2. **Assign a song to an F-key**:
   - Select a song from search results
   - Press the F-key or use drag-and-drop
3. **Test the hotkey**:
   - Press the assigned F-key
   - Verify the song plays correctly
   - Check console for successful song ID retrieval

## Expected Behavior

### Before Fix
```
Getting song ID from hotkey f1
Found song ID undefined
❌ No song plays
```

### After Fix
```
Getting song ID from hotkey f1
Found song ID 123
Preparing to play song 123
✅ Song plays successfully
```

## Related Documentation

- `doc/HOTKEYS_MODULE_EXTRACTION_COMPLETE.md` - Hotkeys module extraction details
- `doc/UI_MODULE_EXTRACTION_COMPLETE.md` - UI module extraction details
- `doc/AUDIO_MODULE_EXTRACTION_COMPLETE.md` - Audio module extraction details

## Technical Details

### Attribute Placement Strategy
- **Container Level**: `songid` attribute on `<li>` elements for easy selection
- **Content Level**: Song title in `<span>` elements for display
- **Consistency**: All functions now read/write from the same location

### Selector Optimization
- Uses efficient jQuery selectors: `$('.hotkeys.active #f1_hotkey')`
- Leverages CSS ID selectors for fast element lookup
- Maintains compatibility with existing event handlers

### Error Handling
- Graceful fallback when song ID is not found
- Clear console logging for debugging
- No breaking changes to existing functionality 