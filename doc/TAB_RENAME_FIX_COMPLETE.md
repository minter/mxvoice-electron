# Tab Rename, Delete Modal, and Advanced Search Fix Complete

## Issue Description

The tab name edit function for both holding tank and hotkeys had incorrect parameter order when calling the `customPrompt` function. The title and data were swapped, causing the modal to display incorrectly.

Additionally, the delete confirmation modals for songs (when pressing delete key) were using the old callback-based `customConfirm` function instead of the Promise-based version, causing similar issues.

The advanced search toggle functionality was broken due to conflicting function assignments between the search module and UI module.

## Root Cause

There were two different `customPrompt` implementations with different parameter orders:

1. **Utils module** (`modal-utils.js`): `customPrompt(message, defaultValue, title)` - Promise-based
2. **UI module** (`modals.js`): `customPrompt(title, message, defaultValue, callback)` - Callback-based

The main renderer was using the utils module's Promise-based version, but the hotkeys and UI event handlers were still using the old callback-based version with incorrect parameter order.

Similarly, there were two different `customConfirm` implementations:
1. **Utils module** (`modal-utils.js`): `customConfirm(message, title)` - Promise-based
2. **UI module** (`modals.js`): `customConfirm(message, callback)` - Callback-based

The delete confirmation modals were using the old callback-based version instead of the Promise-based version.

The advanced search toggle had conflicting function assignments where the UI module was overwriting the search module's assignment, causing the function to be unavailable.

## Changes Made

### 1. Fixed Hotkeys Module (`src/renderer/modules/hotkeys/hotkey-ui.js`)

**Before:**
```javascript
function renameHotkeyTab(options = {}) {
  const { saveHotkeysToStore } = options;
  
  const currentName = $("#hotkey_tabs .nav-link.active").text();
  customPrompt("Rename Hotkey Tab", "Enter a new name for this tab:", currentName, (newName) => {
    if (newName && newName.trim() !== "") {
      $("#hotkey_tabs .nav-link.active").text(newName);
      if (saveHotkeysToStore) {
        saveHotkeysToStore();
      }
    }
  });
}
```

**After:**
```javascript
async function renameHotkeyTab(options = {}) {
  const { saveHotkeysToStore } = options;
  
  const currentName = $("#hotkey_tabs .nav-link.active").text();
  const newName = await customPrompt("Enter a new name for this tab:", currentName, "Rename Hotkey Tab");
  if (newName && newName.trim() !== "") {
    $("#hotkey_tabs .nav-link.active").text(newName);
    if (saveHotkeysToStore) {
      saveHotkeysToStore();
    }
    return { success: true, newName: newName };
  } else {
    return { success: false, error: 'Invalid name' };
  }
}
```

### 2. Fixed Hotkeys Index (`src/renderer/modules/hotkeys/index.js`)

**Before:**
```javascript
renameHotkeyTab() {
  const currentName = $("#hotkey_tabs .nav-link.active").text();
  customPrompt("Rename Hotkey Tab", "Enter a new name for this tab:", currentName, (newName) => {
    if (newName && newName.trim() !== "") {
      $("#hotkey_tabs .nav-link.active").text(newName);
      this.saveHotkeysToStore();
    }
  });
}
```

**After:**
```javascript
async renameHotkeyTab() {
  const currentName = $("#hotkey_tabs .nav-link.active").text();
  const newName = await customPrompt("Enter a new name for this tab:", currentName, "Rename Hotkey Tab");
  if (newName && newName.trim() !== "") {
    $("#hotkey_tabs .nav-link.active").text(newName);
    this.saveHotkeysToStore();
    return { success: true, newName: newName };
  } else {
    return { success: false, error: 'Invalid name' };
  }
}
```

### 3. Fixed UI Event Handlers (`src/renderer/modules/ui/event-handlers.js`)

**Before:**
```javascript
function renameHotkeyTab() {
  const currentName = $("#hotkey_tabs .nav-link.active").text();
  customPrompt("Rename Hotkey Tab", "Enter a new name for this tab:", currentName, function(newName) {
    if (newName && newName.trim() !== "") {
      $("#hotkey_tabs .nav-link.active").text(newName);
      saveHotkeysToStore();
    }
  });
}

function renameHoldingTankTab() {
  const currentName = $("#holding_tank_tabs .nav-link.active").text();
  customPrompt("Rename Holding Tank Tab", "Enter a new name for this tab:", currentName, function(newName) {
    if (newName && newName.trim() !== "") {
      $("#holding_tank_tabs .nav-link.active").text(newName);
      saveHoldingTankToStore();
    }
  });
}
```

