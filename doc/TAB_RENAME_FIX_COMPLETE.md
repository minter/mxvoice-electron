# Tab Rename Fix Complete

## Issue Description

The tab name edit function for both holding tank and hotkeys had incorrect parameter order when calling the `customPrompt` function. The title and data were swapped, causing the modal to display incorrectly.

## Root Cause

There were two different `customPrompt` implementations with different parameter orders:

1. **Utils module** (`modal-utils.js`): `customPrompt(message, defaultValue, title)` - Promise-based
2. **UI module** (`modals.js`): `customPrompt(title, message, defaultValue, callback)` - Callback-based

The main renderer was using the utils module's Promise-based version, but the hotkeys and UI event handlers were still using the old callback-based version with incorrect parameter order.

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

This matches the expected behavior shown in the user's screenshot and provides a better user experience by allowing immediate typing without having to manually select the text. 