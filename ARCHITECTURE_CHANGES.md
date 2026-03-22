# Architecture Changes & Remaining Concerns

*Last updated: 2026-03-21*

---

## Completed Fixes

### 1. N+1 Database Query Patterns (commit 29eb56d)

Batch-optimized database access across 6 renderer modules. Reduced ~200+ queries per operation down to 1-2.

| Module | Before | After |
|--------|--------|-------|
| `holding-tank/index.js` | N individual SELECTs to populate tank | Single `WHERE id IN (...)` batch query |
| `categories/category-data.js` | Per-song category description lookup | `sharedState` cache populated once at init |
| `song-management/song-crud.js` | Follow-up SELECT after INSERT to get ID | Use `lastInsertRowid` from INSERT result |
| `categories/category-data.js` | Recursive collision check loop | Single `findUniqueCategoryCode` helper query |
| `bulk-operations/bulk-operations.js` | Per-song UPDATE in loop | Batch `WHERE id IN` updates |
| `database/data-population.js` | Category description lookup per row | Read from `sharedState.categories` cache |

**Files changed:**
- `src/renderer/modules/bulk-operations/bulk-operations.js`
- `src/renderer/modules/categories/category-data.js`
- `src/renderer/modules/categories/category-operations.js`
- `src/renderer/modules/database/data-population.js`
- `src/renderer/modules/database/database-operations.js`
- `src/renderer/modules/song-management/song-crud.js`

### 2. Test Suite Performance (commit a388eb4)

- Hidden windows during test runs (`show: false` in test launch config)
- 4 parallel Playwright workers
- Runtime reduced from ~10 min to ~2.7 min locally

### 3. CI Test Stability (commits 66c6dda through 6a5c7f9)

Hardened 20+ tests across macOS, Windows, and Linux CI runners:
- Timeouts: `test.slow()` for tests that launch fresh Electron apps or play audio
- Race conditions: `waitForFunction` guards for FunctionRegistry init timing
- Windows: Isolated `test-user-data-modal` directory to prevent parallel test conflicts
- Windows: `evaluate()` for form input (avoids Playwright `clear()`/`fill()` race)
- macOS: `beforeEach` modal backdrop cleanup in holding tank suite
- Linux: `evaluate()` fallback for drag-and-drop (xvfb `dataTransfer` unreliable)
- Cross-platform: Flexible assertions for audio timing (`0:0[01]`, `-0:0[456]`)

### 4. Raw SQL via IPC Eliminated (commit 8133f0c)

Removed `database-query` and `database-execute` IPC handlers that accepted arbitrary SQL from the renderer. Replaced with named operations only.

**New IPC handlers added:** `search-songs`, `get-category-by-code`, `get-songs-by-ids`, `reassign-song-category`, `find-category-codes-like`, `count-songs`

**Existing handlers fixed:**
- `add-song`: Added missing `info` field
- `delete-category`: Fixed `UNCATEGORIZED` → `UNC` mismatch, ensured UNC category exists before reassignment
- `update-song`: Dynamic SET clause to only update provided fields (prevents NULLing unspecified columns)

**~30 renderer call sites** migrated across 18 files. Zero raw SQL strings remain in `src/renderer/`.

**Files changed:** `ipc-handlers.js`, `secure-api-exposer.cjs`, `api-exposer.cjs`, `secure-adapter.js`, `database-operations.js`, `database/index.js`, `services/database.js`, `search-engine.js`, `live-search.js`, `song-crud.js`, `song-removal.js`, `bulk-operations.js`, `category-operations.js`, `category-data.js`, `data-population.js`, `hotkey-data.js`, `hotkeys/index.js`, `holding-tank/index.js`, `audio-manager.js`, `profile-state/index.js`, `dom-initialization.js`, `test-utils/index.js`

### 5. HTML Sanitization (commit 8133f0c)

Added DOMPurify sanitization and safe DOM methods to all `innerHTML` sites that interpolate user/file data.

