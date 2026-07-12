# IPC Domain Split & Channel Manifest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the 2,225-line `src/main/modules/ipc-handlers.js` into per-domain handler modules under `src/main/modules/ipc/`, with all channel names sourced from a shared manifest used by both main (ESM) and preload (CJS), guarded by a drift test.

**Architecture:** `ipc-handlers.js` stays as the public entry point (`initializeIpcHandlers(deps)`) so `index-modular.js` and all existing unit tests keep working, but becomes a thin orchestrator that normalizes deps and calls `register(deps)` on ~14 domain modules. Handler bodies move **verbatim** — this is a mechanical relocation, not a rewrite. Channel strings are replaced by constants from `src/shared/ipc-channels.cjs` (CJS so the esbuild-bundled preload can `require` it and ESM main can default-import it).

**Tech Stack:** Electron, vitest (stub-and-capture pattern from `tests/unit/main/ipc-handlers-store.test.js`), esbuild preload bundle.

## Global Constraints

- **Handler bodies move verbatim.** No behavior changes, no logic edits during moves — only the channel literal changes to a manifest constant and closure variables come from `register(deps)` destructuring instead of module-level `let`s. If a body looks wrong, note it in the report; do not fix it in a move task.
- Keep the `{ success, data|value|error }` IPC envelope shape everywhere.
- `initializeIpcHandlers(dependencies)` remains exported from `src/main/modules/ipc-handlers.js` with an unchanged contract (including the `dependencies.getDb || (() => dependencies.db)` and `updateState || { downloaded: false }` fallbacks). Existing unit tests that import it must keep passing **unmodified** unless a task explicitly says otherwise.
- Manifest access pattern: main/tests use `import ipcChannels from '<rel>/shared/ipc-channels.cjs'; const { IPC } = ipcChannels;` (default-import interop — do NOT rely on named ESM imports from CJS); preload uses `const { IPC } = require('../../shared/ipc-channels.cjs');`.
- Launcher (`launcher:*` in `launcher-window.js`) and About (`about:*` in `app-setup.js`) channels are OUT of scope — they are registered outside ipc-handlers.js and stay as literals.
- Every commit message ends with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Run `npm run test:unit` after every task; must pass before committing.
- Match existing style: `debugLog?.info(...)` with `{ module, function }` context. Moved handlers keep `module: 'ipc-handlers'` in their log context (verbatim move; renaming log modules would churn every body).

## Domain → Module → Channel Map (authoritative)

| Module (under `src/main/modules/ipc/`) | Channels (exact strings) |
|---|---|
| `logging-handlers.js` | `preload-log` (**ipcMain.on**), `logs:write`, `logs:get-paths`, `logs:export` |
| `dialog-handlers.js` | `show-directory-picker`, `open-hotkey-file`, `save-hotkey-file`, `open-holding-tank-file`, `save-holding-tank-file`, `show-file-picker` |
| `ui-handlers.js` | `increase-font-size`, `decrease-font-size`, `toggle-waveform`, `toggle-advanced-search`, `close-all-tabs`, `manage-categories`, `show-preferences` |
| `database-handlers.js` | `get-categories`, `add-song`, `get-song-by-id`, `delete-song`, `delete-selected-song`, `edit-selected-song`, `update-song`, `add-category`, `update-category`, `delete-category`, `search-songs`, `get-category-by-code`, `get-songs-by-ids`, `reassign-song-category`, `find-category-codes-like`, `count-songs` |
| `filesystem-handlers.js` | `file-exists`, `file-delete`, `file-copy`, `library:scan-audio-directory` |
| `store-handlers.js` | `store-get`, `store-set`, `store-delete`, `store-has`, `store-keys`, `store-clear` |
| `audio-handlers.js` | `audio-play`, `audio-stop`, `audio-pause`, `audio-fade`, `audio-resume`, `audio-set-volume`, `audio-get-duration`, `audio-get-metadata`, `audio-get-position`, `audio-set-position` |
| `path-os-handlers.js` | `path-join`, `path-parse`, `path-extname`, `path-dirname`, `path-basename`, `path-resolve`, `path-normalize`, `os-homedir`, `os-platform`, `os-arch`, `os-tmpdir` |
| `app-update-handlers.js` | `app-get-path`, `app-get-version`, `app-get-name`, `app-quit`, `app-restart`, `restart-and-install-new-version`, `check-for-update`, `download-update`, `install-update` |
| `utility-handlers.js` | `import-audio-files`, `export-data`, `generate-id`, `format-duration`, `validate-audio-file`, `sanitize-filename` |
| `profile-handlers.js` | `profile:get-current`, `profile:get-directory`, `profile:load-state`, `profile:get-legacy-migration-data`, `profile:save-state`, `profile:get-preference`, `profile:set-preference`, `profile:set-preferences`, `profile:get-all-preferences`, `profile:switch`, `profile:save-state-before-switch`, `profile:create`, `profile:duplicate`, `profile:switch-to`, `profile:delete` |
| `profile-backup-handlers.js` | `profile:createBackup`, `profile:listBackups`, `profile:getBackupMetadata`, `profile:restoreBackup`, `profile:deleteBackup`, `profile:getBackupSettings`, `profile:saveBackupSettings` |
| `library-handlers.js` | `library:export`, `library:import`, `library:import-confirm` |
| `analytics-handlers.js` | `analytics:track-event`, `analytics:get-opt-out-status`, `analytics:set-opt-out` |

