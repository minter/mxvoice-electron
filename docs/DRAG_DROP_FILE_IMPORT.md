# Drag-and-Drop File Import — Feature Architecture

## Overview

Allow users to add songs by dropping audio files onto the app window or the
dock/taskbar icon. A single valid file triggers the existing "Add Song" modal;
multiple valid files trigger the "Bulk Add" flow. Non-audio files are silently
ignored.

---

## Current State

| Component | Location | Notes |
|---|---|---|
| Supported extensions | `src/renderer/modules/bulk-operations/bulk-operations.js:25` | `SUPPORTED_AUDIO_EXTS`: `.mp3 .mp4 .m4a .wav .ogg` |
| File dialog extensions | `src/main/modules/file-operations.js:271` | Same 5 formats (now unified) |
| Single-song add | `src/renderer/modules/song-management/song-crud.js:219` | `startAddNewSong(filename, metadata)` |
| Bulk add (directory) | `src/renderer/modules/bulk-operations/bulk-operations.js:180` | `saveBulkUpload()` — walks directory, filters by extension |
| Per-file processor | `src/renderer/modules/bulk-operations/bulk-operations.js:49` | `addSongsByPath(pathArray, category)` — reusable for file-list input |
| Existing drag-drop | `src/renderer/modules/drag-drop/` | Internal only: song→hotkey, song→holding-tank, column reorder |
| IPC bridge (add) | `src/renderer.js:597-606` | `onAddDialogLoad` → `startAddNewSong` |
| IPC bridge (bulk) | `src/renderer.js:610-619` | `onBulkAddDialogLoad` → `showBulkAddModal` |
| Main entry | `src/main/index-modular.js` | Electron 41, context isolation + sandbox enabled |
| Window creation | `src/main/modules/app-setup.js:44` | `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true` |
| Preload | `src/preload/preload-bundle.cjs` | Secure API exposed via `contextBridge` |

---

## Design

### 1. Shared Extension Constant

All extension lists (bulk-operations, file dialog, validate-audio-file, Howler
format hint) are now unified to the same 7 formats:

```
.mp3  .mp4  .m4a  .wav  .ogg  .flac  .opus
```

Export the set from `bulk-operations.js` (or move it to a shared constants
module) so both the renderer drop handler and the main-process file dialog can
reference it rather than maintaining separate lists.

### 2. Window Drop Zone (Renderer)

**File:** new module `src/renderer/modules/drag-drop/file-drop-handler.js`

Listen on the `document` for `dragover`, `dragenter`, `dragleave`, and `drop`
events from the OS (files dragged from Finder/Explorer have
`dataTransfer.files`).

```
document  dragover   → preventDefault (required to allow drop)
document  dragenter  → show visual drop overlay
document  dragleave  → hide overlay (debounce to avoid flicker on child elements)
document  drop       → extract file paths, filter, route
```

**Filtering logic:**

```js
const validFiles = [...e.dataTransfer.files]
  .filter(f => SUPPORTED_AUDIO_EXTS.has(
    f.name.substring(f.name.lastIndexOf('.')).toLowerCase()
  ))
  .map(f => f.path);   // Electron exposes .path on File objects
```

**Routing:**

| Valid file count | Action |
|---|---|
| 0 | Show toast/notification: "No supported audio files found" |
| 1 | Send path to main process for metadata parsing, then trigger `startAddNewSong` (same as existing file-dialog flow) |
| 2+ | Open bulk-add modal pre-populated with the file list (new flow — see §4) |

**Conflict with existing internal drag-drop:** The existing handlers in
`event-handlers.js` use `dataTransfer.getData('text')` for song IDs. OS file
drops will have `dataTransfer.files.length > 0` and no text data. Check for
`files.length` first; if present, treat as external file drop and
`stopPropagation()`. Otherwise, fall through to existing internal handlers.

### 3. Dock/Taskbar Icon Drop (Main Process)

**File:** `src/main/index-modular.js` (or `app-setup.js`)

#### macOS — `app.on('open-file')`

Electron emits `open-file` when files are dropped onto the dock icon (or
double-clicked if the app is the default handler). This fires once per file.

```js
const pendingFiles = [];
let pendingTimer = null;

app.on('open-file', (event, filePath) => {
  event.preventDefault();
  pendingFiles.push(filePath);
  clearTimeout(pendingTimer);
  // Batch: wait 200ms for more files before dispatching
  pendingTimer = setTimeout(() => flushPendingFiles(), 200);
});

function flushPendingFiles() {
  const files = pendingFiles.splice(0);
  const valid = files.filter(f =>
    SUPPORTED_AUDIO_EXTS.has(path.extname(f).toLowerCase())
  );
  if (!valid.length) return;
  if (!mainWindow) return;  // app not ready yet — queue for 'ready'
  mainWindow.webContents.send('external-files-dropped', valid);
}
```

#### Windows — `app.on('second-instance')`

Files dropped on the .exe shortcut arrive as additional argv entries. The
`second-instance` event already exists in most Electron apps for single-instance
locking.

```js
app.on('second-instance', (event, argv) => {
  const files = argv.slice(1).filter(f =>
    SUPPORTED_AUDIO_EXTS.has(path.extname(f).toLowerCase())
  );
  if (files.length && mainWindow) {
    mainWindow.webContents.send('external-files-dropped', files);
    mainWindow.focus();
  }
});
```

### 4. Bulk-Add from File List (New Flow)

