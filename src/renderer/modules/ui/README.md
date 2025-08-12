# UI Module

The UI module provides all user interface functionality for the MxVoice application. It includes UI management, controls, event handlers, and modal operations.

## Module Structure

```
ui/
├── index.js          # Main module entry point
├── ui-manager.js     # Core UI management functions
├── event-handlers.js # UI event handling functions
├── controls.js       # UI control functions
├── modals.js         # Modal operations
├── bootstrap-adapter.js # Bootstrap 5 helpers (modal/tab/tooltip)
└── README.md         # This documentation
```

## Features

### UI Manager (`ui-manager.js`)
- **scaleScrollable()** - Scale scrollable elements based on window size
- **editSelectedSong()** - Edit the currently selected song
- **deleteSelectedSong()** - Delete the currently selected song
- **closeAllTabs()** - Close all tabs and clear stored data
- **getFontSize()** - Get current font size
- **setFontSize()** - Set font size

### Event Handlers (`event-handlers.js`)
- **toggleSelectedRow()** - Toggle row selection
- **switchToHotkeyTab()** - Switch to a specific hotkey tab
- **renameHotkeyTab()** - Rename the currently active hotkey tab
- **renameHoldingTankTab()** - Rename the currently active holding tank tab

### Controls (`controls.js`)
- **increaseFontSize()** - Increase font size
- **decreaseFontSize()** - Decrease font size
- **toggleWaveform()** - Toggle waveform display
- **toggleAdvancedSearch()** - Toggle advanced search display

### Modals (`modals.js`)
- **pickDirectory()** - Pick a directory using system file dialog
- **installUpdate()** - Install application update
- **customConfirm()** - Custom confirmation dialog
- **customPrompt()** - Custom prompt dialog
- **restoreFocusToSearch()** - Restore focus to search field

## Usage

The module exports a pre-initialized singleton. To reinitialize with dependencies (as done during bootstrap), call `reinitializeUI`.

```javascript
import ui from './modules/ui/index.js';

ui.reinitializeUI({
  electronAPI: window.electronAPI,
  db: window.db,
  store: window.store
});

ui.scaleScrollable();
ui.increaseFontSize();
ui.toggleWaveform();
```

### Backward compatibility
Named bindings are exported for direct imports if needed.

## API Reference

### UI Manager Functions

#### `scaleScrollable()`
Scales scrollable elements based on window size and advanced search visibility.

#### `editSelectedSong()`
Opens the edit modal for the currently selected song.

#### `deleteSelectedSong()`
Deletes the currently selected song based on its location (holding tank, hotkey, or search results).

#### `closeAllTabs()`
Closes all tabs and clears stored data with confirmation dialog.

### Event Handler Functions

#### `toggleSelectedRow(row)`
Toggles selection of a table row.

**Parameters:**
- `row` (HTMLElement) - The row element to toggle

#### `switchToHotkeyTab(tab)`
Switches to a specific hotkey tab.

**Parameters:**
- `tab` (number) - Tab number to switch to

#### `renameHotkeyTab()`
Opens a prompt to rename the currently active hotkey tab.

#### `renameHoldingTankTab()`
Opens a prompt to rename the currently active holding tank tab.

### Control Functions

#### `increaseFontSize()`
Increases the font size of song elements (max 25px).

#### `decreaseFontSize()`
Decreases the font size of song elements (min 5px).

#### `toggleWaveform()`
Toggles the waveform display with animation.

#### `toggleAdvancedSearch()`
Toggles the advanced search interface with animation.

### Modal Functions

#### `pickDirectory(event, element)`
Opens a directory picker dialog.

**Parameters:**
- `event` (Event) - The triggering event
- `element` (HTMLElement) - The element to update with the selected path

#### `installUpdate()`
Initiates application update installation.

#### `customConfirm(message, callback)`
Shows a custom confirmation dialog.

**Parameters:**
- `message` (string) - Confirmation message
- `callback` (Function) - Callback function to execute on confirmation

