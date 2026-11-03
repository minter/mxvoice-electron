# Profile State Module

Serializes the live layout (all five hotkey tabs, all five holding-tank tabs,
custom tab names, and the selected tab of each) and writes it to the main
process's crash-recovery record through `secureElectronAPI.shows.saveRecovery`.

Saved layouts live in the profile's `shows.json` and are opened at startup by
the shows module (`src/renderer/modules/shows/`). Nothing here writes a saved
show or `state.json`; a 4.3.x `state.json` is migrated into a show named
"Default Show" by the main process the first time the profile opens, and is never
changed.

- A clean quit, a profile switch and Log Out discard the live layout (the main
  process retires the recovery record).
- After a crash, the next open of the same profile asks whether to restore the
  show in progress.

## API

```javascript
extractLayout()        // { hotkeys, holdingTank, selected: { hotkeyTab, holdingTankTab } }
saveProfileState()     // debounced (300 ms) recovery write; the ~30 call sites are unchanged
flushProfileState()    // write any pending save now (main calls it on close and switch)
clearProfileRestorationLock()
initializeProfileState({ hotkeysModule, holdingTankModule })
```

`saveProfileState()` and `flushProfileState()` resolve `{ success: true }` when
the record was written, retired (the layout matches the saved show) or
skipped by the main session (not ready yet). They resolve
`{ success: false, error }` when the write failed.

## Restoration lock

`window.isRestoringProfileState` blocks saves while a layout is being put in
place. The shows module sets it when it starts opening the show and clears
it after reporting the show ready or failed. Library import, backup restore
and profile switching also set it so the old page cannot write once its
session is over. The main session refuses recovery writes while it is
loading, so the flag is a second guard.
