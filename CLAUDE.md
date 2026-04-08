# CLAUDE.md

## Project Overview

Mx. Voice — Electron desktop app for managing and playing audio tracks (live events, shows).
Vanilla JS + Bootstrap 5 renderer, no bundler. Native ES modules loaded via `<script type="module">`.

## Architecture Gotchas

- **No bundler** — bare npm specifiers (`'package-name'`) don't resolve in renderer. Use relative paths to `.mjs`/`.js` files in `node_modules/dist/`, or load via `<script>` tag as a global.
- **npm packages as globals** — Howler, WaveSurfer, Mousetrap, DOMPurify are loaded via `<script>` tags in `index.html`, accessed as `window.Howl`, `window.WaveSurfer`, etc.
- **JSON can't be ES-imported** — Electron enforces strict MIME type checking. Use `.js` files with `export default` instead.
- **IPC responses are wrapped** — all `secureElectronAPI` calls return `{ success, data }` or `{ success, value }` objects, not raw values. Always unwrap before use.
- **Module registry requires `export default`** — the bootstrap loader (`app-bootstrap/index.js`) checks `module.default` to register modules in `window.moduleRegistry`.

## Adding New Modules

1. Create module in `src/renderer/modules/<name>/index.js` with `export default`
2. Register in `src/renderer/modules/app-bootstrap/module-config.js`
3. For menu-triggered features: add IPC handler in `src/preload/modules/secure-api-exposer.cjs`, menu item in `src/main/modules/app-setup.js` (both macOS and Windows/Linux sections), listener in `src/renderer.js`

## What's New Tour

When adding user-facing features, add tour steps to `src/renderer/modules/whats-new/tours.js` keyed by release version. Register helper functions in `src/renderer/modules/whats-new/index.js` via `tourManager.registerHelper()` for steps that need to open modals or set up UI. Before release, update the version key in `tours.js` to match `package.json`.

## Commands

- `npx vitest run` — run all unit tests
- `npx vitest run tests/unit/renderer/<file>.test.js` — run specific unit test
- `npx playwright test` — run all E2E tests
- `npx playwright test tests/e2e/seeded/<path>.spec.js` — run specific E2E test
- `npx eslint src/` — lint source files

## Testing Patterns

- **Unit tests** (Vitest): `tests/unit/renderer/` and `tests/unit/main/`. Mock `window.secureElectronAPI` and `window.debugLog` in test setup.
- **E2E tests** (Playwright): `tests/e2e/seeded/` for tests with pre-populated data. Use `launchSeededApp(electron, 'suite-name')` and `waitForAppReady(page, app)` from `tests/utils/seeded-launch.js`.
- Test files in `tests/` are eslint-ignored by config — this is expected.

## Code Style

- Renderer modules use `window.debugLog?.info/warn/error()` for logging with `{ module, function }` context objects
- Bootstrap modals: use `safeShowModal`/`safeHideModal` from `src/renderer/modules/ui/bootstrap-helpers.js`
- Profile preferences: `secureElectronAPI.profile.getPreference(key)` / `setPreference(key, value)` — returns wrapped `{ success, value }`
