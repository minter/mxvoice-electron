# CLAUDE.md

## Project Overview

Mx. Voice — Electron desktop app for managing and playing audio tracks (live events, shows).
Vanilla JS + Bootstrap 5 renderer, no bundler. Native ES modules loaded via `<script type="module">`.

## Project Structure

- `src/main/` — Main process: app lifecycle, IPC handlers, database, file operations, auto-update
- `src/renderer/` — Renderer process: ~30 ES modules in `modules/`, loaded by bootstrap system
- `src/preload/` — Context-isolated IPC bridge. Bundled via esbuild (`npm run build:preload` required before start/test)
- `src/stylesheets/` — `index.css` (structural), `colors.css` (light/dark theme colors), `fonts.css`

## Architecture Gotchas

- **No bundler** — bare npm specifiers (`'package-name'`) don't resolve in renderer. Use relative paths to `.mjs`/`.js` files in `node_modules/dist/`, or load via `<script>` tag as a global.
- **npm packages as globals** — Howler, WaveSurfer, Mousetrap, DOMPurify are loaded via `<script>` tags in `index.html`, accessed as `window.Howl`, `window.WaveSurfer`, etc.
- **JSON can't be ES-imported** — Electron enforces strict MIME type checking. Use `.js` files with `export default` instead.
- **IPC responses are wrapped** — all `secureElectronAPI` calls return `{ success, data }` or `{ success, value }` objects, not raw values. Always unwrap before use.
- **Module registry requires `export default`** — the bootstrap loader (`app-bootstrap/index.js`) checks `module.default` to register modules in `window.moduleRegistry`.
- **Context isolation is ON** — `contextIsolation: true`, `nodeIntegration: false`. All main↔renderer communication goes through `secureElectronAPI` exposed via contextBridge in the preload.

## Database

- **SQLite via WASM** (`node-sqlite3-wasm`) — not a Node.js native binding. Tables: `categories`, `mrvoice` (songs).
- **Raw SQL via IPC** — renderer calls `secureDatabase.query(sql, params)` / `secureDatabase.execute()` which invoke main-process handlers. No ORM.
- **Schema auto-migration** — `CREATE TABLE IF NOT EXISTS` + idempotent `ALTER TABLE ADD COLUMN` for new columns. No migration framework.

## Profile System

- **Directory structure** — `userData/profiles/<SanitizedName>/` contains `preferences.json`, `state.json` (hotkeys/holding-tank), `hotkeys/` subdirectory.
- **Profile name sanitization is critical** — `sanitizeProfileName()` removes special chars. Inconsistent sanitization causes state to save/load from wrong directories.
- **"Default User"** — auto-created on first run. Cannot be deleted. Switched via launcher UI or `--profile=` CLI arg.
- **State persistence** — hotkeys/holding-tank auto-saved to `state.json` with restoration lock to prevent empty saves during app init.

## Dark/Light Theming

- Uses `data-bs-theme` attribute on `<html>` (Bootstrap 5 standard). System preference detected via `matchMedia`.
- User preference stored per-profile as `screen_mode` (auto/light/dark).
- Structural styles in `index.css`, color-dependent styles in `colors.css` (separate light/dark sections).

## State Management

- **Shared state** — `window.sharedState` (singleton Map) holds runtime state: currentSong, hotkeys, holding-tank data, animation frame IDs.
- **Cross-module events** — modules communicate via `window.addEventListener('custom-event')` for search, categories, audio control.

## Auto-Update

- **electron-updater + GitHub releases** — release notes fetched and sanitized via DOMPurify before display.
- **Prerelease builds** — controlled by `EP_PRE_RELEASE` env var and per-profile `prerelease_updates` preference.

## Adding New Modules

1. Create module in `src/renderer/modules/<name>/index.js` with `export default`
2. Register in `src/renderer/modules/app-bootstrap/module-config.js`
3. For menu-triggered features: add IPC handler in `src/preload/modules/secure-api-exposer.cjs`, menu item in `src/main/modules/app-setup.js` (both macOS and Windows/Linux sections), listener in `src/renderer.js`

## What's New Tour

When adding user-facing features, add tour steps to `src/renderer/modules/whats-new/tours.js` keyed by release version. Register helper functions in `src/renderer/modules/whats-new/index.js` via `tourManager.registerHelper()` for steps that need to open modals or set up UI. Before release, update the version key in `tours.js` to match `package.json`.

## Commands

- `npm run build:preload` — bundle preload script (required before start/test/build)
- `npm start` — build preload + launch app in dev mode
- `npm run test:unit` / `npx vitest run` — run unit tests
- `npm test` / `npx playwright test` — run E2E tests
- `npx eslint src/` — lint source files (not in CI)
- `npm run build` — package app via electron-builder
- `npm run release:mac` / `release:win` / `release:linux` — signed production builds

## Testing Patterns

- **Unit tests** (Vitest): `tests/unit/renderer/` and `tests/unit/main/`. Mock `window.secureElectronAPI` and `window.debugLog` in test setup.
- **E2E tests** (Playwright): `tests/e2e/seeded/` for tests with pre-populated data. Use `launchSeededApp(electron, 'suite-name')` and `waitForAppReady(page, app)` from `tests/utils/seeded-launch.js`.
- **Test isolation** — main process checks `APP_TEST_MODE=1` or `E2E_USER_DATA_DIR` env var and overrides `userData` path before Store creation.
- Test files in `tests/` are eslint-ignored by config — this is expected.

## Build & Packaging

- **electron-builder** — DMG+ZIP (macOS), NSIS (Windows), AppImage+deb (Linux). Config in `package.json`.
- **Code signing** — macOS: hardened runtime + notarization. Windows: YubiKey smart card via `build/signAllWindows.cjs`.
- **ASAR enabled** with embedded integrity validation. WASM files unpacked explicitly.

## CI/CD

- **GitHub Actions** — E2E tests (Playwright on macOS/Windows), unit tests (Vitest on Ubuntu), CodeQL security scanning. Runs on PRs and pushes to main.

## Code Style

- Renderer modules use `window.debugLog?.info/warn/error()` for logging with `{ module, function }` context objects
- Bootstrap modals: use `safeShowModal`/`safeHideModal` from `src/renderer/modules/ui/bootstrap-helpers.js`
- Profile preferences: `secureElectronAPI.profile.getPreference(key)` / `setPreference(key, value)` — returns wrapped `{ success, value }`
- F1-F12 keys bound via Mousetrap for hotkey playback; Delete/Backspace to clear
