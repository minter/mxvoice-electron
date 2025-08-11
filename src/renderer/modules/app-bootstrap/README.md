## App Bootstrap Module

The `app-bootstrap` module centralizes loading, instantiation, and initialization of renderer modules using a declarative configuration. It was extracted from the large inline bootstrap in `renderer.js` as part of incremental modularization.

### What it does
- Loads modules listed in a configuration array
- Instantiates or initializes them with shared dependencies
- Calls an optional `init()` method on each module instance
- Stores results in a provided module registry by `name`
- Enforces `required` semantics (throw vs continue)
- Uses provided logging functions for consistent output

### Current status
This is Step 1 of the extraction. It includes:
- Basic module configuration (`module-config.js`)
- A simple, predictable loader with instantiation rules

## Files
- `index.js` – main entry with `loadBasicModules`
- `module-config.js` – configuration for modules to load
- `README.md` – this guide

## API

### `loadBasicModules(config, moduleRegistry, logInfo, logError, logWarn, dependencies?)`
Loads modules from `config`, wiring them into `moduleRegistry`.

- `config`: Array of `{ name, path, required }` entries (see Module configuration below)
- `moduleRegistry`: Object that will receive loaded modules under `moduleRegistry[name]`
- `logInfo`, `logError`, `logWarn`: Functions used for logging progress and errors
- `dependencies` (optional): Object injected into modules on construction/initialization

Behavior per module export shape:
- Default export is a class: `new DefaultExport(dependencies)`
- Default export is a function: `DefaultExport(dependencies)`
- Default export is a value/object: used as-is

If the resulting `moduleInstance` exposes `init()`, it will be awaited.

Error handling:
- If `required: true`, load/instantiation/init errors are thrown
- If `required: false`, the error is logged and loading continues

Dependency injection defaults:
- Merges `{ electronAPI: window.electronAPI, debugLog: window.debugLog }` with your provided `dependencies`

Return value: resolves when all modules have been processed.

## Module configuration

`module-config.js` exports `moduleConfig`, an array of entries shaped like:

```javascript
{ name: 'ui', path: '../ui/index.js', required: true }
```

- **name**: Key used in `moduleRegistry`
- **path**: ES module path relative to this module
- **required**: Whether a failure should halt bootstrap

The default configuration includes core modules like `ui`, `preferences`, `holdingTank`, and more.

## Usage

### Basic
```javascript
import AppBootstrap from './modules/app-bootstrap/index.js';

const moduleRegistry = {};
await AppBootstrap.loadBasicModules(
  AppBootstrap.moduleConfig,
  moduleRegistry,
  window.logInfo,
  window.logError,
  window.logWarn
);
```

### With explicit dependencies (recommended)
This mirrors current `renderer.js` usage and ensures modules receive shared services.

```javascript
import AppBootstrap from './modules/app-bootstrap/index.js';

const moduleRegistry = {};
await AppBootstrap.loadBasicModules(
  AppBootstrap.moduleConfig,
  moduleRegistry,
  window.logInfo,
  window.logError,
  window.logWarn,
  {
    electronAPI: window.electronAPI,
    db: window.db,
    store: window.store,
    debugLog: window.debugLog
  }
);
```

### Consuming loaded modules
```javascript
const ui = moduleRegistry.ui; // instance or value depending on the module
if (ui && typeof ui.render === 'function') {
  ui.render();
}
```

## Notes and limitations
- Loader expects each module to export a default (class/function/value)
- If a module needs initialization logic, expose an `init()` method
- Logging is delegated to the provided `logInfo`/`logError`/`logWarn`
- `required` modules should be limited to those essential for app startup

## Extending
To add a new module, add an entry to `module-config.js` with its `name`, `path`, and `required` flag. The loader will handle construction and `init()` automatically.
