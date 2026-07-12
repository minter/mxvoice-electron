## App Bootstrap Module

`app-bootstrap` loads renderer modules from the declarative list in `module-config.js`, initializes each default export, and stores the result in the internal module registry.

`loadBasicModules(config, moduleRegistry, logInfo, logError, logWarn, dependencies)` supports default exports that are classes, initializer functions, or values. If an initialized module exposes `init()`, bootstrap awaits it.

- Required module failures stop startup.
- Optional module failures are logged and startup continues.
- Dependencies supplied by `renderer.js` include `electronAPI`, `debugLog`, and the internal `moduleRegistry` where needed.
- Renderer modules must export a default value to participate in bootstrap.

To add a module, create its entry point and add `{ name, path, required }` to `module-config.js`.