(`get-app-path` is NOT in this table — Task 1 deletes it as an orphan: zero callers in src/ or tests/; the live preload uses `app-get-path`.)

## Module template (canonical — every domain module follows this shape)

```js
/**
 * <Domain> IPC handlers.
 * Bodies moved verbatim from ipc-handlers.js — see that file's git history.
 */

import electron from 'electron';
const { ipcMain } = electron;   // add dialog/app to the destructure only if this domain's bodies use them
import ipcChannels from '../../../shared/ipc-channels.cjs';
const { IPC } = ipcChannels;

export function register(deps) {
  const { debugLog /* , ...only what this domain's bodies reference */ } = deps;

  ipcMain.handle(IPC.STORE.GET, async (event, key) => {
    // ...body moved verbatim...
  });
  // ...remaining handlers...
}
```

Rules for every move:
- Destructure from `deps` ONLY the names the moved bodies actually reference (`mainWindow`, `getDb`, `store`, `audioInstances`, `autoUpdater`, `debugLog`, `logService`, `updateState`, `analytics`, `getCurrentProfile`, `getProfileDirectory`).
- Carry over ONLY the top-of-file imports the moved bodies use (`path`, `fs`, `fsPromises`, `os`, `Howl/Howler`, `parseAudioFile`, `uuidv4`, `fileOperations`, `profileManager`, `profileBackupManager`, `libraryTransferManager`, `file-utils` exports, `guards` exports). Delete each import from `ipc-handlers.js` when its last user moves out.
- Replace the channel string literal with the manifest constant. Nothing else in the registration line changes.

---

### Task 1: Delete orphaned `get-app-path` handler; create the channel manifest + its test

**Files:**
- Modify: `src/main/modules/ipc-handlers.js` (delete the `get-app-path` handler block at ~line 131)
- Create: `src/shared/ipc-channels.cjs`
- Test: `tests/unit/main/ipc-channels.test.js`

**Interfaces:**
- Consumes: nothing
- Produces: `module.exports = { IPC }` where `IPC` is a two-level frozen object: `IPC.<DOMAIN>.<NAME> === '<channel-string>'`. Domain keys: `LOGGING, DIALOG, UI, DATABASE, FILESYSTEM, STORE, AUDIO, PATH_OS, APP, UTILITY, PROFILE, PROFILE_BACKUP, LIBRARY, ANALYTICS`. Later tasks depend on these exact names.

- [ ] **Step 1: Delete the orphaned handler**

Remove from `src/main/modules/ipc-handlers.js` (locate by channel name):

```js
  ipcMain.handle('get-app-path', async () => {
    try {
      const result = await app.getAppPath();
      return { success: true, path: result };
    } catch (error) {
      debugLog?.error('Error getting app path:', { module: 'ipc-handlers', function: 'get-app-path', error: error.message });
      return { success: false, error: error.message };
    }
  });
```

Verify: `grep -rn "'get-app-path'" src/ tests/` → no output.

- [ ] **Step 2: Write the failing manifest test**

Create `tests/unit/main/ipc-channels.test.js`:

```js
import { describe, expect, it } from 'vitest';
import ipcChannels from '../../../src/shared/ipc-channels.cjs';

const { IPC } = ipcChannels;

const allValues = () =>
  Object.values(IPC).flatMap(domain => Object.values(domain));

describe('IPC channel manifest', () => {
  it('exports a two-level object of non-empty channel strings', () => {
    expect(Object.keys(IPC).length).toBeGreaterThanOrEqual(14);
    for (const value of allValues()) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate channel names', () => {
    const values = allValues();
    expect(new Set(values).size).toBe(values.length);
  });

  it('is frozen against accidental mutation', () => {
    expect(Object.isFrozen(IPC)).toBe(true);
    expect(Object.isFrozen(IPC.STORE)).toBe(true);
  });

  it('covers the known surface size', () => {
    // 107 channels registered by ipc-handlers.js (post get-app-path removal)
    expect(allValues().length).toBe(107);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run tests/unit/main/ipc-channels.test.js`
