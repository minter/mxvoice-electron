## Renderer Core Infrastructure

This directory contains renderer-wide infrastructure used by the feature modules in `modules/`.

### Key files

- `module-loader.js`
  - Dynamic ES module loader used for ad‑hoc imports
  - Caches loaded modules, tracks loaded set, exposes info/clear APIs
  - Exports: default singleton plus named helpers (`loadModule`, `getModule`, ...)

- `function-registry.js`
  - Central registry that exposes selected module functions on `window` for HTML/legacy bindings
  - Supports fallbacks, module‑registry wiring, and validation of required functions
  - Typical flow: set debug logger → set module registry → `registerAllFunctions()`

- `event-manager.js`
  - Replaces inline `onclick` attributes with proper event listeners
  - Wires UI buttons/links to registered functions; supports dynamic elements via `MutationObserver`
  - Usage: construct with `FunctionRegistry` and `debugLog`, then `initialize()`

- `function-monitor.js`
  - Periodic health checks for critical/global functions and per‑module functions
  - Logs issues, exposes health reports and stats, and tracks availability changes
  - Usage: construct with `FunctionRegistry` and `debugLog`, then `startMonitoring()`

### Services (`services/`)

Typed facades over secure preload APIs (via `window.electronAPI` or secure adapters) for clean usage in modules:

- `database.js`: `database.query(sql, params)`, `getSongById(id)`, etc.
- `file-system.js`: `fileSystem.read`, `write`, `exists`, `readdir`, `stat`, `copy`, `delete` (backed by secure adapters)
- `path.js`: `path.join/dirname/basename/extname/resolve/parse` (secure adapter)
- `store.js`: `store.has/get/set/delete` (secure adapter)

### How these work together

1. App initialization/bootstrap loads feature modules into a module registry
2. `FunctionRegistry` registers selected functions onto `window`
3. `EventManager` attaches event listeners that call those functions
4. `FunctionMonitor` periodically validates availability and logs health
5. Feature modules consume `services/` for secure, preload‑mediated APIs

### Notes

- Context isolation is enabled; all privileged access goes through preload secure APIs
- Prefer consuming `services/` and module singletons rather than touching `window` directly

