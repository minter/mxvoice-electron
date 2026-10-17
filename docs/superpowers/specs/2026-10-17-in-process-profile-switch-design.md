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

### 3. Picker: reuse the launcher window (recommended)

Options considered:

- **Launcher window, same process (chosen).** Switch Profile hides the main
  window and opens the existing launcher window in "switch" mode. Choosing a
  profile calls `switchProfile(name)` and re-shows the main window. Closing
  the launcher re-shows the main window untouched. The session stays in
  memory, and no store key or relaunch is involved. This reuses the launcher
  UI, preload and E2E helpers unchanged.
- **Modal in the main window.** It looks nicer (no second window), but it means
  porting the launcher's list/create/delete UI into the main renderer, and the
  modal would be torn down by the very reload it triggers. It is more work and
  gives no extra safety.

If the active profile was deleted while the picker was open (or by
Delete Current Profile), cancelling falls back to `switchProfile('Default
User')` rather than reviving a deleted profile.

Cold start is unchanged: without `--profile=` the launcher opens in
"startup" mode, and closing it quits the app. `--profile=` still skips the
launcher.

### 4. Flows

| Flow | Before | After |
|---|---|---|
| Switch Profile | save, relaunch to launcher | save, hide main, launcher (switch mode) |
| Switch → pick | new process | `switchProfile(name)`, reload |
| Switch → cancel | relaunch with `fallback-profile` | re-show main window |
| Log Out | relaunch with `--profile=Default User` | `switchProfile('Default User')` |
| Delete current | delete, then Switch Profile | delete, then picker; cancel → Default User |

`fallback-profile` and `auto-select-profile` are no longer written. Startup
deletes any left over from older versions.

## Out of scope

- `appSetup.setupAppLifecycle()` runs before `initializeAppSetup()`, so
  the lifecycle listeners (`before-quit` flush, macOS `activate`) are never
  attached. That is tracked separately. With registration moved out of
  `createWindow()`, the `activate → createWindow` path becomes safe to enable.
