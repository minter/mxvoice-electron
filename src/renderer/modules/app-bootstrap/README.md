# App Bootstrap Module

The App Bootstrap module handles the loading and initialization of all application modules. This module was extracted from the massive IIFE in renderer.js as part of the incremental modularization effort.

## Purpose

This module extracts the bootstrap functionality from renderer.js lines 299-1002, specifically:
- Module loading configuration
- Basic module importing
- Module registry management
- Error handling for module loading

## Current Status: Step 1

This is **Step 1** of the incremental bootstrap extraction. Currently contains:
- Basic module configuration
- Simple module loading logic

## Files

- `index.js` - Main module entry point with loadBasicModules function
- `module-config.js` - Configuration array for all application modules
- `README.md` - This documentation

## Usage

```javascript
import AppBootstrap from './modules/app-bootstrap/index.js';

// Load all modules using configuration
await AppBootstrap.loadBasicModules(
  AppBootstrap.moduleConfig, 
  moduleRegistry, 
  logInfo, 
  logError, 
  logWarn
);
```

## Next Steps

Future incremental extractions will add:
- Complex module instantiation logic
- Module wrapper functions
- Module initialization coordination
- Function registry setup
- Event manager initialization

## Integration

This module is designed to be a drop-in replacement for the module loading section in renderer.js, allowing for incremental testing and verification.

## Module Configuration

The `moduleConfig` array defines all application modules with:
- `name`: Registry key for the module
- `path`: Import path to the module
- `required`: Whether failure should stop the application

## Error Handling

- Required modules throw errors on failure
- Non-required modules log errors but continue loading
- All module loading attempts are logged for debugging