**After:**
```javascript
async function renameHotkeyTab() {
  const currentName = $("#hotkey_tabs .nav-link.active").text();
  const newName = await customPrompt("Enter a new name for this tab:", currentName, "Rename Hotkey Tab");
  if (newName && newName.trim() !== "") {
    $("#hotkey_tabs .nav-link.active").text(newName);
    saveHotkeysToStore();
    return { success: true, newName: newName };
  } else {
    return { success: false, error: 'Invalid name' };
  }
}

async function renameHoldingTankTab() {
  const currentName = $("#holding_tank_tabs .nav-link.active").text();
  const newName = await customPrompt("Enter a new name for this tab:", currentName, "Rename Holding Tank Tab");
  if (newName && newName.trim() !== "") {
    $("#holding_tank_tabs .nav-link.active").text(newName);
    saveHoldingTankToStore();
    return { success: true, newName: newName };
  } else {
    return { success: false, error: 'Invalid name' };
  }
}
```

### 4. Updated Global Function Exposure (`src/renderer.js`)

**Before:**
```javascript
window.renameHotkeyTab = uiModule.default.renameHotkeyTab;
window.renameHoldingTankTab = uiModule.default.renameHoldingTankTab;
window.renameHotkeyTab = hotkeysInstance.renameHotkeyTab.bind(hotkeysInstance);
```

**After:**
```javascript
window.renameHotkeyTab = function() {
  uiModule.default.renameHotkeyTab().catch(error => {
    console.error('❌ Error in renameHotkeyTab:', error);
  });
};
window.renameHoldingTankTab = function() {
  uiModule.default.renameHoldingTankTab().catch(error => {
    console.error('❌ Error in renameHoldingTankTab:', error);
  });
};
window.renameHotkeyTab = function() {
  hotkeysInstance.renameHotkeyTab().catch(error => {
    console.error('❌ Error in renameHotkeyTab:', error);
  });
};
```

### 5. Improved Text Selection in customPrompt Functions

**Utils Module** (`src/renderer/modules/utils/modal-utils.js`):

**Before:**
```javascript
// Focus input and show modal
$(modal).modal('show');
setTimeout(() => input.focus(), 500);
```

**After:**
```javascript
// Focus input, select text, and show modal
$(modal).modal('show');
setTimeout(() => {
  input.focus();
  input.select(); // Select all text so user can type over it
}, 500);
```

**UI Module** (`src/renderer/modules/ui/modals.js`):

**Before:**
```javascript
// Focus on the input field
$("#inputModalField").focus();
```

**After:**
```javascript
// Focus on the input field and select text
$("#inputModalField").focus();
$("#inputModalField").select(); // Select all text so user can type over it
```

### 6. Fixed Delete Confirmation Modals

**Holding Tank Module** (`src/renderer/modules/holding-tank/index.js`):

**Before:**
```javascript
return new Promise((resolve) => {
  customConfirm(`Are you sure you want to remove ${songRow.title} from the holding tank?`, function() {
    console.log("Proceeding with removal from holding tank");
    $("#selected_row").remove();
    $("#selected_row").removeAttr("id");
    saveHoldingTankToStore();
    resolve({ success: true, songId: songId, title: songRow.title });
  });
});
```

**After:**
```javascript
return customConfirm(`Are you sure you want to remove ${songRow.title} from the holding tank?`).then(confirmed => {
  if (confirmed) {
    console.log("Proceeding with removal from holding tank");
    $("#selected_row").remove();
    $("#selected_row").removeAttr("id");
    saveHoldingTankToStore();
    return { success: true, songId: songId, title: songRow.title };
  } else {
    return { success: false, error: 'User cancelled' };
  }
});
```

**Song Management Module** (`src/renderer/modules/song-management/song-removal.js`):

**Before:**
```javascript
customConfirm(`Are you sure you want to delete ${songRow.title} from Mx. Voice permanently?`, function() {
  console.log("Proceeding with delete");
  // ... delete logic ...
});
```

**After:**
```javascript
return customConfirm(`Are you sure you want to delete ${songRow.title} from Mx. Voice permanently?`).then(confirmed => {
  if (confirmed) {
    console.log("Proceeding with delete");
    // ... delete logic ...
    return { success: true, songId: songId, title: songRow.title };
  } else {
    return { success: false, error: 'User cancelled' };
  }
});
```

