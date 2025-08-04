# Hotkeys Module

## Overview

The Hotkeys Module provides comprehensive F1-F12 hotkey functionality for quick song access in Mx. Voice. It manages hotkey assignment, playback, file import/export, and tab management with full backward compatibility.

## Key Features

### 🎹 F1-F12 Support
- 12 function key hotkeys for instant song access
- Visual hotkey assignment with drag & drop
- Direct playback from hotkeys

### 📁 File Import/Export
- Save/load hotkey configurations to files
- Backup and restore hotkey states
- Import/export functionality for sharing configurations

### 🏷️ Tab Management
- Multiple hotkey sets (5 tabs)
- Tab renaming functionality
- Tab switching with keyboard shortcuts

### 🎯 Drag & Drop
- Visual hotkey assignment
- Drag songs from search results to hotkeys
- Intuitive user interface

### 💾 Store Persistence
- Automatic saving of hotkey state
- Legacy format compatibility
- Store API integration

## Module Structure

```
hotkeys/
├── index.js           # Main module class
├── hotkey-data.js     # Data management functions
├── hotkey-operations.js # File operations and playback
├── hotkey-ui.js       # UI operations and drag & drop
└── README.md          # This documentation
```

## Core Functions (12 total)

### Core Functions (3)
- `saveHotkeysToStore()` - Save hotkey state to store
- `loadHotkeysFromStore()` - Load hotkey data from store
- `initHotkeys()` - Initialize hotkey module

### Data Management (3)
- `populateHotkeys(fkeys, title)` - Populate hotkeys with song data
- `setLabelFromSongId(song_id, element)` - Set hotkey label from song
- `clearHotkeys()` - Clear all hotkeys

### File Operations (2)
- `openHotkeyFile()` - Open hotkey file for import
- `saveHotkeyFile()` - Save hotkeys to file

### Playback Functions (2)
- `playSongFromHotkey(hotkey)` - Play song from hotkey
- `sendToHotkeys()` - Send selected song to hotkey

### UI Operations (2)
- `hotkeyDrop(event)` - Handle drag and drop for hotkeys
- `allowHotkeyDrop(event)` - Allow hotkey drop events

### Tab Management (2)
- `switchToHotkeyTab(tab)` - Switch between hotkey tabs
- `renameHotkeyTab()` - Rename hotkey tab

## Usage

### Basic Initialization

```javascript
const HotkeysModule = require('./modules/hotkeys');

const hotkeys = new HotkeysModule({
  electronAPI: window.electronAPI,
  db: db,
  store: store
});
```

### Core Operations

```javascript
// Save hotkeys to store
hotkeys.saveHotkeysToStore();

// Load hotkeys from store
hotkeys.loadHotkeysFromStore();

// Clear all hotkeys
hotkeys.clearHotkeys();

// Play song from F1 hotkey
hotkeys.playSongFromHotkey('f1');

// Send selected song to hotkeys
hotkeys.sendToHotkeys();
```

### File Operations

```javascript
// Open hotkey file
hotkeys.openHotkeyFile();

// Save hotkey file
hotkeys.saveHotkeyFile();

// Export configuration
const config = hotkeys.exportHotkeyConfig();

// Import configuration
hotkeys.importHotkeyConfig(config);
```

### Tab Management

```javascript
// Switch to tab 2
hotkeys.switchToHotkeyTab(2);

// Rename current tab
hotkeys.renameHotkeyTab();

// Get active tab
const activeTab = hotkeys.getActiveHotkeyTab();
```

### Data Management

```javascript
// Populate hotkeys with data
hotkeys.populateHotkeys({
  f1: 'song_id_1',
  f2: 'song_id_2'
}, 'My Hotkeys');

// Set label for specific hotkey
hotkeys.setLabelFromSongId('song_id_1', $('#f1_hotkey'));

// Get hotkey data
const data = hotkeys.getHotkeyData();
```

## API Reference

### Main Module Class

#### `HotkeysModule(options)`
Creates a new hotkeys module instance.

**Parameters:**
- `options.electronAPI` - Electron API object
- `options.db` - Database object
- `options.store` - Store object

#### `getAllHotkeyFunctions()`
Returns all hotkey functions for external use.

**Returns:** Object containing all hotkey functions

#### `testAllFunctions()`
Tests all hotkey functions and returns results.

**Returns:** Test results object

### Data Management

#### `populateHotkeys(fkeys, title, options)`
Populates hotkeys with song data.

**Parameters:**
- `fkeys` - Object containing hotkey data
- `title` - Title for the hotkey tab
- `options` - Options object with dependencies

#### `setLabelFromSongId(song_id, element, options)`
Updates hotkey label with song information.

**Parameters:**
- `song_id` - Song ID
- `element` - Hotkey element to update
- `options` - Options object with dependencies

#### `clearHotkeys(options)`
Removes all song assignments from hotkeys.

**Parameters:**
- `options` - Options object with dependencies

