# In-process profile switching

Date: 2026-10-17
Status: implemented on `claude/fervent-kirch-dd36bd`

## Problem

Every profile switch restarts the app. Switch Profile, switch-to / Log Out and
the launcher's "closed without choosing" fallback all call `app.relaunch()` +
`app.exit(0)`. The restart exists because `createWindow()` calls
`initializeModules()`, which registers every `ipcMain.handle` channel, and
Electron throws when a channel is registered twice. So `createWindow()` could
run only once per process.

The restart causes problems of its own (boards design review findings #2, #4, #16):

- `app.exit()` skips `before-quit`, so the switch had to flush analytics by
  hand, and the renderer's state save raced the exit.
- Cancelling the launcher after Switch Profile had to relaunch *again* with a
  `fallback-profile` store key to get the user back to their session. The
  in-memory session (playing audio, open search, scroll position) was lost
  even though the user cancelled.
- `fallback-profile` / `auto-select-profile` are global store keys that can
  go stale (a crash between write and relaunch leaves them behind).

## Design

### 1. Register once, at `ready`

IPC handlers, launcher handlers, file operations and the library transfer
manager are initialised once in the `ready` handler, before any window
exists. They already read live state through getters (`getMainWindow`,
`getCurrentProfile`, `getDb`); file operations is changed to take
`getMainWindow` instead of a captured window. `createWindow()` now only does
window work (first-run check, database, window, window-state saving, menu)
and is safe to call again.

### 2. `switchProfile(name)` in the main process

New module `src/main/modules/profile-switcher.js`. Its dependencies are
injected, so the order can be unit-tested. For a switch to `name`, it runs these steps in order:

1. **Flush** the old profile: `prepareMainWindowForClose()` (renderer
   `flushProfileState()` plus window bounds), skipped when the old profile has
   just been deleted.
2. **Fence** old-renderer saves: mark the switch in progress (implicit
   `profile:save-state` calls without an explicit profile name are refused)
   and set `window.isRestoringProfileState = true` in the old page. This
   keeps a late debounced save from writing the old profile's hotkeys into
   the new profile after `currentProfile` changes.
3. Set `currentProfile` and update its last-used time.
4. Restart the auto-backup timer for the new profile.
5. Sync `prerelease_updates` from the new profile's preferences into the
   global store. The existing `onDidChange` listener then reconfigures the
   updater.
6. Rebuild the application menu (Log Out's enabled state depends on the
   profile).
7. Apply the new profile's window bounds (`loadWindowState(store, name)`).
8. Analytics: `trackProfileSwitch` (`launcher` or `direct`).
9. `mainWindow.webContents.reload()`. The renderer re-bootstraps from
   scratch, which resets all `window.*` globals, stops audio and loads the new
   profile's state through the normal startup path.

Concurrent switch requests are serialised: a second request while one is
running is rejected.

### 3. Picker: one shared component, two containers

The picker is one component, `src/renderer/modules/profile-picker/picker-view.js`,
with its rules in `picker-model.js` and its styles in
`src/stylesheets/profile-picker.css`. It renders Bootstrap modal parts and
uses the main window's stylesheets, so it looks like the app's other dialogs.
Two containers mount it:

- **Startup:** `src/launcher.js` mounts it as the whole launcher window,
  because no main window exists yet. The window sizes itself to the list
  (`launcher:fit-to-content`, 240–560px), stays hidden until it has its size,
  and quits the app if closed without a choice.
- **Switch Profile:** `src/renderer/modules/profile-picker/index.js` mounts
  it in a Bootstrap dialog in the main window, like Preferences, with the
  same 8px corners and backdrop. A separate macOS sheet window was tried first.
  macOS 26 draws a sheet's corners much rounder than the app's dialogs, and
  CSS can't change that.

Shared behavior: dense rows, a description only when set, and a primary
button that names the target ("Open X" / "Switch to X"). While switching, the
running profile is grayed out with a Current tag and can't be chosen; if it
has only one other profile, that one starts selected. At startup the most
recently used profile is preselected.
New profile is a view inside the picker, not a nested dialog. Enter and Esc
are captured while the picker is open, so Enter can't reach the main window's
play-selected shortcut. Esc closes the New profile view first. F-key hotkeys
still work, as they do under Preferences.

Choosing a profile in the dialog calls `profile:switch-to` with method
`launcher`. Cancel, Esc or the close button just closes the dialog. The session never left memory.

If the running profile was just deleted (Delete Current Profile), the renderer
locks its state saves and opens the dialog with nothing marked current.
Closing it switches to Default User, so a deleted profile is never revived.

Cold start is unchanged: without `--profile=` the launcher opens in
"startup" mode, and closing it quits the app. `--profile=` still skips the
launcher.

### 4. Flows

| Flow | Before | After |
|---|---|---|
| Switch Profile | save, relaunch to launcher | dialog in the main window |
| Switch → pick | new process | `switchProfile(name)`, reload |
| Switch → cancel (button, Esc, close) | relaunch with `fallback-profile` | dialog closes, session untouched |
| Log Out | relaunch with `--profile=Default User` | `switchProfile('Default User')` |
| Delete current | delete, then Switch Profile | delete, then dialog; cancel → Default User |

`fallback-profile` and `auto-select-profile` are no longer written. Startup
deletes any left over from older versions.

## Audio across a switch, and boards

Today the reload stops playback, so a switch cuts whatever is playing (for
example house music at the end of the night). The target behavior is for
the current track to keep playing through any switch (pick, Log Out,
Delete Current Profile). Stop, Pause and fade work as usual, using the new
profile's fade time. Playlist mode does not advance into the new holding
tank. Songs live in the shared library, so the track is valid in every
profile.

That needs a swap inside the running page instead of a reload, and boards
(2026-10-17-boards-design.md) already requires exactly that swap: a board
switch keeps the playing song going. Under boards, entering a profile means
loading its active board plus a small set of profile preferences (theme,
font size, fade time, column order, holding-tank mode). The main-process
steps above stay as they are. So the order is:

1. **This change:** in-process switch, picker as an in-window dialog, page reload. The
   reload is the clean-start guarantee for now.
2. **Boards:** build "load board in place, playback untouched". Startup, board
   switch and profile switch use that one load path.
3. **Then:** profile switch uses it, and the `webContents.reload()` step goes
   away. The guarantee becomes a test: after switching A → B, B's layout and
   saved state match a fresh start of B.

A separate in-place profile swap before boards would be built twice, the
first time around `state.json`, which boards retires. If the gap matters
before boards lands, a stopgap is to record the song, position and volume
before the reload and resume afterwards (about a one-second dropout).

### Proposed edits to the boards brief

- *Opening and leaving:* replace "Choosing Switch Profile closes the show
  window and opens the launcher, as it does today. Closing that launcher …
  The live session comes back from the recovery copy" with: Switch Profile
  opens the profile picker as a dialog in the show window. Cancelling it, or
  picking the same person, returns to the live session, which never left
  memory. Nothing is restored, because nothing was torn down.
- *Decisions table, "Backing out of Switch Profile keeps the night":* the
  reason becomes "the session is still in memory while the picker is open".
  It no longer depends on the launcher's fallback profile, which is gone.
- *Opening and leaving:* add that a profile switch, like a board switch,
  leaves the playing song running and does not advance playlist mode.
- *Refactoring:* "Profile switch today saves the live layout before it
  leaves" maps to `profile-switcher.js`'s flush step. Under boards that step
  retires the recovery record instead.

## Out of scope

- `appSetup.setupAppLifecycle()` runs before `initializeAppSetup()`, so
  the lifecycle listeners (`before-quit` flush, macOS `activate`) are never
  attached. That is tracked separately. With registration moved out of
  `createWindow()`, the `activate → createWindow` path becomes safe to enable.