| File | Fix |
|------|-----|
| `audio-manager.js` (4 sites) | Converted to `createElement` + `createTextNode` |
| `category-ui.js` | DOMPurify + replaced inline `onclick` with `addEventListener` |
| `modal-utils.js` | DOMPurify sanitization of `title` and `message` params |
| `hotkey-operations.js`, `hotkeys/index.js` | DOMPurify wrapping of stored HTML from electron-store |
| `search-engine.js` | Converted static spinner to DOM methods |

Remaining safe `innerHTML` usages (clearing with `= ''`, static HTML) are unchanged.

### 6. Async File I/O Migration (commit 426735b)

Replaced all 21 synchronous fs calls in `profile-backup-manager.js` (`existsSync`, `mkdirSync`, `rmSync`) with async equivalents (`fs.promises.access`, `fs.promises.mkdir`, `fs.promises.rm`). Backup operations no longer block the main Electron process.

Added `pathExists()` async helper. Simplified idempotent operations (recursive mkdir, force rm). Removed unused `promisify` import and replaced `promisify()` wrappers with direct `fs.promises` calls.

**Files changed:** `src/main/modules/profile-backup-manager.js`, `src/main/index-modular.js`

### 7. Event Listener Leak Fixes (commit e4c3a75)

Added `AbortController`-based lifecycle management to the two modules with actual listener leaks. Previous controller is aborted before each re-initialization, preventing listener accumulation.

| Module | Fix |
|--------|-----|
| `drag-drop/event-handlers.js` | Module-level AbortController; all holding tank + column header + drop zone listeners use `{ signal }` |
| `hotkeys/hotkey-ui.js` | Module-level AbortController; drop, dragover, dragleave, and tab dblclick listeners use `{ signal }` |

Event-coordination modules (`event-delegator.js`, `audio-control-events.js`, `search-events.js`, `ui-interaction-events.js`, `hotkeys-events.js`) already had proper Map-based cleanup with `detachEvents()` and were not modified.

### 8. Sandbox Enabled (commits c28a1fb, 696f383, 92c118d)

Enabled `sandbox: true` for the main window. Required three preparatory changes:

