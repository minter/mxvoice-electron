# Secure Renderer Adapters

`secure-adapter.js` provides small, consistent wrappers over `window.secureElectronAPI` for database, filesystem, path, store, audio, analytics, utility, and file-dialog operations.

Adapter methods catch rejected or unavailable preload calls and return `{ success: false, error }`, allowing feature modules to use one response shape. The adapter does not support insecure contexts, direct IPC, or the removed `window.electronAPI` facade.

The preload surface is intentionally narrow. When adding an adapter method, add the corresponding vetted preload method and update the preload-surface contract tests.
