# Dead Code & IPC Boundary Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete confirmed-dead code, fix the broken renderer fileSystem adapter surface, and remove three correctness landmines (stale `db` snapshot injection, duplicated `copyFileStreaming`, duplicated profile-state-save logic).

**Architecture:** All changes are subtractive or mechanical extraction — no behavior changes intended. Main process is ESM (`import`), preload is CJS. Unit tests run under vitest (`npm run test:unit`); the preload bundle is built with `npm run build:preload`.

**Tech Stack:** Electron, node-sqlite3-wasm, electron-store, vitest, esbuild (preload bundle).

## Global Constraints

- Do NOT delete the main-process audio engine (`audio-play`/`audio-stop`/`audio-pause`/`audio-resume`/`audio-set-volume`/`audio-fade`/`audio-get-duration`/etc. in `ipc-handlers.js`). It is LIVE: exposed by `secure-api-exposer.cjs:150-159`, used by `song-crud.js:360` (`getDuration`) and `test-utils/index.js:425-484`. Only the orphaned `audio-volume` handler (no preload caller) is deleted.
- Renderer generic filesystem read/write was **deliberately removed** for security (commit `86ed660` "Narrow renderer filesystem capabilities"). The fix for the dead adapter methods is REMOVAL, not implementing new main-process handlers.
- Keep the `{ success, data|value|error }` IPC envelope shape everywhere.
- Every commit message ends with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Run `npm run test:unit` after every task; it must pass before committing.
- Match existing code style: optional-chained `debugLog?.info(...)` with `{ module, function }` context objects.

---

### Task 1: Delete dead preload legacy exposer (`api-exposer.cjs`)

`src/preload/modules/api-exposer.cjs` is required by nothing (`preload-modular.cjs:13-14` only requires `ipc-bridge.cjs` and `secure-api-exposer.cjs`), is absent from the built `preload-bundle.cjs`, and carries its own drifted channel list. The existing surface test references it and must be updated first.

**Files:**
- Modify: `tests/unit/main/preload-filesystem-surface.test.js`
- Delete: `src/preload/modules/api-exposer.cjs`
- Modify: `src/preload/README.md` (lines 19, 45-47 reference the file)

**Interfaces:**
- Consumes: nothing
- Produces: nothing (pure deletion)

- [ ] **Step 1: Update the surface test to drop the dead file**

In `tests/unit/main/preload-filesystem-surface.test.js`, change:

```js
const preloadSources = [
  'src/preload/modules/api-exposer.cjs',
  'src/preload/modules/secure-api-exposer.cjs'
];
```

to:

```js
const preloadSources = ['src/preload/modules/secure-api-exposer.cjs'];
```

- [ ] **Step 2: Run the test to verify it still passes**

Run: `npx vitest run tests/unit/main/preload-filesystem-surface.test.js`
Expected: PASS (2 tests)

- [ ] **Step 3: Delete the dead file and update README**

```bash
git rm src/preload/modules/api-exposer.cjs
```

In `src/preload/README.md`: delete the tree line for `api-exposer.cjs` (line 19) and the "api-exposer.cjs (legacy helper)" bullet block (lines 45-47).

- [ ] **Step 4: Verify nothing references it and the bundle still builds**

Run: `grep -rn "api-exposer" src/ tests/ --include="*.js" --include="*.cjs" --include="*.md" | grep -v secure-api-exposer` — expected: no output.
Run: `npm run build:preload` — expected: success.
Run: `npm run test:unit` — expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: delete dead preload api-exposer.cjs

Never required by preload-modular.cjs and absent from the built bundle.
Its independently-drifted channel list (e.g. get-app-path vs the live
app-get-path) was a trap for future maintenance.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Remove orphaned `audio-volume` IPC handler

`ipcMain.handle('audio-volume', ...)` at `src/main/modules/ipc-handlers.js:580-588` has no caller: the live preload invokes `audio-set-volume` (`secure-api-exposer.cjs:154`); the only invoker of `audio-volume` was the just-deleted `api-exposer.cjs`.

**Files:**
- Modify: `src/main/modules/ipc-handlers.js:580-588` (and the `ipcMain.removeHandler('audio-volume')` line inside `removeAllHandlers()`, near line 2590)

**Interfaces:**
- Consumes: nothing
- Produces: nothing (pure deletion)

- [ ] **Step 1: Delete the handler**

Remove this block from `ipc-handlers.js` (~line 580):

```js
  ipcMain.handle('audio-volume', async (event, volume) => {
    try {
      Howler.volume(volume);
      return { success: true };
    } catch (error) {
      debugLog?.error('Audio volume error:', { module: 'ipc-handlers', function: 'audio-volume', error: error.message });
      return { success: false, error: error.message };
    }
  });
```

