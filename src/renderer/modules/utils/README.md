# Utils Module

The Utils module provides utility functions for the MxVoice Electron application. This module contains common functionality that is used across multiple parts of the application.

## Structure

```
utils/
├── animation-utils.js    # CSS animation utilities
├── modal-utils.js        # Modal dialog utilities
├── validation-utils.js   # Data validation utilities
├── index.js             # Main module entry point
└── README.md            # This file
```

## Components

### Animation Utilities (`animation-utils.js`)

Provides CSS animation functionality.

**Functions:**
- `animateCSS(element, animation, speed, prefix)` - Animate an element using CSS animations

**Usage:**
```javascript
const { animateCSS } = require('./utils');
animateCSS($('#element'), 'fadeIn', '1s');
```

### Modal Utilities (`modal-utils.js`)

Provides custom modal dialog functionality to replace native browser dialogs.

**Functions:**
- `customConfirm(message, callback)` - Show a custom confirmation dialog
- `customPrompt(title, message, defaultValue, callback)` - Show a custom prompt dialog
- `restoreFocusToSearch()` - Restore focus to search fields after modal dismissal

**Usage:**
```javascript
const { customConfirm, customPrompt } = require('./utils');

customConfirm('Are you sure?', () => {
  console.log('User confirmed');
});

customPrompt('Enter name', 'Name:', 'Default', (value) => {
  console.log('User entered:', value);
});
```

### Validation Utilities (`validation-utils.js`)

Provides data validation functions for common data types.

**Functions:**
- `isValidSongId(songId)` - Validate song ID format
- `isValidCategoryCode(categoryCode)` - Validate category code format
- `isValidFilePath(filePath)` - Validate file path format
- `isValidHotkey(hotkey)` - Validate hotkey format

**Usage:**
```javascript
const { isValidSongId, isValidHotkey } = require('./utils');

if (isValidSongId('123')) {
  console.log('Valid song ID');
}

if (isValidHotkey('f1')) {
  console.log('Valid hotkey');
}
```

## Module Interface

The main module provides a unified interface for all utilities:

```javascript
const utils = require('./utils');

// Access individual utilities
utils.animateCSS(element, 'fadeIn');
utils.customConfirm('Are you sure?', callback);
utils.isValidSongId('123');

// Or use the module instance
const utilsModule = utils.utils;
utilsModule.animateCSS(element, 'fadeIn');
```

## Testing

The module includes built-in testing functionality:

```javascript
const utils = require('./utils');

// Test all utilities
const testResults = utils.utils.test();
console.log(testResults);
```

## Integration with Module Loader

The Utils module can be integrated with the Module Loader:

```javascript
const utils = require('./utils');
const { loader } = require('../module-loader');

// Register the utils module
loader.registerModule('utils', utils.utils);

// Load the utils module
const loadedUtils = loader.loadModule('utils');

// Use the loaded utils
loadedUtils.animateCSS(element, 'fadeIn');
```

## Dependencies

- **jQuery**: Required for DOM manipulation and animations
- **Bootstrap**: Required for modal functionality
- **Animate.css**: Required for CSS animations

## Migration from renderer.js

The following functions were extracted from `renderer.js`:

- `animateCSS()` → `animation-utils.js`
- `customConfirm()` → `modal-utils.js`
- `customPrompt()` → `modal-utils.js`
- `restoreFocusToSearch()` → `modal-utils.js`

## Future Enhancements

- Add more validation functions for different data types
- Add animation presets for common animations
- Add modal templates for common dialog types
- Add unit tests for all utility functions

## Notes

- All functions maintain the same interface as the original renderer.js functions
- The module is designed to be backward compatible
- Functions are exported both individually and as part of the module instance
- The module includes comprehensive error handling and logging 