Expected: FAIL — cannot resolve `src/shared/ipc-channels.cjs`.

- [ ] **Step 4: Create `src/shared/ipc-channels.cjs`**

```js
/**
 * Shared IPC channel manifest — the single source of truth for channel
 * names used by BOTH the main process (ESM: default-import this file and
 * destructure { IPC }) and the preload script (CJS: require it).
 *
 * Scope: channels registered by src/main/modules/ipc-handlers.js and its
 * ipc/ domain modules. launcher:* (launcher-window.js) and about:*
 * (app-setup.js) are registered elsewhere and intentionally not listed.
 */

const deepFreeze = (obj) => {
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') deepFreeze(value);
  }
  return Object.freeze(obj);
};

const IPC = deepFreeze({
  LOGGING: {
    PRELOAD_LOG: 'preload-log',
    WRITE: 'logs:write',
    GET_PATHS: 'logs:get-paths',
    EXPORT: 'logs:export',
  },
  DIALOG: {
    SHOW_DIRECTORY_PICKER: 'show-directory-picker',
    OPEN_HOTKEY_FILE: 'open-hotkey-file',
    SAVE_HOTKEY_FILE: 'save-hotkey-file',
    OPEN_HOLDING_TANK_FILE: 'open-holding-tank-file',
    SAVE_HOLDING_TANK_FILE: 'save-holding-tank-file',
    SHOW_FILE_PICKER: 'show-file-picker',
  },
  UI: {
    INCREASE_FONT_SIZE: 'increase-font-size',
    DECREASE_FONT_SIZE: 'decrease-font-size',
    TOGGLE_WAVEFORM: 'toggle-waveform',
    TOGGLE_ADVANCED_SEARCH: 'toggle-advanced-search',
    CLOSE_ALL_TABS: 'close-all-tabs',
    MANAGE_CATEGORIES: 'manage-categories',
    SHOW_PREFERENCES: 'show-preferences',
  },
  DATABASE: {
    GET_CATEGORIES: 'get-categories',
    ADD_SONG: 'add-song',
    GET_SONG_BY_ID: 'get-song-by-id',
    DELETE_SONG: 'delete-song',
    DELETE_SELECTED_SONG: 'delete-selected-song',
    EDIT_SELECTED_SONG: 'edit-selected-song',
    UPDATE_SONG: 'update-song',
    ADD_CATEGORY: 'add-category',
    UPDATE_CATEGORY: 'update-category',
    DELETE_CATEGORY: 'delete-category',
    SEARCH_SONGS: 'search-songs',
    GET_CATEGORY_BY_CODE: 'get-category-by-code',
    GET_SONGS_BY_IDS: 'get-songs-by-ids',
    REASSIGN_SONG_CATEGORY: 'reassign-song-category',
    FIND_CATEGORY_CODES_LIKE: 'find-category-codes-like',
    COUNT_SONGS: 'count-songs',
  },
  FILESYSTEM: {
    FILE_EXISTS: 'file-exists',
    FILE_DELETE: 'file-delete',
    FILE_COPY: 'file-copy',
    SCAN_AUDIO_DIRECTORY: 'library:scan-audio-directory',
  },
  STORE: {
    GET: 'store-get',
    SET: 'store-set',
    DELETE: 'store-delete',
    HAS: 'store-has',
    KEYS: 'store-keys',
    CLEAR: 'store-clear',
  },
  AUDIO: {
    PLAY: 'audio-play',
    STOP: 'audio-stop',
    PAUSE: 'audio-pause',
    FADE: 'audio-fade',
    RESUME: 'audio-resume',
    SET_VOLUME: 'audio-set-volume',
    GET_DURATION: 'audio-get-duration',
    GET_METADATA: 'audio-get-metadata',
    GET_POSITION: 'audio-get-position',
    SET_POSITION: 'audio-set-position',
  },
  PATH_OS: {
    PATH_JOIN: 'path-join',
    PATH_PARSE: 'path-parse',
    PATH_EXTNAME: 'path-extname',
    PATH_DIRNAME: 'path-dirname',
    PATH_BASENAME: 'path-basename',
    PATH_RESOLVE: 'path-resolve',
    PATH_NORMALIZE: 'path-normalize',
    OS_HOMEDIR: 'os-homedir',
    OS_PLATFORM: 'os-platform',
    OS_ARCH: 'os-arch',
    OS_TMPDIR: 'os-tmpdir',
  },
  APP: {
    GET_PATH: 'app-get-path',
    GET_VERSION: 'app-get-version',
    GET_NAME: 'app-get-name',
    QUIT: 'app-quit',
    RESTART: 'app-restart',
    RESTART_AND_INSTALL: 'restart-and-install-new-version',
    CHECK_FOR_UPDATE: 'check-for-update',
    DOWNLOAD_UPDATE: 'download-update',
    INSTALL_UPDATE: 'install-update',
  },
  UTILITY: {
    IMPORT_AUDIO_FILES: 'import-audio-files',
    EXPORT_DATA: 'export-data',
    GENERATE_ID: 'generate-id',
    FORMAT_DURATION: 'format-duration',
    VALIDATE_AUDIO_FILE: 'validate-audio-file',
    SANITIZE_FILENAME: 'sanitize-filename',
  },
  PROFILE: {
    GET_CURRENT: 'profile:get-current',
    GET_DIRECTORY: 'profile:get-directory',
    LOAD_STATE: 'profile:load-state',
    GET_LEGACY_MIGRATION_DATA: 'profile:get-legacy-migration-data',
    SAVE_STATE: 'profile:save-state',
    GET_PREFERENCE: 'profile:get-preference',
    SET_PREFERENCE: 'profile:set-preference',
    SET_PREFERENCES: 'profile:set-preferences',
    GET_ALL_PREFERENCES: 'profile:get-all-preferences',
    SWITCH: 'profile:switch',
    SAVE_STATE_BEFORE_SWITCH: 'profile:save-state-before-switch',
    CREATE: 'profile:create',
    DUPLICATE: 'profile:duplicate',
    SWITCH_TO: 'profile:switch-to',
    DELETE: 'profile:delete',
  },
  PROFILE_BACKUP: {
    CREATE: 'profile:createBackup',
    LIST: 'profile:listBackups',
    GET_METADATA: 'profile:getBackupMetadata',
    RESTORE: 'profile:restoreBackup',
    DELETE: 'profile:deleteBackup',
    GET_SETTINGS: 'profile:getBackupSettings',
    SAVE_SETTINGS: 'profile:saveBackupSettings',
  },
  LIBRARY: {
    EXPORT: 'library:export',
    IMPORT: 'library:import',
    IMPORT_CONFIRM: 'library:import-confirm',
  },
  ANALYTICS: {
    TRACK_EVENT: 'analytics:track-event',
    GET_OPT_OUT_STATUS: 'analytics:get-opt-out-status',
    SET_OPT_OUT: 'analytics:set-opt-out',
  },
});

module.exports = { IPC };
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/unit/main/ipc-channels.test.js`
Expected: PASS (4 tests). If the count assertion fails, recount against the Domain Map table — the manifest, not the test, is wrong.