Also delete the matching `ipcMain.removeHandler('audio-volume');` line inside `removeAllHandlers()` (~line 2590). (The whole `removeAllHandlers` function goes away in Task 3; deleting this line now just keeps the file consistent if tasks are reordered.)

- [ ] **Step 2: Verify no callers remain**

Run: `grep -rn "'audio-volume'" src/ tests/` — expected: no output.
Run: `npm run test:unit` — expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/main/modules/ipc-handlers.js
git commit -m "chore: remove orphaned audio-volume IPC handler

Only invoked by the deleted legacy api-exposer.cjs; the live preload
uses audio-set-volume.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Delete `removeAllHandlers()` and the `test*()` scaffolding stubs

`removeAllHandlers()` (`ipc-handlers.js:2556-2662`) has zero callers and is out of sync with the registered handler set (missing `profile:create`, `profile:delete`, `profile:switch`, and others) — calling it would silently leave handlers registered. `testModularMain`/`testAppSetup`/`testIpcHandlers`/`testFileOperations` are log-only scaffolding stubs from the original modularization, called by nothing except each other.

**Files:**
- Modify: `src/main/modules/ipc-handlers.js` (delete `removeAllHandlers` function ~2556-2662 and `testIpcHandlers` ~2665-2669; remove both names from the named export block ~2674-2675 and the default export object ~2682-2683)
- Modify: `src/main/index-modular.js` (delete `testModularMain` ~1157-1178; remove `testModularMain` from named exports ~1259 and default export ~1267)
- Modify: `src/main/modules/app-setup.js` (delete `testAppSetup` ~1186-1190; remove from exports ~1205, ~1225)
- Modify: `src/main/modules/file-operations.js` (delete `testFileOperations` ~342-346; remove from exports ~357, ~371)
- Modify: `src/main/README.md:40` (drop `removeAllHandlers` and `testIpcHandlers` from the documented exports list; also drop `registerAllHandlers` only if it is not actually exported — verify first)

**Interfaces:**
- Consumes: nothing
- Produces: nothing (pure deletion)

- [ ] **Step 1: Delete the functions and their export references**

Line numbers shift after Task 2 — locate by name, not line. For each of the four files: delete the function definition, then delete the identifier from BOTH the named `export { ... }` block and the `export default { ... }` object.

- [ ] **Step 2: Verify no stragglers**

Run: `grep -rn "removeAllHandlers\|testModularMain\|testAppSetup\|testIpcHandlers\|testFileOperations" src/ tests/` — expected: no output (README already updated).
Run: `node --check src/main/modules/ipc-handlers.js` (repeat for the other three files) — expected: no syntax errors.
Run: `npm run test:unit` — expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: delete unused removeAllHandlers and test*() scaffolding stubs

removeAllHandlers had no callers and had drifted out of sync with the
registered handler set; the test*() functions were log-only stubs from
the original modularization scaffolding.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Delete unused renderer `module-loader.js`

`src/renderer/module-loader.js` is imported nowhere (only referenced by `src/renderer/README.md:7`). Actual module loading happens via ad hoc `import()` in `app-bootstrap/index.js` and `function-registry.js`.

**Files:**
- Delete: `src/renderer/module-loader.js`
- Modify: `src/renderer/README.md` (remove the `module-loader.js` bullet and any prose describing it)

**Interfaces:**
- Consumes: nothing
- Produces: nothing (pure deletion)

- [ ] **Step 1: Delete and update README**

```bash
git rm src/renderer/module-loader.js
```

Remove the `module-loader.js` entry from `src/renderer/README.md` (line 7 and any related prose paragraphs describing ModuleLoader).

- [ ] **Step 2: Verify**

Run: `grep -rn "module-loader\|ModuleLoader" src/ tests/ | grep -v node_modules` — expected: no output.
Run: `npm run test:unit` — expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: delete unused renderer module-loader.js

Fully-built abstraction imported by nothing; real module loading lives
in app-bootstrap and function-registry.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Remove dead fileSystem adapter/service methods and add a surface-consistency test

`secureFileSystem.read/write/mkdir/readdir/stat` (`src/renderer/modules/adapters/secure-adapter.js:209-410 region`) call preload APIs that don't exist — the live preload exposes only `fileSystem: { exists, delete, copy, scanAudioDirectory }` (`secure-api-exposer.cjs:122-127`), and `electronAPI.fileSystem` is an alias of the same object. These methods are guaranteed to throw "No file system API available" at runtime. Per the Global Constraints, the fix is removal (the narrow surface is intentional security hardening). Callers to fix: `services/file-system.js` (wraps all five) and `test-utils/index.js:223` (`secureFileSystem.read` in a diagnostic). The existing `tests/unit/renderer/secure-adapter.test.js` has cases for `read`/`write`/`mkdir` that must be removed. A new test pins adapter surface ⊆ preload surface so this drift can't recur.