The existing `saveBulkUpload()` takes a directory, walks it, then calls
`addSongsByPath(songs, category)`. For dropped files we already have the list —
we just need the category selection step.

**Option A (recommended):** Add a new function `showBulkAddFromFiles(filePaths)`
that:

1. Stores the file list in module state (skip the directory walk)
2. Opens the same `#bulkAddModal` but hides the directory path field and shows a
   summary instead ("12 audio files ready to import")
3. On submit, calls the existing `addSongsByPath(filePaths, category)` directly

This keeps the existing directory-based flow untouched and adds a parallel
entry point that shares the same processing pipeline.

### 5. IPC Channels

New IPC channel for both dock-drop and window-drop (when metadata parsing is
needed):

| Channel | Direction | Payload | Purpose |
|---|---|---|---|
| `external-files-dropped` | main → renderer | `string[]` file paths | Dock/taskbar drop delivery |
| `parse-audio-metadata` | renderer → main | `string` file path | Request metadata for single-file add |
| `parse-audio-metadata` response | main → renderer | `object` metadata | Return parsed metadata |

The `parse-audio-metadata` channel may already exist as part of the preload
secure API (`window.secureElectronAPI.audio.getMetadata`). If so, reuse it
rather than adding a new channel.

For the window drop zone, the renderer already has the file paths. For a single
file, it calls `window.secureElectronAPI.audio.getMetadata(path)` to get
metadata, then calls `startAddNewSong(path, metadata)` directly — no new IPC
needed.

### 6. Preload Bridge

Expose the new `external-files-dropped` event in the preload script alongside
the existing event listeners:

```js
// In secure-api-exposer.cjs or ipc-bridge.cjs
onExternalFilesDrop: (callback) => {
  ipcRenderer.on('external-files-dropped', (_event, files) => callback(files));
}
```

Register the listener in `src/renderer.js` alongside the existing IPC event
wiring (~line 570):

```js
if (typeof window.secureElectronAPI.events.onExternalFilesDrop === 'function') {
  window.secureElectronAPI.events.onExternalFilesDrop((files) => {
    window.moduleRegistry.dragDrop.handleExternalFileDrop(files);
  });
}
```

### 7. Visual Feedback — Drop Overlay

When files are dragged over the window, show a full-window semi-transparent
overlay with a message like "Drop audio files to import". This provides clear
affordance that the app accepts file drops.

```css
#file-drop-overlay {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.6);
  border: 3px dashed rgba(255, 255, 255, 0.6);
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  color: white;
  pointer-events: none;
}
#file-drop-overlay.active { display: flex; }
```

Add the overlay element to the main HTML file. Toggle `.active` on
`dragenter`/`dragleave`/`drop`.

---

## Implementation Order

1. **~~Unify extension constants~~** — DONE: all four lists now use
   `.mp3 .mp4 .m4a .wav .ogg .flac .opus` (removed `.aac`/`.wma`, added `.opus`)
2. **Window drop zone** — new `file-drop-handler.js` module + drop overlay HTML/CSS
3. **Bulk-add from file list** — `showBulkAddFromFiles()` function in
   `bulk-operations.js`
4. **Wire single-file drop** — metadata parse → `startAddNewSong()`
5. **Wire multi-file drop** — filter → `showBulkAddFromFiles()`
6. **Preload bridge** — expose `external-files-dropped` event
7. **Dock icon drop (macOS)** — `app.on('open-file')` with batching
8. **Taskbar drop (Windows)** — `app.on('second-instance')` argv parsing
9. **Tests** — unit tests for filtering logic, E2E test for drop-to-import flow

Steps 1–5 can ship as a first PR (window drop only). Steps 6–8 can follow as a
second PR (icon drop).

---

## Edge Cases

| Scenario | Behavior |
|---|---|
| Mix of audio + non-audio files | Non-audio silently filtered out; proceed with valid files |
| All dropped files are non-audio | Toast: "No supported audio files found" |
| Single audio file among many non-audio | Treat as single-file add (show Add Song modal) |
| Drop during an open modal | Ignore drop (check for open modal before processing) |
| Duplicate file (already in library) | Handled by existing `addSongsByPath` — creates new entry with unique filename |
| File path with special characters | Electron's `File.path` handles this; no encoding needed |
| App not fully loaded when dock-drop fires | Queue files; deliver after `mainWindow` is ready |
| Very large batch (100+ files) | Existing bulk-add progress display handles this |

---

## Files Modified/Created

| File | Change |
|---|---|
| `src/renderer/modules/drag-drop/file-drop-handler.js` | **New** — window drop zone logic |
| `src/renderer/modules/drag-drop/index.js` | Import and initialize file-drop-handler |
| `src/renderer/modules/bulk-operations/bulk-operations.js` | Add `showBulkAddFromFiles()`, export `SUPPORTED_AUDIO_EXTS` |
| `src/main/modules/file-operations.js` | Already consistent; extract to shared constant if desired |
| `src/main/index-modular.js` or `src/main/modules/app-setup.js` | Add `open-file` and `second-instance` handlers |
| `src/preload/modules/secure-api-exposer.cjs` or `ipc-bridge.cjs` | Expose `onExternalFilesDrop` |
| `src/renderer.js` | Wire `onExternalFilesDrop` listener |
| Main HTML file | Add `#file-drop-overlay` element |
| CSS | Styles for drop overlay |
