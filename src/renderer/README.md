## Renderer Architecture

The renderer uses native ES modules with no bundler. `renderer.js` initializes logging and application state, loads feature modules through `modules/app-bootstrap`, and wires DOM events through `modules/event-coordination`.

### Boundaries

- Privileged operations use `window.secureElectronAPI`, exposed by the context-isolated preload.
- Runtime state lives in the `modules/shared-state.js` singleton.
- Feature modules receive collaborators through bootstrap dependencies and the internal module registry.
- The full module registry and shared-state singleton are exposed on `window` only in E2E mode.
- A limited set of functions remains on `window` because `src/index.html` still uses inline handlers.

### Lifecycle

1. Initialize logging and application state.
2. Load modules listed in `app-bootstrap/module-config.js`.
3. Initialize profile state, theme management, and feature modules.
4. Attach delegated DOM and main-process event handlers.
5. Register cleanup for animation, audio, and event-listener resources.

Renderer modules must not use Node.js APIs, raw IPC, `window.electronAPI`, `window.db`, or `window.store`.