- [ ] **Step 6: Full suite + commit**

Run: `npm run test:unit` — expected PASS.

```bash
git add -A
git commit -m "feat: add shared IPC channel manifest; drop orphaned get-app-path

get-app-path had zero callers (live preload uses app-get-path).
The manifest is the single source of truth for channel names, to be
consumed by both main and preload in subsequent commits.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Scaffold `ipc/` — guards module, orchestrator, first two domain modules (store, path-os)

**Files:**
- Create: `src/main/modules/ipc/guards.js`
- Create: `src/main/modules/ipc/store-handlers.js`
- Create: `src/main/modules/ipc/path-os-handlers.js`
- Modify: `src/main/modules/ipc-handlers.js`
- Test: existing `tests/unit/main/ipc-handlers-store.test.js` must pass **unmodified**

**Interfaces:**
- Consumes: `IPC` from Task 1.
- Produces:
  - `guards.js` exports `{ isPathInside(candidatePath, allowedPath), canonicalizeForAuthorization(filePath, allowedPaths) }` — moved verbatim from ipc-handlers.js top-of-file helpers (locate by name; `canonicalizeForAuthorization` returns `{ canonicalPath, allowed }`).
  - Every domain module exports `register(deps)` (sync function, returns nothing).
  - `ipc-handlers.js` gains, inside `registerAllHandlers()` — which becomes parameterless glue — a `deps` object assembled in `initializeIpcHandlers` and passed to each domain `register`.

- [ ] **Step 1: Create `guards.js`**

Move `isPathInside` and `canonicalizeForAuthorization` (plus any private helper they use, e.g. the realpath-mapping of allowed paths) verbatim from `ipc-handlers.js` into `src/main/modules/ipc/guards.js` with named exports. In `ipc-handlers.js`, replace the moved definitions with `import { isPathInside, canonicalizeForAuthorization } from './ipc/guards.js';`.

- [ ] **Step 2: Create `store-handlers.js`**

Full file (bodies moved verbatim — shown here because it is the canonical template):

```js
/**
 * Store (electron-store) IPC handlers.
 * Bodies moved verbatim from ipc-handlers.js — see that file's git history.
 */

import electron from 'electron';
const { ipcMain } = electron;
import ipcChannels from '../../../shared/ipc-channels.cjs';
const { IPC } = ipcChannels;