### File Operations

#### `openHotkeyFile(options)`
Imports hotkey configuration from file.

**Parameters:**
- `options` - Options object with dependencies

#### `saveHotkeyFile(options)`
Exports hotkey configuration to file.

**Parameters:**
- `options` - Options object with dependencies

#### `exportHotkeyConfig()`
Creates a configuration object for export.

**Returns:** Hotkey configuration object

#### `importHotkeyConfig(config, options)`
Applies imported configuration to hotkeys.

**Parameters:**
- `config` - Hotkey configuration object
- `options` - Options object with dependencies

### Playback Functions

#### `playSongFromHotkey(hotkey, options)`
Plays the song assigned to the specified hotkey.

**Parameters:**
- `hotkey` - Hotkey identifier (e.g., 'f1', 'f2')
- `options` - Options object with dependencies

#### `sendToHotkeys(options)`
Assigns the currently selected song to the first empty hotkey slot.

**Parameters:**
- `options` - Options object with dependencies

**Returns:** False to prevent default behavior

### UI Operations

#### `hotkeyDrop(event, options)`
Processes drag and drop for hotkey assignment.

**Parameters:**
- `event` - Drop event
- `options` - Options object with dependencies

#### `allowHotkeyDrop(event)`
Enables drop functionality for hotkeys.

**Parameters:**
- `event` - Drag over event

### Tab Management

#### `switchToHotkeyTab(tab)`
Changes the active hotkey tab.

**Parameters:**
- `tab` - Tab number to switch to

#### `renameHotkeyTab(options)`
Allows user to rename the current hotkey tab.

**Parameters:**
- `options` - Options object with dependencies

## Event Listeners

The module automatically sets up the following event listeners:

### Click Events
- Single-click selects hotkey if it has a song assigned
- Double-click plays the song assigned to the hotkey

### Drag & Drop Events
- Drag over adds visual feedback
- Drop assigns song to hotkey
- Drag leave removes visual feedback

### Tab Events
- Double-click on tab allows renaming

## Store Integration

The module integrates with the Electron store API for persistence:

### Save Operations
- Automatically saves hotkey state when changes occur
- Only saves new HTML format with header button
- Falls back to legacy store access if needed

### Load Operations
- Loads saved hotkey state on initialization
- Handles legacy format migration
- Clears old format to load new HTML

## Backward Compatibility

The module maintains full backward compatibility:

### Legacy API Support
- Falls back to `ipcRenderer` for file operations
- Uses legacy database access when needed
- Supports old store format migration

### Hybrid Approach
- Tests modern API first
- Falls back to legacy methods
- Provides consistent interface

## Testing

### Browser Tests
Run `test-hotkeys-module-browser.js` for browser-based testing.

### Interactive Tests
Use `test-hotkeys-module-page.html` for interactive testing.

### Function Tests
Call `testAllFunctions()` to test all hotkey functions.

## Error Handling

The module includes comprehensive error handling:

### API Failures
- Graceful fallback to legacy methods
- Console warnings for debugging
- User-friendly error messages

### Data Validation
- Validates hotkey data format
- Checks for required dependencies
- Handles missing elements gracefully

## Performance Considerations

### Efficient Operations
- Debounced store saves
- Minimal DOM manipulation
- Optimized event handling

### Memory Management
- Proper event listener cleanup
- Efficient data structures
- Minimal object creation

## Security Features

### Input Validation
- Validates hotkey identifiers
- Sanitizes user input
- Prevents XSS attacks

### API Security
- Uses contextBridge for safe API access
- Validates all external data
- Implements proper error boundaries

## Migration Guide

### From Legacy Code
1. Replace direct function calls with module methods
2. Update event listener setup
3. Test backward compatibility

### To New API
1. Use modern Electron API when available
2. Implement hybrid approach
3. Maintain legacy support

## Troubleshooting

### Common Issues

#### Hotkeys Not Saving
- Check store API availability
- Verify HTML format compatibility
- Check console for errors

#### Drag & Drop Not Working
- Ensure event listeners are set up
- Check element selectors
- Verify drop target configuration

#### Playback Issues
- Check song ID validity
- Verify database connection
- Test playback function availability

### Debug Functions

```javascript
// Test all functions
hotkeys.testAllFunctions();

// Check hotkey data
console.log(hotkeys.getHotkeyData());

// Validate configuration
console.log(hotkeys.validateHotkeyData(data));
```

## Future Enhancements

### Planned Features
- Hotkey profiles
- Advanced configuration options
- Enhanced UI feedback
- Performance optimizations

### API Extensions
- Additional file formats
- Cloud sync integration
- Advanced playback controls
- Custom hotkey mappings

## Contributing

When contributing to the hotkeys module:

1. Follow the existing code structure
2. Add comprehensive documentation
3. Include error handling
4. Test backward compatibility
5. Update this README

## License

This module is part of the Mx. Voice application and follows the same licensing terms. 