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

---

## Open Concerns

### Critical

#### 1. Sandbox Disabled

**File:** `src/main/modules/app-setup.js` (lines 62, 798)

```js
sandbox: false, // Keep false for now as we're using preload scripts
```

Modern Electron supports `sandbox: true` with `contextBridge`-based preload scripts. The current preload architecture may already be compatible — raw SQL exposure has been removed, reducing the attack surface.

**Recommendation:** Test enabling sandbox; refactor preload if needed.

#### 2. Synchronous File I/O Blocking Main Process

**File:** `src/main/modules/profile-backup-manager.js` (1026 lines, ~22 sync calls)

Uses `fs.existsSync()`, `fs.mkdirSync()`, `fs.rmSync()`, and a `while (fs.existsSync(lockPath))` polling loop that mixes synchronous `existsSync` with an async 100ms sleep. The sync calls block the main Electron process during backup operations. Note: `unlink` calls in this file already use async `fs.promises.unlink`.

**Key locations:** Lines 50-51, 163 (sync polling loop), 275, 328, 456, 485-486, 538, 548-549, 677, 694, 713-714, 718, 754, 759, 823-824, 870

**Recommendation:** Migrate to `fs.promises` with `async`/`await` throughout.

---

### High

#### 3. Pervasive Swallowed Errors

**~24 empty `catch` blocks and ~10 `.catch(() => {})` across the renderer.**

Notable locations:
- `modules/preferences/settings-controller.js` (lines 211, 224, 243) — 3 empty catches
- `modules/song-management/song-crud.js` (lines 40, 69, 212, 347) — 4 dynamic import catches
- `modules/hotkeys/hotkey-ui.js` (lines 84-85, 187-188) — catch + .catch pairs
- `modules/audio/audio-manager.js` (lines 418, 632) — WebAudio context resume
- `modules/holding-tank/index.js` (lines 469, 484) — silent promise swallowing
- `modules/navigation/navigation-functions.js` (lines 46, 52) — navigation errors silenced

**Recommendation:** Add `debugLog?.warn()` to catch blocks. Keep intentional ones (lazy imports, benign fallbacks) but document why.

#### 4. Event Listener Memory Leak Risk

**130 `addEventListener` calls vs 12 `removeEventListener` calls** across `src/renderer`.

Worst offenders:
- `modules/drag-drop/event-handlers.js` — 11 listeners added in `setupDragDropEventHandlers()` with no cleanup function
- `modules/event-coordination/` — 51 listeners added vs 9 removed; teardown exists but is insufficient
- `modules/hotkeys/` — Tab-scoped listeners that accumulate on tab switches

**Recommendation:** Implement `AbortController`-based cleanup or explicit teardown functions for component lifecycle management.

#### 5. No Unit Tests

Only E2E tests exist (123 tests, ~2.7 min). No unit tests for:
- Named IPC database handlers
- Secure adapter / preload bridge
- Audio manager state machine
- Module loader / function registry
- Shared state / observer pattern

**Recommendation:** Add unit tests for critical paths, especially the new named database operations and state management.

---

### Medium

#### 6. Freeform State Management

**File:** `src/renderer/modules/shared-state.js`

Clean observer pattern implementation, but allows direct mutation with no validation, immutability, or locking. Any module can `set()` any key to any value.

**Recommendation:** Add type validation for known keys; consider `Object.freeze()` on returned values.

#### 7. Code Duplication

Repeated patterns across modules:
- Error logging boilerplate
- Event handler setup/teardown patterns
- Modal open/close sequences

**Recommendation:** Extract shared utilities for common patterns.

---

### Low

#### 8. Module Coupling

95 renderer modules with no circular dependency detection. Global `window.debugLog` and `window.electronTest` scattered throughout. Modules reference each other via `window.*` globals rather than explicit imports.

**Recommendation:** Add a module dependency graph check to CI; migrate window globals to explicit module imports over time.

---

## Test Infrastructure

| Metric | Value |
|--------|-------|
| Total E2E tests | 123 passing, 3 skipped |
| Local runtime | ~2.7 min (4 parallel workers) |
| CI platforms | macOS, Windows (Linux disabled) |
| Framework | Playwright + Electron |
| Workers | 4 (configurable via `PWWORKERS` env var) |
| Config | `playwright.config.js` — 40s default timeout |
