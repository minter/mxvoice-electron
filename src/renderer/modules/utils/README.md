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
import { animateCSS } from './utils/index.js';
animateCSS($('#element'), 'fadeIn', '1s');
```

### Modal Utilities (`modal-utils.js`)

Provides custom modal dialog functionality to replace native browser dialogs.
Dialogs use Bootstrap 5 via the UI `bootstrap-adapter` (no jQuery plugins).

**Functions:**
- `customConfirm(message, callback)` - Show a custom confirmation dialog
- `customPrompt(title, message, defaultValue, callback)` - Show a custom prompt dialog
- `restoreFocusToSearch()` - Restore focus to search fields after modal dismissal

**Usage:**
```javascript
import { customConfirm, customPrompt } from './utils/index.js';

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
import { isValidSongId, isValidHotkey } from './utils/index.js';

if (isValidSongId('123')) {
  console.log('Valid song ID');
}

if (isValidHotkey('f1')) {
  console.log('Valid hotkey');
}
```

## Module Interface

Default export is a singleton with bound methods. Named bindings are also exported for direct import.

```javascript
import utils, { animateCSS, customConfirm } from './modules/utils/index.js';

animateCSS(element, 'fadeIn');
utils.customPrompt('Enter', 'Name', 'Default', (v) => console.log(v));
```

## Testing

The module includes built-in testing functionality:

```javascript
import utils from './utils/index.js';

// Test all utilities
const testResults = utils.utils.test();
console.log(testResults);
```

## Integration
Loaded via App Bootstrap per `module-config.js` and stored in the module registry as `utils`.

## Dependencies

- **Bootstrap 5**: Modal functionality via `bootstrap-adapter`
- **jQuery**: Used for DOM manipulation and animations
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