1. Moved `music-metadata` parsing from preload to main process (preload can't do file I/O in sandbox)
2. Replaced `electron-log` with IPC-based logging in preload (preload can't require npm packages in sandbox)
3. Bundled preload modules into a single file using esbuild (sandboxed preloads can only `require('electron')` — no local `require()` calls)

The bundled preload (`preload-bundle.cjs`) is generated by `npm run build:preload` and wired into `start`, `build`, and `test` scripts. Source files remain in `src/preload/` for development; the bundle is gitignored.

**Files changed:** `src/main/modules/app-setup.js`, `src/main/modules/file-operations.js`, `src/preload/preload-modular.cjs`, `src/preload/modules/ipc-bridge.cjs`, `src/preload/modules/secure-api-exposer.cjs`, `package.json`, `.gitignore`

---

### 9. CI Test Reliability Overhaul (commit e0e3a68)

Fixed three categories of flaky CI test failures:

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| Play/pause button race (Windows) | `classList.toggle()` not idempotent; double-calls flip state back | Replaced with explicit `showPlayButton()`/`showPauseButton()` functions |
| Backup list timeout (Mac) | Test polled filesystem for metadata file; slow CI I/O caused 45s timeout | Wait for success/error modal instead (definitive completion signal) |
| Context menu timeout (Windows) | 2s visibility timeout too short; drag-drop hadn't settled | Assertion-based waits after drag, 10s context menu timeout |

**Playwright config changes for CI:**
- `workers: 1` on CI (prevents resource contention — biggest reliability win)
- `retries: 1` with `trace: 'on-first-retry'` for debugging
- `expect.timeout: 15s`, `actionTimeout: 10s`, `timeout: 60s` on CI

**Files changed:** `playwright.config.js`, `src/renderer/modules/audio/audio-controller.js`, `tests/e2e/seeded/backups/basic.spec.js`, `tests/e2e/seeded/holding_tank/basic.spec.js`, `tests/e2e/seeded/playback/basic.spec.js`

### 10. Swallowed Errors Fixed (commit d22778b)

Added `debugLog?.warn()` to 20 previously silent catch blocks across 13 files. Errors are now visible in debug logs without changing control flow.

Categories fixed:
- 11 modal show/hide operations (categories, preferences, song form, bulk add)
- 4 holding tank add/save operations (drag-drop, holding-tank, navigation)
- 4 tab switching imports (event-handlers, hotkeys/index, hotkey-ui)
- 3 UI initialization (tooltips, first-run modal, show-modal listener)

10 intentionally silent catches remain (platform detection fallbacks, file-existence checks, early init, E2E audio context resume).

### 11. State Management Validation (commit d676530)

Added key validation to `SharedState.get()`, `set()`, and `subscribe()`. A `VALID_KEYS` set defines the 11 allowed state keys. Unknown keys trigger `debugLog?.warn()` — catches typos without breaking existing behavior.

### 12. Code Duplication Reduced (commit dfe06f4)

Extracted shared helpers to consolidate repeated patterns:

| Helper | Replaces | Impact |
|--------|----------|--------|
| `bootstrap-helpers.js`: `safeShowModal`/`safeHideModal`/`safeShowTab` | 15+ try/catch dynamic import blocks | 9 files simplified |
| `search-form-utils.js`: `getAdvancedSearchValues`/`hasActiveAdvancedFilters` | 4 identical 4-line form-reading blocks | 3 search files consolidated |
| `event-manager.js`: `migrateOnclick()` | 9 identical 10-line onclick migration blocks | ~90 lines → ~9 lines |

### 13. Unit Test Infrastructure + UNC Deletion Guard

Added Vitest unit test framework (177 tests, ~240ms) covering SharedState, IPC database/store/category handlers, FunctionRegistry, secure adapter, bootstrap helpers, search form utils, and EventManager. CI workflow added (`.github/workflows/unit-tests.yml`).

Unit tests uncovered a data integrity issue: `delete-category('UNC')` would delete the Uncategorized safety-net category that other deletions depend on. Added a guard in `ipc-handlers.js` to reject UNC deletion.

**Files changed:** `package.json`, `vitest.config.js`, `.github/workflows/unit-tests.yml`, `src/main/modules/ipc-handlers.js`, plus 8 test files in `tests/unit/`

---

## Open Concerns

### Low

#### 1. Module Coupling

95 renderer modules with no circular dependency detection. Global `window.debugLog` and `window.electronTest` scattered throughout. Modules reference each other via `window.*` globals rather than explicit imports.

**Recommendation:** Add a module dependency graph check to CI; migrate window globals to explicit module imports over time.

---

## Test Infrastructure

### Unit Tests (Vitest)

| Metric | Value |
|--------|-------|
| Total unit tests | 177 passing |
| Local runtime | ~240ms |
| CI platform | ubuntu-latest |
| Framework | Vitest |
| Config | `vitest.config.js` |

**Modules covered:**

| Test file | Module under test | Tests |
|-----------|------------------|-------|
| `shared-state.test.js` | SharedState observer pattern | 22 |
| `ipc-handlers-db.test.js` | Named IPC database handlers (10 handlers) | 39 |
| `ipc-handlers-store.test.js` | Store ops + category CRUD with UNC guard | 20 |
| `function-registry.test.js` | FunctionRegistry module loader | 33 |
| `secure-adapter.test.js` | Secure adapter (all 6 adapter groups) | 34 |
| `bootstrap-helpers.test.js` | Safe modal/tab helpers | 6 |
| `search-form-utils.test.js` | Advanced search form utilities | 10 |
| `event-manager.test.js` | EventManager onclick migration | 12 |

Audio manager/controller remain E2E-only (heavy Howler.js + DOM coupling).

### E2E Tests (Playwright + Electron)

| Metric | Value |
|--------|-------|
| Total E2E tests | 123 passing, 3 skipped |
| Local runtime | ~2.6 min (4 parallel workers) |
| CI platforms | macOS, Windows (Linux disabled) |
| CI config | `workers: 1`, `retries: 1`, `timeout: 60s`, `expect.timeout: 15s` |
| Framework | Playwright + Electron |
| Workers | 4 local (configurable via `PWWORKERS`), 1 on CI |
| Config | `playwright.config.js` — CI-aware with trace-on-retry |
