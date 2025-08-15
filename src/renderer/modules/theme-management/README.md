# Theme Management Module

The Theme Management module provides comprehensive theme switching functionality for the MxVoice application. It handles dark/light mode based on user preferences and system settings.

## Features

- **User Preference Support**: Respects user's choice of "Auto", "Light", or "Dark"
- **System Theme Detection**: Automatically detects and follows system theme changes when "Auto" is selected
- **Dynamic Theme Switching**: Themes can be changed at runtime without page reload
- **CSS Class Management**: Applies theme-specific CSS classes to the document body
- **Event System**: Emits custom events when themes change for other modules to listen to

## Module Structure

```
theme-management/
├── index.js              # Main module entry point
└── README.md            # This documentation
```

## API Reference

### Core Functions

#### `initThemeManagement(options)`
Initializes the theme management module.

**Parameters:**
- `options.preferencesModule` - Reference to the preferences module for loading user settings

**Returns:** `Promise<Object>` - Initialization result

#### `setUserTheme(theme)`
Sets the user's theme preference.

**Parameters:**
- `theme` (string) - Theme to set: 'auto', 'light', or 'dark'

**Returns:** `Promise<Object>` - Operation result

#### `getCurrentTheme()`
Gets the currently active theme.

**Returns:** `string` - Current theme ('light' or 'dark')

#### `getUserThemePreference()`
Gets the user's theme preference setting.

**Returns:** `string` - User preference ('auto', 'light', or 'dark')

#### `getSystemTheme()`
Gets the system's current theme.

**Returns:** `string` - System theme ('light' or 'dark')

### Utility Functions

#### `isDarkTheme()`
Checks if dark theme is currently active.

**Returns:** `boolean` - True if dark theme is active

#### `isLightTheme()`
Checks if light theme is currently active.

**Returns:** `boolean` - True if light theme is active

#### `isAutoTheme()`
Checks if user preference is set to auto.

**Returns:** `boolean` - True if auto theme is selected

#### `refreshTheme()`
Refreshes the theme by reloading preferences and reapplying.

**Returns:** `Promise<Object>` - Refresh result

## Usage

### Basic Initialization

```javascript
import themeManagement from './modules/theme-management/index.js';

// Initialize with preferences module
await themeManagement.initThemeManagement({
  preferencesModule: window.preferencesModule
});
```

### Theme Switching

```javascript
// Set user preference to dark mode
await themeManagement.setUserTheme('dark');

// Check current theme
if (themeManagement.isDarkTheme()) {
  console.log('Dark theme is active');
}
```

### Listening to Theme Changes

```javascript
// Listen for theme changes
document.addEventListener('themeChanged', (event) => {
  const { theme, userPreference, systemTheme } = event.detail;
  console.log(`Theme changed to: ${theme}`);
  console.log(`User preference: ${userPreference}`);
  console.log(`System theme: ${systemTheme}`);
});
```

## Theme Behavior

### Auto Mode
- Follows system theme preference
- Automatically updates when system theme changes
- Uses `@media (prefers-color-scheme: dark)` for detection

### Light Mode
- Forces light theme regardless of system preference
- Overrides system theme changes

### Dark Mode
- Forces dark theme regardless of system preference
- Overrides system theme changes

## CSS Integration

The module applies theme classes to the document body:

- `.theme-light` - Applied when light theme is active
- `.theme-dark` - Applied when dark theme is active

These classes can be used for theme-specific CSS rules:

```css
/* Light theme styles */
.theme-light {
  --background-color: #ffffff;
  --text-color: #000000;
}

/* Dark theme styles */
.theme-dark {
  --background-color: #1a1a1a;
  --text-color: #ffffff;
}
```

## Dependencies

- **Preferences Module**: For loading and saving user theme preferences
- **Debug Logger**: For logging theme operations and errors
- **DOM APIs**: For applying themes and detecting system changes

## Error Handling

The module includes comprehensive error handling:

- **Graceful Fallbacks**: Falls back to light theme if system detection fails
- **Preference Fallbacks**: Uses 'auto' theme if preferences module is unavailable
- **Logging**: Detailed logging for debugging theme issues
- **Event Safety**: Safe event emission with error boundaries

## Testing

The module includes built-in testing capabilities:

```javascript
// Test all functions
const testResults = themeManagement.test();
console.log(testResults);

// Get module information
const info = themeManagement.getInfo();
console.log(info);
```

## Version History

### v1.0.0
- Initial module implementation
- Complete theme switching functionality
- System theme detection
- User preference management
- CSS class integration
- Event system for theme changes

## Contributing

When contributing to the Theme Management module:

1. **Maintain Theme Consistency**: Ensure all theme changes are properly applied
2. **Handle Edge Cases**: Consider system theme detection failures
3. **Update Documentation**: Keep README.md current with any changes
4. **Test Thoroughly**: Verify themes work across different scenarios