**Files:**
- Modify: `src/renderer/modules/adapters/secure-adapter.js` (delete the five methods from `secureFileSystem`; keep `exists`, `copy`, `delete`, `scanAudioDirectory`)
- Modify: `src/renderer/services/file-system.js` (delete `readFile`, `writeFile`, `stat`, `readdir` wrappers; keep `exists`, `copy`, `delete`)
- Modify: `src/renderer/modules/test-utils/index.js` (~lines 200-240: remove the `fileRead` diagnostic step that calls `secureFileSystem.read`)
- Modify: `tests/unit/renderer/secure-adapter.test.js` (remove the `read`/`write`/`mkdir` test cases, ~lines 151-200)
- Create: `tests/unit/renderer/adapter-preload-surface.test.js`
- Modify: `src/renderer/services/README.md` if it documents the removed wrappers

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces: `secureFileSystem` with exactly `{ exists, copy, delete, scanAudioDirectory }`; `services/file-system.js` exporting exactly `{ exists, copy, delete }` wrappers

- [ ] **Step 1: Write the failing surface-consistency test**

Create `tests/unit/renderer/adapter-preload-surface.test.js`:

```js
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

// Guards against contract drift between the renderer adapter and the
// preload contextBridge surface: every fileSystem method the adapter
// exposes must exist in the preload's fileSystem API.
describe('secure-adapter fileSystem surface matches preload', () => {
  const preload = fs.readFileSync('src/preload/modules/secure-api-exposer.cjs', 'utf8');
  const adapter = fs.readFileSync('src/renderer/modules/adapters/secure-adapter.js', 'utf8');

  const fsBlock = preload.match(/fileSystem:\s*{([\s\S]*?)\n\s*}/);
  const preloadMethods = new Set(
    [...fsBlock[1].matchAll(/^\s*(\w+):/gm)].map(m => m[1])
  );

  const adapterBlock = adapter.match(/export const secureFileSystem = {([\s\S]*?)\n};/);
  const adapterMethods = [...adapterBlock[1].matchAll(/^  (\w+): async/gm)].map(m => m[1]);

  it('found both surfaces', () => {
    expect(preloadMethods.size).toBeGreaterThan(0);
    expect(adapterMethods.length).toBeGreaterThan(0);
  });

  it.each([...new Set(adapterMethods)])('adapter fileSystem.%s exists in preload', method => {
    expect(preloadMethods.has(method)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/renderer/adapter-preload-surface.test.js`
Expected: FAIL — `read`, `write`, `mkdir`, `readdir`, `stat` are in the adapter but not the preload surface. (If the regexes don't match the file layout, fix the regexes until the "found both surfaces" case passes and the drift cases fail — do not weaken the assertions.)

- [ ] **Step 3: Delete the dead adapter methods**

In `src/renderer/modules/adapters/secure-adapter.js`, inside `export const secureFileSystem = { ... }`, delete the five complete method blocks `read`, `write`, `mkdir`, `readdir`, `stat` (each is an `async` arrow with try/catch and the "No file system API available" fallback). Keep `exists`, `copy`, `delete`, `scanAudioDirectory`. Watch trailing commas.

- [ ] **Step 4: Trim `services/file-system.js` and the test-utils diagnostic**

In `src/renderer/services/file-system.js`, delete the `readFile` (line ~17), `writeFile` (~27), `stat` (~45), and `readdir` (~73) wrapper methods, keeping `exists`, `copy`, `delete`. Update `src/renderer/services/README.md` if it lists the removed methods.

In `src/renderer/modules/test-utils/index.js`, remove the `fileRead` diagnostic chain (the block resolving `configPath` and calling `secureFileSystem.read(configPath)`, ~lines 200-240) so `testFileSystemAPI` goes straight from the `exists` check to returning `results`. Keep the surrounding promise chain valid.

- [ ] **Step 5: Remove the now-dead adapter test cases**

In `tests/unit/renderer/secure-adapter.test.js`, delete the `it(...)` cases for `read` (three cases: secure, fallback, no-API), `write`, and `mkdir` (~lines 151-200). Keep cases for surviving methods.

- [ ] **Step 6: Run all unit tests**

Run: `npm run test:unit`
Expected: PASS, including the new surface test.
Run: `grep -rn "secureFileSystem.read\|secureFileSystem.write\|secureFileSystem.mkdir\|secureFileSystem.readdir\|secureFileSystem.stat\b\|fileSystem.readFile\|fileSystem.writeFile" src/` — expected: no output.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "fix: remove dead fileSystem read/write/mkdir/readdir/stat adapter paths

These called preload APIs that were deliberately removed when the
renderer filesystem surface was narrowed (86ed660); they could only
ever throw 'No file system API available'. A new surface-consistency
test pins adapter fileSystem methods to the preload contract.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Extract shared `file-utils.js` (copyFileStreaming + audio extension allowlist)

`copyFileStreaming` is duplicated ~100 lines verbatim in `index-modular.js:128-228` and `ipc-handlers.js:338-444`. The supported-audio-extension set is defined three times: `index-modular.js:231` (`SUPPORTED_AUDIO_EXTS_MAIN`), `ipc-handlers.js:38` (`SUPPORTED_AUDIO_EXTENSIONS`), and inline in the `validate-audio-file` handler (~ipc-handlers.js:1472-1484).

**Files:**
- Create: `src/main/modules/file-utils.js`
- Test: `tests/unit/main/file-utils.test.js`
- Modify: `src/main/index-modular.js` (delete local `copyFileStreaming` and `SUPPORTED_AUDIO_EXTS_MAIN`; import from file-utils; update usages at ~242, ~274, ~636)
- Modify: `src/main/modules/ipc-handlers.js` (delete local `copyFileStreaming` and `SUPPORTED_AUDIO_EXTENSIONS`; import from file-utils; update usages at ~448, ~456, ~656, and the inline list in `validate-audio-file`)

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces:
  - `SUPPORTED_AUDIO_EXTENSIONS: Set<string>` (lowercase extensions with dot)
  - `isSupportedAudioFile(filePath: string): boolean`
  - `copyFileStreaming(source: string, destination: string, { progressCallback?: (pct, copied, total) => void, debugLog?: object } = {}): Promise<{success: boolean, bytesCopied?: number, error?: string}>`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/main/file-utils.test.js`:

```js
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  SUPPORTED_AUDIO_EXTENSIONS,
  isSupportedAudioFile,
  copyFileStreaming
} from '../../../src/main/modules/file-utils.js';