#### `customPrompt(title, message, defaultValue, callback)`
Shows a custom prompt dialog.

**Parameters:**
- `title` (string) - Dialog title
- `message` (string) - Dialog message
- `defaultValue` (string) - Default input value
- `callback` (Function) - Callback function to execute with the input value

## Dependencies

- **Bootstrap 5** - UI components; accessed via `bootstrap-adapter` (no jQuery plugins)
- **DOM Utilities** - `Dom` helper module for query/class helpers (no jQuery)
- **Animate.css** - CSS animations
- **Electron API** - System integration
- **Database** - Song data access
- **Store** - Persistent data storage

### Bootstrap 5 integration
- Use `bootstrap-adapter.js` to interact with Bootstrap JS APIs:
  - `showModal(selector)`, `hideModal(selector)`, `hideAllModals()`
  - `showTab(selector)`
  - `initTooltip(selector)`
- HTML uses `data-bs-*` attributes (e.g., `data-bs-toggle="tab"`, `data-bs-dismiss="modal"`).
- Close buttons are `.btn-close` (not `.close`).

Example:
```javascript
import { showModal, showTab, initTooltip } from './modules/ui/bootstrap-adapter.js';

showModal('#preferencesModal');
showTab('#hotkey_tabs li:nth-child(2) a');
initTooltip('[data-bs-toggle="tooltip"]');
```

## Error Handling

The module includes comprehensive error handling:

- **API Fallbacks** - Falls back to legacy APIs when modern APIs fail
- **Graceful Degradation** - Continues to work even if some features are unavailable
- **Console Logging** - Detailed logging for debugging
- **User Feedback** - Clear error messages and confirmations

## Testing

The module includes comprehensive testing capabilities:

```javascript
// Test UI module functionality
window.testUIModule = function() {
  console.log('🧪 Testing UI Module...');
  
  if (window.uiModule) {
    console.log('✅ UI Module is available');
    
    // Test core functions
    const functions = [
      'scaleScrollable',
      'editSelectedSong', 
      'deleteSelectedSong',
      'toggleSelectedRow',
      'increaseFontSize',
      'decreaseFontSize',
      'toggleWaveform',
      'toggleAdvancedSearch'
    ];
    
    functions.forEach(func => {
      if (typeof window.uiModule[func] === 'function') {
        console.log(`✅ ${func} is available`);
      } else {
        console.log(`❌ ${func} is NOT available`);
      }
    });
    
    console.log('✅ UI Module appears to be working correctly');
  } else {
    console.log('❌ UI Module not available');
  }
};
```

## Migration Notes

### From renderer.js

The UI module extracts the following functions from `renderer.js`:

**UI Manager:**
- `scale_scrollable()` → `scaleScrollable()`
- `editSelectedSong()` → `editSelectedSong()`
- `deleteSelectedSong()` → `deleteSelectedSong()`
- `closeAllTabs()` → `closeAllTabs()`

**Event Handlers:**
- `toggle_selected_row()` → `toggleSelectedRow()`
- `switchToHotkeyTab()` → `switchToHotkeyTab()`
- `renameHotkeyTab()` → `renameHotkeyTab()`
- `renameHoldingTankTab()` → `renameHoldingTankTab()`

**Controls:**
- `increaseFontSize()` → `increaseFontSize()`
- `decreaseFontSize()` → `decreaseFontSize()`
- `toggleWaveform()` → `toggleWaveform()`
- `toggleAdvancedSearch()` → `toggleAdvancedSearch()`

**Modals:**
- `pickDirectory()` → `pickDirectory()`
- `installUpdate()` → `installUpdate()`

### Backward Compatibility

All legacy function names are preserved for backward compatibility. The module can be used alongside existing code without breaking changes.

## Version History

- **v1.0.0** - Initial release with complete UI functionality extraction
- Modular architecture with clear separation of concerns
- Comprehensive error handling and fallback mechanisms
- Full backward compatibility with existing code 