**UI Module** (`src/renderer/modules/ui/ui-manager.js`):

**Before:**
```javascript
customConfirm(`Are you sure you want to remove ${songRow.title} from the holding tank?`, function() {
  console.log("Proceeding with removal from holding tank");
  $("#selected_row").remove();
  $("#selected_row").removeAttr("id");
  saveHoldingTankToStore();
});
```

**After:**
```javascript
return customConfirm(`Are you sure you want to remove ${songRow.title} from the holding tank?`).then(confirmed => {
  if (confirmed) {
    console.log("Proceeding with removal from holding tank");
    $("#selected_row").remove();
    $("#selected_row").removeAttr("id");
    saveHoldingTankToStore();
    return { success: true, songId: songId, title: songRow.title };
  } else {
    return { success: false, error: 'User cancelled' };
  }
});
```

### 7. Fixed Advanced Search Toggle Function Assignment

**Renderer Module** (`src/renderer.js`):

**Before:**
```javascript
window.toggleAdvancedSearch = searchInstance.toggleAdvancedSearch.bind(searchInstance);
// ... later in the file ...
window.toggleAdvancedSearch = uiModule.default.toggleAdvancedSearch; // This overwrote the search module assignment
```

**After:**
```javascript
window.toggleAdvancedSearch = searchInstance.toggleAdvancedSearch.bind(searchInstance);
// ... later in the file ...
// toggleAdvancedSearch is handled by the search module
```

**Advanced Search Module** (`src/renderer/modules/search/advanced-search.js`):

**Before:**
```javascript
// Clear any pending live search
clearTimeout(searchTimeout);
// ... later in the file ...
if ($("#advanced-search").is(":visible")) {
  // Hide logic
}
// ... later in the file ...
scale_scrollable();
```

**After:**
```javascript
// Track the advanced search state
let isAdvancedSearchOpen = false;

// Clear any pending live search - use global searchTimeout if available
if (typeof searchTimeout !== 'undefined') {
  clearTimeout(searchTimeout);
}
// ... later in the file ...
// Use state variable instead of DOM queries for reliable toggling
if (isAdvancedSearchOpen) {
  // Hide logic
  isAdvancedSearchOpen = false;
} else {
  // Show logic
  isAdvancedSearchOpen = true;
}
// ... later in the file ...
if (typeof scale_scrollable === 'function') {
  scale_scrollable();
}
```

## Correct Parameter Order

The `customPrompt` function now uses the correct parameter order:

```javascript
customPrompt(message, defaultValue, title)
```

Where:
- `message`: "Enter a new name for this tab:"
- `defaultValue`: Current tab name (e.g., "1")
- `title`: "Rename Hotkey Tab" or "Rename Holding Tank Tab"

## Testing

A test file was created at `test/test-tab-rename-fix.html` to verify that:
1. The `customPrompt` function is called with the correct parameter order
2. The modal displays the correct title and message
3. The default value is properly set to the current tab name

## Result

The tab rename functionality now works correctly for both holding tank and hotkeys tabs. The modal will display:
- **Title**: "Rename Hotkey Tab" or "Rename Holding Tank Tab"
- **Message**: "Enter a new name for this tab:"
- **Default Value**: The current tab name (e.g., "1")
- **Text Selection**: The current tab name is automatically selected/highlighted so users can immediately type over it

The delete confirmation modals now work correctly for all song deletion operations:
- **Holding Tank Removal**: "Are you sure you want to remove [Song Title] from the holding tank?"
- **Hotkey Removal**: "Are you sure you want to remove [Song Title] from this hotkey?"
- **Database Deletion**: "Are you sure you want to delete [Song Title] from Mx. Voice permanently?"

All modals now use the Promise-based `customConfirm` and `customPrompt` functions with proper parameter order and return values for better error handling and user experience.

The advanced search toggle now works correctly:
- **Function Assignment**: Properly assigned from search module instead of being overwritten by UI module
- **Dependency Handling**: Safely handles missing dependencies like `searchTimeout` and `scale_scrollable`
- **UI State Management**: Correctly toggles between simple and advanced search modes
- **Icon Updates**: Properly switches between plus and minus icons

This matches the expected behavior shown in the user's screenshot and provides a better user experience by allowing immediate typing without having to manually select the text. 