describe('file-utils', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mxv-file-utils-'));
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('recognizes supported audio extensions case-insensitively', () => {
    expect(isSupportedAudioFile('/x/song.MP3')).toBe(true);
    expect(isSupportedAudioFile('/x/song.opus')).toBe(true);
    expect(isSupportedAudioFile('/x/notes.txt')).toBe(false);
    expect(SUPPORTED_AUDIO_EXTENSIONS.has('.mp3')).toBe(true);
  });

  it('copies a file and reports bytes', async () => {
    const src = path.join(tmpDir, 'src.mp3');
    const dest = path.join(tmpDir, 'nested', 'dest.mp3');
    fs.writeFileSync(src, 'audio-bytes');
    const result = await copyFileStreaming(src, dest);
    expect(result.success).toBe(true);
    expect(fs.readFileSync(dest, 'utf8')).toBe('audio-bytes');
  });

  it('invokes the progress callback and finishes at 100', async () => {
    const src = path.join(tmpDir, 'src.mp3');
    const dest = path.join(tmpDir, 'dest.mp3');
    fs.writeFileSync(src, 'x'.repeat(1024));
    const calls = [];
    const result = await copyFileStreaming(src, dest, {
      progressCallback: (pct, copied, total) => calls.push([pct, copied, total])
    });
    expect(result.success).toBe(true);
    expect(calls.at(-1)[0]).toBe(100);
  });

  it('returns failure (not throw) for a missing source', async () => {
    const result = await copyFileStreaming(
      path.join(tmpDir, 'missing.mp3'),
      path.join(tmpDir, 'dest.mp3')
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/does not exist/);
    expect(fs.existsSync(path.join(tmpDir, 'dest.mp3'))).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/main/file-utils.test.js`
Expected: FAIL — cannot resolve `src/main/modules/file-utils.js`.

- [ ] **Step 3: Create `src/main/modules/file-utils.js`**

Port the `ipc-handlers.js` implementation (the two copies are functionally identical), parameterizing the logger:

```js
/**
 * Shared file utilities for the main process.
 */

import fs from 'fs';
import path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

const SUPPORTED_AUDIO_EXTENSIONS = new Set(['.mp3', '.mp4', '.m4a', '.wav', '.ogg', '.flac', '.opus']);

function isSupportedAudioFile(filePath) {
  return SUPPORTED_AUDIO_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

// Streaming file copy for large files with optional progress tracking.
async function copyFileStreaming(source, destination, { progressCallback = null, debugLog = null } = {}) {
  let sourceStream = null;
  let destStream = null;

  try {
    if (!fs.existsSync(source)) {
      throw new Error(`Source file does not exist: ${source}`);
    }

    const destDir = path.dirname(destination);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    sourceStream = createReadStream(source);
    destStream = createWriteStream(destination);

    let bytesCopied = 0;
    let totalSize = 0;

    try {
      totalSize = fs.statSync(source).size;
    } catch (_statError) {
      debugLog?.warn('Could not get file size for progress tracking', {
        module: 'file-utils',
        function: 'copyFileStreaming',
        source
      });
    }

    if (progressCallback && totalSize > 0) {
      sourceStream.on('data', (chunk) => {
        bytesCopied += chunk.length;
        const progress = Math.round((bytesCopied / totalSize) * 100);
        progressCallback(progress, bytesCopied, totalSize);
      });
    }

    sourceStream.on('error', (error) => {
      debugLog?.error('Source stream error:', {
        module: 'file-utils',
        function: 'copyFileStreaming',
        error: error.message,
        source
      });
    });

    destStream.on('error', (error) => {
      debugLog?.error('Destination stream error:', {
        module: 'file-utils',
        function: 'copyFileStreaming',
        error: error.message,
        destination
      });
    });

    await pipeline(sourceStream, destStream);

    if (progressCallback) {
      progressCallback(100, totalSize, totalSize);
    }

    return { success: true, bytesCopied: totalSize };
  } catch (error) {
    try {
      if (fs.existsSync(destination)) {
        fs.unlinkSync(destination);
        debugLog?.info('Cleaned up partial destination file', {
          module: 'file-utils',
          function: 'copyFileStreaming',
          destination
        });
      }
    } catch (cleanupError) {
      debugLog?.warn('Failed to clean up partial file', {
        module: 'file-utils',
        function: 'copyFileStreaming',
        error: cleanupError.message,
        destination
      });
    }

    debugLog?.error('Streaming file copy error:', {
      module: 'file-utils',
      function: 'copyFileStreaming',
      error: error.message,
      source,
      destination
    });
    return { success: false, error: error.message };
  } finally {
    if (sourceStream && !sourceStream.destroyed) {
      sourceStream.destroy();
    }
    if (destStream && !destStream.destroyed) {
      destStream.destroy();
    }
  }
}

export { SUPPORTED_AUDIO_EXTENSIONS, isSupportedAudioFile, copyFileStreaming };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/main/file-utils.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Switch `ipc-handlers.js` to the shared module**

- Add to imports: `import { SUPPORTED_AUDIO_EXTENSIONS, isSupportedAudioFile, copyFileStreaming } from './file-utils.js';`
- Delete the local `const SUPPORTED_AUDIO_EXTENSIONS = new Set([...]);` (line ~38).
- Delete the local `async function copyFileStreaming(...)` (~lines 338-444).
- `file-copy` handler: change the extension check to `!isSupportedAudioFile(sourcePath)` and the call to `await copyFileStreaming(sourcePath, destPath, { debugLog })`.
- Directory-scan usage (~line 656): replace `SUPPORTED_AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())` with `isSupportedAudioFile(entry.name)`.
- `validate-audio-file` handler (~line 1472): replace its inline hardcoded extension array/set with `isSupportedAudioFile(filePath)` (preserve the handler's existing response shape exactly).

- [ ] **Step 6: Switch `index-modular.js` to the shared module**

- Add to imports: `import { isSupportedAudioFile, copyFileStreaming } from './modules/file-utils.js';`
- Delete local `copyFileStreaming` (~lines 128-228) and `const SUPPORTED_AUDIO_EXTS_MAIN = ...` (~line 231).
- Replace usages: line ~242 `files.filter(f => SUPPORTED_AUDIO_EXTS_MAIN.has(path.extname(f).toLowerCase()))` → `files.filter(f => isSupportedAudioFile(f))`; line ~274 similarly → `isSupportedAudioFile(arg)`; line ~636 `await copyFileStreaming(sourceFile, destFile)` → `await copyFileStreaming(sourceFile, destFile, { debugLog })`.

- [ ] **Step 7: Verify**

Run: `grep -n "SUPPORTED_AUDIO_EXTS_MAIN\|SUPPORTED_AUDIO_EXTENSIONS = new Set\|async function copyFileStreaming" src/main/index-modular.js src/main/modules/ipc-handlers.js` — expected: no output.
Run: `node --check src/main/index-modular.js && node --check src/main/modules/ipc-handlers.js` — expected: clean.
Run: `npm run test:unit` — expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: extract shared copyFileStreaming and audio extension allowlist

copyFileStreaming was duplicated ~100 lines verbatim between
index-modular.js and ipc-handlers.js, and the supported-audio-extension
list existed in three places (including a drifted inline copy in
validate-audio-file).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Live dependency getters — `getDb()` instead of snapshot `db`

Modules capture `db` into a module-level variable at init time. `library-transfer-manager.js:567` closes and replaces the database during library import, leaving `ipc-handlers.js`'s captured `db` pointing at a closed handle. Also, `ipc-handlers.js` works around static injection with 19 `await import('../index-modular.js')` calls just to reach `getCurrentProfile`/`getProfileDirectory` — functions that can simply be injected.

**Files:**
- Modify: `src/main/index-modular.js` (add `getDb`, `setDb`, `getProfileDirectory` to the `dependencies` object ~line 817; pass `getDb`/`setDb` to `libraryTransferManager.initialize...` ~line 854)
- Modify: `src/main/modules/ipc-handlers.js` (replace `let db` with `let getDb`; replace all `db.` usages with `getDb().`; capture `getCurrentProfile`/`getProfileDirectory` from dependencies; replace the 19 dynamic-import blocks)
- Modify: `src/main/modules/library-transfer-manager.js` (use `getDb`/`setDb`)
- Modify: `tests/unit/main/ipc-handlers-db.test.js` and any other unit test that injects `db` (keep passing via compat fallback, or update to `getDb` — inspect first)

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces: `dependencies.getDb(): Database|null`, `dependencies.setDb(next: Database|null): void`, `dependencies.getProfileDirectory(type: string): string` — alongside the existing `dependencies.getCurrentProfile()`. `dependencies.db` remains for backward compatibility during the transition.

- [ ] **Step 1: Add getters in `index-modular.js`**

In the `dependencies` object (~line 817), keep `db` but add:

```js
  const dependencies = {
    mainWindow,
    db, // legacy snapshot — prefer getDb()
    getDb: () => db,
    setDb: (next) => { db = next; },
    getProfileDirectory,
    store,
    ...
```

(`getCurrentProfile` is already in the object; `getProfileDirectory` is already exported from this file — verify the exact name via `grep -n "function getProfileDirectory" src/main/index-modular.js` and add it.)

Update the library-transfer init (~line 854):

```js
  libraryTransferManager.initializeLibraryTransferManager({
    debugLog,
    getDb: () => db,
    setDb: (next) => { db = next; },
    store
  });
```

- [ ] **Step 2: Convert `ipc-handlers.js` to live getters**

- Replace the module-level `let db;` with `let getDb = () => null;` and add `let getCurrentProfile; let getProfileDirectory;`.
- In `initializeIpcHandlers(dependencies)` replace `db = dependencies.db;` with:

```js
  getDb = dependencies.getDb || (() => dependencies.db);
  getCurrentProfile = dependencies.getCurrentProfile;
  getProfileDirectory = dependencies.getProfileDirectory;
```

- Replace every `db.prepare(`/`db.` usage with `getDb().prepare(` etc. Find them all: `grep -n "[^a-zA-Z.]db\." src/main/modules/ipc-handlers.js`. (~20 sites; all are `db.prepare` today.)
- Replace each of the 19 dynamic-import workaround blocks. Pattern — before:

```js
      const mainModule = await import('../index-modular.js');
      const profile = mainModule.getCurrentProfile();
```

after:

```js
      const profile = getCurrentProfile();
```

and likewise `mainModule.getProfileDirectory(type)` → `getProfileDirectory(type)`. Handle all 19 occurrences (lines ~1504-2383); after this, `grep -n "await import('../index-modular.js')" src/main/modules/ipc-handlers.js` must return nothing.
- Also replace the redundant dynamic `const profileManager = await import('./profile-manager.js');` occurrences (~lines 1587, 1920) with the existing top-level static `profileManager` import.

- [ ] **Step 3: Convert `library-transfer-manager.js`**

Replace the module-level `let db = null;` with `let getDb = () => null; let setDb = () => {};` and in `initializeLibraryTransferManager` replace `db = dependencies.db;` with:

```js
  getDb = dependencies.getDb || (() => dependencies.db);
  setDb = dependencies.setDb || (() => {});
```

At the close site (~line 567), change:

```js
        if (db && typeof db.close === 'function') {
          ...
            db.close();
```

to:

```js
        const currentDb = getDb();
        if (currentDb && typeof currentDb.close === 'function') {
          ...
            currentDb.close();
            setDb(null);
```

(keep the surrounding try/catch and logging as-is). Check for any other `db` reads in the file (`grep -n "[^a-zA-Z.]db[^a-zA-Z]" src/main/modules/library-transfer-manager.js`) and convert them to `getDb()`.

- [ ] **Step 4: Update unit tests that inject `db`**

Inspect `tests/unit/main/ipc-handlers-db.test.js`, `tests/unit/main/library-transfer-manager.test.js`, and `tests/unit/main/ipc-handlers-file-delete.test.js` for `db:` in their dependency objects. The compat fallback (`dependencies.getDb || (() => dependencies.db)`) means they should pass unchanged — run them first; only if a test asserts on internals that changed, update it to pass `getDb: () => fakeDb` instead.

- [ ] **Step 5: Verify**

Run: `npm run test:unit` — expected: PASS.
Run: `grep -c "await import('../index-modular.js')" src/main/modules/ipc-handlers.js` — expected: 0.
Run: `node --check` on all three modified files — expected: clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: inject live getDb/getCurrentProfile getters instead of snapshots

Modules previously captured db once at init; library import closes and
replaces the database, leaving ipc-handlers holding a closed handle.
Also removes 19 dynamic re-imports of index-modular.js that existed
only to read getCurrentProfile/getProfileDirectory.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Extract `saveProfileState` into profile-manager, dedupe the two handlers

`profile:save-state` (~ipc-handlers.js:1574-1684) and `profile:save-state-before-switch` (~1892-2009) duplicate ~110 lines: count calculation, empty-over-existing warning, backup-before-overwrite, write. Extract one helper into `profile-manager.js` (which already owns `sanitizeProfileName`/`getProfilesDirectory`) and have both handlers delegate.

**Files:**
- Modify: `src/main/modules/profile-manager.js` (add `saveProfileState`; add to exports; add `import { promises as fsPromises } from 'fs';` if not present)
- Modify: `src/main/modules/ipc-handlers.js` (both handlers become thin delegations)
- Test: `tests/unit/main/profile-manager-save-state.test.js`

**Interfaces:**
- Consumes: `getCurrentProfile()` captured in Task 7; existing `profileManager` static import in ipc-handlers.js
- Produces: `profileManager.saveProfileState(profileName: string, state: object, { reason?: string } = {}): Promise<{success: boolean, error?: string}>` — throws on missing profileName; resolves `{success: true}` on write.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/main/profile-manager-save-state.test.js` (real fs against a temp dir, electron mocked like the existing profile-manager test):

```js
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { vi } from 'vitest';

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mxv-save-state-'));

vi.mock('electron', () => ({
  default: { app: { getPath: () => userDataDir } }
}));

const profileManager = await import('../../../src/main/modules/profile-manager.js');

const stateWithData = {
  hotkeys: [{ tabNumber: 1, hotkeys: { f1: '42' } }],
  holdingTank: [{ tabNumber: 1, songIds: ['7'] }]
};
const emptyState = { hotkeys: [], holdingTank: [] };

const stateFile = (name) =>
  path.join(userDataDir, 'profiles', name, 'state.json');

describe('saveProfileState', () => {
  beforeEach(() => {
    fs.rmSync(path.join(userDataDir, 'profiles'), { recursive: true, force: true });
  });
  afterAll(() => {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  });

  it('writes state.json under the sanitized profile directory', async () => {
    const result = await profileManager.saveProfileState('My Show', stateWithData);
    expect(result.success).toBe(true);
    const written = JSON.parse(fs.readFileSync(stateFile('My Show'), 'utf8'));
    expect(written.hotkeys[0].hotkeys.f1).toBe('42');
  });

  it('backs up the previous state before overwriting', async () => {
    await profileManager.saveProfileState('My Show', stateWithData);
    await profileManager.saveProfileState('My Show', emptyState);
    const backup = JSON.parse(
      fs.readFileSync(stateFile('My Show') + '.backup', 'utf8')
    );
    expect(backup.hotkeys[0].hotkeys.f1).toBe('42');
  });

  it('rejects a missing profile name', async () => {
    await expect(profileManager.saveProfileState(null, stateWithData)).rejects.toThrow(
      /No profile name/
    );
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/main/profile-manager-save-state.test.js`
Expected: FAIL — `saveProfileState` is not exported.

- [ ] **Step 3: Implement `saveProfileState` in `profile-manager.js`**

Add `import { promises as fsPromises } from 'fs';` to the imports if not already there, then add (near the other state/preferences functions):

```js
/**
 * Save a profile's hotkey/holding-tank state to its state.json,
 * backing up the existing file first. Warns (but does not block) when
 * an empty state would overwrite existing data — renderer-side
 * protection is primary; this is backup logging.
 * @param {string} profileName - Display name of the profile
 * @param {Object} state - { hotkeys: [...], holdingTank: [...] }
 * @param {Object} [options]
 * @param {string} [options.reason] - Context string for logs (e.g. 'window-close', 'profile-switch')
 * @returns {Promise<{success: boolean}>}
 */
async function saveProfileState(profileName, state, { reason = 'save' } = {}) {
  if (!profileName) {
    throw new Error('No profile name available for state save');
  }

  const sanitizedName = sanitizeProfileName(profileName);
  const profileDir = path.join(getProfilesDirectory(), sanitizedName);
  const stateFile = path.join(profileDir, 'state.json');

  const hotkeyCount = state?.hotkeys?.reduce((sum, tab) => sum + Object.keys(tab.hotkeys || {}).length, 0) || 0;
  const holdingTankCount = state?.holdingTank?.reduce((sum, tab) => sum + (tab.songIds?.length || 0), 0) || 0;
  const hasData = hotkeyCount > 0 || holdingTankCount > 0;

  debugLog?.info('Saving profile state', {
    module: 'profile-manager',
    function: 'saveProfileState',
    reason,
    profileName,
    sanitizedName,
    file: stateFile,
    hotkeyCount,
    holdingTankCount,
    hasData
  });

  if (!hasData) {
    try {
      const existingState = JSON.parse(await fsPromises.readFile(stateFile, 'utf8'));
      const existingHotkeyCount = existingState.hotkeys?.reduce((sum, tab) => sum + Object.keys(tab.hotkeys || {}).length, 0) || 0;
      const existingHoldingTankCount = existingState.holdingTank?.reduce((sum, tab) => sum + (tab.songIds?.length || 0), 0) || 0;

      if (existingHotkeyCount > 0 || existingHoldingTankCount > 0) {
        debugLog?.warn('Saving empty state over existing data (renderer allowed this)', {
          module: 'profile-manager',
          function: 'saveProfileState',
          reason,
          profileName,
          existingHotkeys: existingHotkeyCount,
          existingHoldingTank: existingHoldingTankCount,
          file: stateFile,
          note: 'User may have cleared data intentionally'
        });
      }
    } catch (readError) {
      debugLog?.info('No existing state file or could not read it', {
        module: 'profile-manager',
        function: 'saveProfileState',
        reason,
        error: readError.message
      });
    }
  }

  await fsPromises.mkdir(profileDir, { recursive: true });

  try {
    const backupFile = path.join(profileDir, 'state.json.backup');
    const existingData = await fsPromises.readFile(stateFile, 'utf8');
    await fsPromises.writeFile(backupFile, existingData, 'utf8');
  } catch (backupError) {
    debugLog?.info('Could not create backup (file may not exist)', {
      module: 'profile-manager',
      function: 'saveProfileState',
      reason,
      error: backupError.message
    });
  }

  await fsPromises.writeFile(stateFile, JSON.stringify(state, null, 2), 'utf8');

  debugLog?.info('Profile state saved successfully', {
    module: 'profile-manager',
    function: 'saveProfileState',
    reason,
    profileName,
    file: stateFile
  });

  return { success: true };
}
```

Add `saveProfileState` to the `export { ... }` block (~line 829).

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/main/profile-manager-save-state.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Delegate both handlers in `ipc-handlers.js`**

Replace the full body of `profile:save-state` with:

```js
  ipcMain.handle('profile:save-state', async (event, state, profileName) => {
    try {
      const name = profileName || getCurrentProfile();
      return await profileManager.saveProfileState(name, state, { reason: 'window-close' });
    } catch (error) {
      debugLog?.error('Error saving profile state', {
        module: 'ipc-handlers',
        function: 'profile:save-state',
        error: error.message
      });
      return { success: false, error: error.message };
    }
  });
```

Replace the full body of `profile:save-state-before-switch` with:

```js
  ipcMain.handle('profile:save-state-before-switch', async (event, state, profileName) => {
    try {
      const name = profileName || getCurrentProfile();
      return await profileManager.saveProfileState(name, state, { reason: 'profile-switch' });
    } catch (error) {
      debugLog?.error('Error saving profile state before switch', {
        module: 'ipc-handlers',
        function: 'profile:save-state-before-switch',
        error: error.message
      });
      return { success: false, error: error.message };
    }
  });
```

(`getCurrentProfile` is the injected dependency from Task 7; `profileManager` is the existing static import.)

- [ ] **Step 6: Verify**

Run: `npm run test:unit` — expected: PASS.
Run: `node --check src/main/modules/ipc-handlers.js && node --check src/main/modules/profile-manager.js` — expected: clean.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: extract saveProfileState into profile-manager

profile:save-state and profile:save-state-before-switch duplicated
~110 lines of count/warn/backup/write logic; both now delegate to a
single tested helper.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full unit suite + lint + preload build**

Run: `npm run test:unit` — expected: all PASS.
Run: `npx eslint src/main src/renderer src/preload --no-warn-ignored` (or the project's configured lint command from package.json if different) — expected: no new errors vs `main`.
Run: `npm run build:preload` — expected: success.

- [ ] **Step 2: Smoke e2e**

Run: `npm run test:smoke` — expected: PASS. (Requires the Playwright environment; if it fails for environmental reasons unrelated to the diff, report that explicitly rather than claiming success.)

- [ ] **Step 3: Manual sanity greps**

```bash
grep -rn "api-exposer\b" src/ tests/ | grep -v secure-api-exposer   # expect: nothing
grep -rn "'audio-volume'" src/                                      # expect: nothing
grep -rn "module-loader" src/ tests/                                 # expect: nothing
grep -c "await import('../index-modular.js')" src/main/modules/ipc-handlers.js  # expect: 0
```

- [ ] **Step 4: Report** — summarize test results honestly; do not merge or push (branch integration is a separate decision).