export function register(deps) {
  const { store, debugLog } = deps;

  ipcMain.handle(IPC.STORE.GET, async (event, key) => {
    /* body of the current 'store-get' handler, verbatim */
  });

  ipcMain.handle(IPC.STORE.SET, async (event, key, value) => {
    /* body of the current 'store-set' handler, verbatim */
  });

  ipcMain.handle(IPC.STORE.DELETE, async (event, key) => {
    /* body of the current 'store-delete' handler, verbatim */
  });

  ipcMain.handle(IPC.STORE.HAS, async (event, key) => {
    /* body of the current 'store-has' handler, verbatim */
  });

  ipcMain.handle(IPC.STORE.KEYS, async () => {
    /* body of the current 'store-keys' handler, verbatim */
  });

  ipcMain.handle(IPC.STORE.CLEAR, async () => {
    /* body of the current 'store-clear' handler, verbatim */
  });
}
```

(The `/* body ... verbatim */` comments mean: cut the exact body from `ipc-handlers.js` — located by channel string — and paste it unchanged. This applies to every move in this plan.)

- [ ] **Step 3: Create `path-os-handlers.js`**

Same template. Channels per the Domain Map (`IPC.PATH_OS.*`). Deps needed: `debugLog`. Node imports needed: `path`, `os`.

- [ ] **Step 4: Convert the orchestrator**

In `ipc-handlers.js`:
- Add `import * as storeHandlers from './ipc/store-handlers.js';` and `import * as pathOsHandlers from './ipc/path-os-handlers.js';`
- In `initializeIpcHandlers`, after the existing normalization assignments, build:

```js
  const deps = {
    mainWindow,
    getDb,
    getCurrentProfile,
    getProfileDirectory,
    store,
    audioInstances,
    autoUpdater,
    debugLog,
    logService,
    updateState,
    analytics,
  };
```

- Pass it: `registerAllHandlers(deps)`, and at the top of `registerAllHandlers(deps)` call:

```js
  storeHandlers.register(deps);
  pathOsHandlers.register(deps);
```

- Delete the moved handler registrations (store-*, path-*, os-*) from `registerAllHandlers`'s body.

Note: `mainWindow` is captured at init time; keep passing the snapshot as-is (a live getter for it is a separate, deferred improvement — do not add one here).

- [ ] **Step 5: Verify**

Run: `npx vitest run tests/unit/main/ipc-handlers-store.test.js` — expected PASS unmodified (proves the orchestrator + module path is equivalent).
Run: `npm run test:unit` — expected PASS.
Run: `node --check src/main/modules/ipc-handlers.js && node --check src/main/modules/ipc/store-handlers.js && node --check src/main/modules/ipc/path-os-handlers.js && node --check src/main/modules/ipc/guards.js`

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: scaffold ipc/ domain modules; extract store and path-os handlers

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Extract `database-handlers.js`

**Files:**
- Create: `src/main/modules/ipc/database-handlers.js`
- Modify: `src/main/modules/ipc-handlers.js`
- Test: existing `tests/unit/main/ipc-handlers-db.test.js` and `tests/unit/main/ipc-handlers-file-delete.test.js` must pass unmodified

**Interfaces:**
- Consumes: template + `deps` from Task 2 (`getDb`, `store`, `debugLog`, `mainWindow` — check each body; `delete-song` also touches files, keep whatever it imports).
- Produces: `register(deps)` covering the 16 `IPC.DATABASE.*` channels from the Domain Map.

- [ ] **Step 1: Move the 16 handlers** verbatim into `database-handlers.js` per the template; replace literals with `IPC.DATABASE.*`; destructure from `deps` exactly the names the bodies reference; carry needed imports (`path`, `fs`/`fsPromises` if referenced).
- [ ] **Step 2: Register** `databaseHandlers.register(deps)` in the orchestrator; delete moved registrations.
- [ ] **Step 3: Verify**: `npx vitest run tests/unit/main/ipc-handlers-db.test.js tests/unit/main/ipc-handlers-file-delete.test.js` PASS unmodified; `npm run test:unit` PASS; `node --check` both touched files.
- [ ] **Step 4: Commit**: `refactor: extract database IPC handlers into ipc/database-handlers.js` (+ trailer).

---

### Task 4: Extract `filesystem-handlers.js`, `logging-handlers.js`, `dialog-handlers.js`, `ui-handlers.js`

**Files:**
- Create: `src/main/modules/ipc/filesystem-handlers.js`, `src/main/modules/ipc/logging-handlers.js`, `src/main/modules/ipc/dialog-handlers.js`, `src/main/modules/ipc/ui-handlers.js`
- Modify: `src/main/modules/ipc-handlers.js`
- Test: existing `tests/unit/main/ipc-handlers-file-delete.test.js` (covers `file-delete`) must pass unmodified

**Interfaces:**
- Consumes: template + Domain Map rows for FILESYSTEM / LOGGING / DIALOG / UI.
- Produces: four `register(deps)` modules.

Per-module notes (bodies verbatim as always):
- `filesystem-handlers.js`: imports `{ isPathInside, canonicalizeForAuthorization }` from `./guards.js` (whichever the bodies use), `copyFileStreaming`/`isSupportedAudioFile` from `../file-utils.js` (used by `file-copy` and the scan), `path`, `fs`/`fsPromises`. Deps: `store`, `debugLog`, and whatever `library:scan-audio-directory` references.
- `logging-handlers.js`: NOTE `preload-log` is `ipcMain.on`, not `.handle` — move it as `.on`. Deps: `debugLog`, `logService`.
- `dialog-handlers.js`: keeps `import fileOperations from '../file-operations.js';` and delegates like the current bodies do. Deps: `debugLog` + whatever the bodies reference. The `fileOperations.initializeFileOperations(dependencies)` call STAYS in `initializeIpcHandlers` (it is init, not registration).
- `ui-handlers.js`: bodies send to `mainWindow` — deps: `mainWindow`, `debugLog`.

- [ ] **Step 1: Move** all four groups per the template; register all four in the orchestrator; delete moved code and now-unused imports from `ipc-handlers.js`.
- [ ] **Step 2: Verify**: `npm run test:unit` PASS; `node --check` on all five touched files.
- [ ] **Step 3: Commit**: `refactor: extract filesystem, logging, dialog, and ui IPC handlers` (+ trailer).

---

### Task 5: Extract `audio-handlers.js`, `app-update-handlers.js`, `utility-handlers.js`

**Files:**
- Create: `src/main/modules/ipc/audio-handlers.js`, `src/main/modules/ipc/app-update-handlers.js`, `src/main/modules/ipc/utility-handlers.js`
- Modify: `src/main/modules/ipc-handlers.js`

**Interfaces:**
- Consumes: template + Domain Map rows for AUDIO / APP / UTILITY.
- Produces: three `register(deps)` modules.

Per-module notes:
- `audio-handlers.js`: imports `{ Howl, Howler } from 'howler'` and `{ parseFile as parseAudioFile } from 'music-metadata'`. Deps: `audioInstances`, `debugLog`. Move ALL ten `audio-*` bodies verbatim (do not add path validation or other fixes here — note concerns in the report instead).
- `app-update-handlers.js`: deps: `autoUpdater`, `updateState`, `mainWindow`, `debugLog`, `analytics` — check each body. Electron destructure includes `app`.
- `utility-handlers.js`: imports `{ v4 as uuidv4 } from 'uuid'` and `{ isSupportedAudioFile } from '../file-utils.js'`. Deps: `debugLog`.

- [ ] **Step 1: Move** the three groups; register in orchestrator; prune now-unused imports from `ipc-handlers.js` (this should remove `howler`, `music-metadata`, `uuid` from it if nothing else uses them).
- [ ] **Step 2: Verify**: `npm run test:unit` PASS (note: `ipc-handlers-preferences.test.js` mocks `howler`/`music-metadata` — after this task those vi.mocks still apply to the audio module's imports, so tests pass; do not remove the mocks); `node --check` all touched files.
- [ ] **Step 3: Commit**: `refactor: extract audio, app-update, and utility IPC handlers` (+ trailer).

---

### Task 6: Extract `profile-handlers.js`, `profile-backup-handlers.js`, `library-handlers.js`, `analytics-handlers.js`

**Files:**
- Create: `src/main/modules/ipc/profile-handlers.js`, `src/main/modules/ipc/profile-backup-handlers.js`, `src/main/modules/ipc/library-handlers.js`, `src/main/modules/ipc/analytics-handlers.js`
- Modify: `src/main/modules/ipc-handlers.js`
- Test: existing `tests/unit/main/ipc-handlers-preferences.test.js` must pass unmodified

**Interfaces:**
- Consumes: template + Domain Map rows for PROFILE / PROFILE_BACKUP / LIBRARY / ANALYTICS.
- Produces: four `register(deps)` modules. After this task `registerAllHandlers(deps)` contains ONLY `register(deps)` calls — zero `ipcMain.handle`/`ipcMain.on` lines remain in `ipc-handlers.js`.

Per-module notes:
- `profile-handlers.js`: imports `* as profileManager from '../profile-manager.js'`, `path`, `fsPromises`, electron `app`. Deps: `getCurrentProfile`, `getProfileDirectory`, `store`, `debugLog`, `analytics`, `mainWindow` — check each body (profile:switch relaunches the app; profile:set-preference sends font-size events to mainWindow).
- `profile-backup-handlers.js`: imports `* as profileBackupManager from '../profile-backup-manager.js'`. Deps per bodies (`getCurrentProfile`, `debugLog`, ...).
- `library-handlers.js`: imports `* as libraryTransferManager from '../library-transfer-manager.js'`. Deps per bodies (`mainWindow`, `debugLog`, ...).
- `analytics-handlers.js`: deps: `analytics`, `store`, `debugLog` — check bodies.

- [ ] **Step 1: Move** the four groups; register in orchestrator; delete every now-unused import from `ipc-handlers.js`.
- [ ] **Step 2: Confirm hollowing**: `grep -c "ipcMain.handle\|ipcMain.on" src/main/modules/ipc-handlers.js` → expected `0` (the file should now be ~80 lines: imports, init/normalization, deps assembly, register calls, exports).
- [ ] **Step 3: Verify**: `npx vitest run tests/unit/main/ipc-handlers-preferences.test.js` PASS unmodified; `npm run test:unit` PASS; `node --check` all touched files.
- [ ] **Step 4: Commit**: `refactor: extract profile, backup, library, and analytics IPC handlers` (+ trailer).

---

### Task 7: Switch preload to manifest constants

**Files:**
- Modify: `src/preload/modules/secure-api-exposer.cjs` (all ~109 `ipcRenderer.invoke('<literal>'` sites → `ipcRenderer.invoke(IPC.<DOMAIN>.<NAME>`)
- Test: existing `tests/unit/main/preload-filesystem-surface.test.js` — **will need updating** (it greps for `ipcRenderer.invoke('file-copy'` literals; see Step 3)

**Interfaces:**
- Consumes: `IPC` manifest (Task 1). `const { IPC } = require('../../shared/ipc-channels.cjs');` at the top of the file.
- Produces: a preload whose every invoke channel is a manifest reference. `preload-log` (sent via `ipcRenderer.send`, if present in preload files) also switches to `IPC.LOGGING.PRELOAD_LOG`. Event-listener channel names in `ipc-bridge.cjs` (`fkey_load` etc.) are main→renderer events, NOT in the manifest — leave them.

- [ ] **Step 1: Add the require and replace every invoke literal.** Mapping is mechanical via the Domain Map table. Any literal in `secure-api-exposer.cjs` that is NOT in the manifest is a finding — stop and report it (it means a drifted or launcher-scope channel), do not invent a manifest entry.
- [ ] **Step 2: Rebuild and grep**: `npm run build:preload` → success; `grep -c "ipcRenderer.invoke('" src/preload/modules/secure-api-exposer.cjs` → expected `0`.
- [ ] **Step 3: Update the surface test** to match on manifest references instead of literals:

In `tests/unit/main/preload-filesystem-surface.test.js`, replace the two `it.each` bodies' assertions:

```js
    for (const channel of ['file-read', 'file-write', 'file-mkdir', 'fs-readdir', 'fs-stat', 'file-get-user-data-path']) {
      expect(contents).not.toContain(`'${channel}'`);
    }
```

and:

```js
    expect(contents).toContain('ipcRenderer.invoke(IPC.FILESYSTEM.FILE_COPY');
    expect(contents).toContain('ipcRenderer.invoke(IPC.FILESYSTEM.FILE_DELETE');
    expect(contents).toContain('ipcRenderer.invoke(IPC.FILESYSTEM.SCAN_AUDIO_DIRECTORY');
```

- [ ] **Step 4: Runtime sanity** (the bundle is what actually runs): `npx playwright test tests/e2e/seeded/ui/basic.spec.js --reporter=line` → 5 passed. This exercises search/store/UI channels through the rebuilt bundle.
- [ ] **Step 5: Verify + commit**: `npm run test:unit` PASS.

```bash
git add -A
git commit -m "refactor: preload invokes IPC channels via shared manifest

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Drift-guard test — preload references ⊆ registered handlers == manifest

**Files:**
- Test: `tests/unit/main/ipc-drift-guard.test.js`

**Interfaces:**
- Consumes: `initializeIpcHandlers` (unchanged contract), `IPC` manifest, `src/preload/modules/secure-api-exposer.cjs` source text.
- Produces: the standing guarantee that (a) main registers exactly the manifest, (b) every preload invoke resolves to a registered channel.

- [ ] **Step 1: Write the test** (stub-and-capture pattern from `ipc-handlers-store.test.js`):

```js
/**
 * Drift guard: the channels main registers must exactly match the shared
 * manifest, and every channel preload references must be registered.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import fs from 'node:fs';

const registered = new Set();

const fakeIpcMain = {
  handle: (channel) => { registered.add(channel); },
  on: (channel) => { registered.add(channel); },
};

vi.mock('electron', () => ({
  default: {
    ipcMain: fakeIpcMain,
    dialog: {},
    app: { getPath: () => '/fake', getAppPath: () => '/fake' },
  },
  ipcMain: fakeIpcMain,
  dialog: {},
  app: { getPath: () => '/fake', getAppPath: () => '/fake' },
}));
vi.mock('../../../src/main/modules/file-operations.js', () => ({
  default: { initializeFileOperations: vi.fn() },
}));
vi.mock('../../../src/main/modules/profile-manager.js', () => ({}));
vi.mock('../../../src/main/modules/profile-backup-manager.js', () => ({}));
vi.mock('../../../src/main/modules/library-transfer-manager.js', () => ({}));
vi.mock('howler', () => ({ Howl: vi.fn(), Howler: {} }));
vi.mock('music-metadata', () => ({ parseFile: vi.fn() }));

import ipcChannels from '../../../src/shared/ipc-channels.cjs';
const { IPC } = ipcChannels;

const manifestValues = new Set(
  Object.values(IPC).flatMap(domain => Object.values(domain))
);

beforeAll(async () => {
  const { initializeIpcHandlers } = await import(
    '../../../src/main/modules/ipc-handlers.js'
  );
  initializeIpcHandlers({
    mainWindow: null,
    getDb: () => null,
    getCurrentProfile: () => 'Test',
    getProfileDirectory: () => '/fake',
    store: { get: vi.fn(), set: vi.fn() },
    audioInstances: new Map(),
    autoUpdater: {},
    debugLog: null,
    logService: null,
    analytics: null,
  });
});

describe('IPC drift guard', () => {
  it('main registers exactly the manifest channels', () => {
    const missing = [...manifestValues].filter(c => !registered.has(c));
    const extra = [...registered].filter(c => !manifestValues.has(c));
    expect(missing, `in manifest but never registered: ${missing}`).toEqual([]);
    expect(extra, `registered but not in manifest: ${extra}`).toEqual([]);
  });

  it('every preload manifest reference resolves and is registered', () => {
    const src = fs.readFileSync('src/preload/modules/secure-api-exposer.cjs', 'utf8');
    const refs = [...src.matchAll(/IPC\.([A-Z_]+)\.([A-Z_]+)/g)];
    expect(refs.length).toBeGreaterThan(90);
    for (const [, domain, name] of refs) {
      const channel = IPC[domain]?.[name];
      expect(channel, `IPC.${domain}.${name} not in manifest`).toBeDefined();
      expect(registered.has(channel), `${channel} referenced by preload but never registered`).toBe(true);
    }
  });

  it('preload has no leftover invoke literals', () => {
    const src = fs.readFileSync('src/preload/modules/secure-api-exposer.cjs', 'utf8');
    expect(src.includes("ipcRenderer.invoke('")).toBe(false);
  });
});
```

- [ ] **Step 2: Run it**: `npx vitest run tests/unit/main/ipc-drift-guard.test.js` — expected PASS. If `main registers exactly the manifest` fails, the diff between the sets is a real bug introduced in Tasks 2-7 (a dropped or renamed handler): fix the extraction, not the test. (If a mocked module import throws during `initializeIpcHandlers`, add the minimal missing mock — mirroring the existing test files' mock lists — rather than weakening assertions.)
- [ ] **Step 3: Full verification**: `npm run test:unit` PASS; `npx eslint src/main src/preload --no-warn-ignored` → no new errors; `npm run build:preload` success; `npm run test:smoke` → 1 passed; `npx playwright test tests/e2e/seeded/hotkeys/basic.spec.js tests/e2e/profiles/lifecycle.spec.js --reporter=line` → all passed (exercises profile + hotkey + store channels end-to-end).
- [ ] **Step 4: Commit**: `test: add IPC drift guard pinning main, preload, and manifest together` (+ trailer).

---

### Task 9: Docs + final sweep

**Files:**
- Modify: `src/main/README.md` (describe the `ipc/` layout: orchestrator + domain modules + guards; update the ipc-handlers.js entry)
- Modify: `src/preload/README.md` (note channel names come from `src/shared/ipc-channels.cjs`)

- [ ] **Step 1: Update both READMEs** to match the new structure (list each `ipc/*.js` module with a one-line responsibility, referencing the Domain Map).
- [ ] **Step 2: Sanity greps**:

```bash
grep -c "ipcMain" src/main/modules/ipc-handlers.js            # expect 0 (orchestrator has no direct registrations; import may remain only if still used — prefer removing it)
wc -l src/main/modules/ipc-handlers.js                        # expect < 120
grep -rn "ipcRenderer.invoke('" src/preload/modules/           # expect no output
```

- [ ] **Step 3: Final full run**: `npm run test:unit` PASS.
- [ ] **Step 4: Commit**: `docs: document ipc/ domain module layout and channel manifest` (+ trailer).
