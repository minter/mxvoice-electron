# Boards — Adversarial Review

Reviews `2026-10-17-boards-design.md` against the code at `56d1f9d`. I checked every code claim below myself or had it confirmed by a second read. Where a finding touches a decision listed in the brief's "Decisions that look like open questions" table, I name the new fact. I do not reargue those decisions.

**Overall.** The product model (profile = person, board = show, live session = disposable) is sound and fits the problem well. The weak point is that the brief assumes the app can tell a clean exit from a crash, and can tell a profile switch from a back-out. **The code cannot do either today.** Several of the exit paths the brief depends on are also racy or not wired up. Most of the risk is in that plumbing, not in the UI.

Findings are ordered by severity. **P0** means the design will not behave as written without this. **P1** means likely data loss or wrong behavior at a show. **P2** is spec gaps and polish.

---

## P0 — Prerequisites the brief assumes but the code doesn't have

### 1. There is no clean-exit signal, and the quit lifecycle is not registered

- `setupApp()` runs at module load (`src/main/index-modular.js:1186`) and calls `appSetup.setupAppLifecycle()`. That function is `return appLifecycle?.setup()` (`src/main/modules/app-setup.js:383-385`).
- But `appLifecycle` is only assigned in `initializeAppSetup` (`app-setup.js:67`). That runs later, inside `createWindow` (`index-modular.js:745`). **So `before-quit` and `window-all-closed` are never registered in production.**
- `isQuitting()` is always false. Quitting works only because the window `close` handler flushes, and then Electron's default all-windows-closed behavior quits the app.
- The unit test `app-setup-orchestration.test.js` calls `initializeAppSetup` first, which hides the bug.
- Nothing distinguishes a clean exit from a crash today: no session marker, no PID file, no `render-process-gone` handler.

**Brief change:** add a "Session lifecycle" section that lists every exit path and how each one is classified. Fix lifecycle registration *before* any boards work.

| Exit path | Code today | Proposed classification |
| --- | --- | --- |
| Cmd-Q / File → Quit | window `close` handler → flush → default quit | clean: retire recovery |
| Close window (also quits on macOS, because no `window-all-closed` handler is registered) | same | clean |
| Switch Profile | `win.close()` then **synchronous** `app.relaunch(); app.exit(0)` (`ipc/profile-handlers.js:265-272`) | hand-off: keep recovery, see #2 |
| Log Out / switch-to | same pattern (`profile-handlers.js:380-426`) | different profile opens: retire |
| Launcher closed, falls back to the previous profile | `relaunch(--profile=fallback)` (`launcher-window.js:97-131`) | back-out: restore silently |
| Install update | `autoUpdater.quitAndInstall()` (`app-update-handlers.js:69,189`, `index-modular.js:1101`) | **not specified.** It throws the night away mid-show. Treat it as a hand-off and restore silently on the next launch of the same profile. |
| `app.restart` IPC (library import) | `app.relaunch(); app.exit()` (`app-update-handlers.js:53-58`) | discard: profiles dir was replaced |
| Renderer reload: backup restore, View → Start a New Session | `location.reload()` | **not specified**, see #6 |
| Renderer crash with the main process still alive | no handler; window goes blank, user quits | **must count as a crash**, not clean, see #3 |
| Main-process uncaught exception | `process.on('uncaughtException')` swallows it in packaged builds (`index-modular.js:670`) | crash |
| OS shutdown / force quit / power loss | — | crash, which is the right default |

### 2. "Switch Profile stops saving" contradicts "back-out restores from the recovery copy"

- The Refactoring section says *"Profile switch today saves the live layout before it leaves. That save has to stop."*
- The back-out rule needs the opposite. Closing the launcher relaunches a **new process** (`launcher-window.js:97-131`), and the session can only come back if the switch flushed it to disk first.
- Recovery writes are debounced by 300 ms (`profile-state/index.js:101-113`). The switch path also kills the close-handler flush mid-flight with `app.exit(0)`. So the last edits before choosing Switch Profile would be lost on back-out.

**Change:**
- The switch must still flush. It flushes **to the recovery record**, synchronously, before `app.exit`.
- Then write a hand-off token, e.g. `{fromProfile, reason:'switch', at}`. The existing `fallback-profile` store key is the natural place.
- On the next profile open:
  - token present and same profile → restore recovery silently;
  - token present and different profile → retire the *from* profile's recovery;
  - no token and recovery exists → crash prompt.
- Clear the token in all three cases.
- Also fix the launcher race: closing the launcher while `mainAppLauncher` is still awaiting triggers the fallback relaunch and kills the window that just opened (`launcher-window.js`, `profileSelected` is set after the await).

### 3. A renderer crash followed by a quit would be classified as clean and destroy the night

This is the scenario crash recovery exists for. The renderer dies, the window goes white, and the operator presses Cmd-Q. Under a "quit = retire" rule, the recovery record is deleted.

**Change:**
- Handle `webContents.on('render-process-gone')` and `'unresponsive'`: mark the session crashed and stop retiring.
- Better, offer an in-place reload that restores the recovery copy without asking. Same person, same show.
- More generally, retire only when the renderer confirms it is alive. One way: main asks the renderer to finalize, the renderer acknowledges, then main deletes the record.

### 4. Retire-vs-write race

- Recovery writes come from the renderer on a 300 ms debounce. If main deletes the recovery file at clean exit while a debounced write is still in flight, the file reappears and the next launch shows a false crash prompt.
- The same race exists today between the switch save and the debounced save to `state.json`: two unsynchronized `writeFile` calls plus a backup copy.

**Change:** main owns a per-session `closing` flag. Once retire starts, it rejects recovery writes. Retire happens in main, synchronously, before any `app.exit`.

### 5. The board menu needs runtime menu rebuilds, and none exist

- The application menu is built once per process (`index-modular.js:830`). There is no `getMenuItemById`, no radio or checkbox items, and no rebuild path. Build-once has worked only because profile switches relaunch the process.
- Board switch, New, Rename, Delete and Import all happen in-process. Each one changes item labels (`Update "Comedy Sports"`), checkmarks and the list.

**Change:**
- Add a `rebuildApplicationMenu(boardsState)` that main calls after every board mutation.
- Escape `&` in board names on Windows and Linux. `&` is a mnemonic marker there, so "Mom & Pop" shows as "Mom  Pop".
- Truncate long names in labels.
- Use `type:'radio'` for the board list.

---

## P1 — Likely data loss or wrong behavior at a show

### 6. Renderer reload paths are undefined under the new model

- **View → Start a New Session** (`ui/ui-manager.js:76-108`) only calls `location.reload()`. Today it does *not* clear hotkeys or the holding tank: the reload restores them from `state.json`.
- The brief says it "changes the live session only". That leaves open whether the reload restores the recovery copy (then it does nothing) or loads the saved board (then it is a silent revert).
- Profile backup restore also uses `location.reload()`.

**Change:**
- Either redefine Start a New Session as **"Revert to 'Comedy Sports'"**: reload the active saved board and discard the live session.
- Or remove it.

I recommend the revert command. Under this model there is otherwise no way back to the prepared show mid-session except switching to another board and back, which needs a second board. A revert also answers the original complaint directly ("there is no way back to the prepared layout"). It is a sibling of board switch, so the same silent-discard rules apply, and it does not conflict with any settled decision.

### 7. Board writes are not atomic, and a corrupt file loads as empty and then gets overwritten

- `saveProfileState` copies the file to `state.json.backup` and then calls a plain `fsPromises.writeFile` (`profile-manager.js:868-883`). There is no temp-and-rename and no fsync.
- On load, unparseable JSON returns `loaded:false` (`profile-state/index.js:228-240`). The app starts empty, and the first save overwrites the corrupt file.
- The `.backup` copy is never read. It is also overwritten with the corrupt content by that first save.
- That was tolerable for a file rewritten every few seconds. Boards are the opposite: written rarely, by hand, and precious.

**Change (state these as brief requirements):**
- Boards are written with temp file → fsync → rename. Keep one previous generation (`boards.json.prev`).
- An unreadable boards file is **never** treated as empty and never overwritten. Load `.prev` and show a clear error.
- Recovery writes are also atomic. A torn recovery file is exactly what a crash produces.

### 8. Song ids can be reused, so long-lived boards can play the wrong track

- The schema is `id INTEGER PRIMARY KEY` **without `AUTOINCREMENT`** (`database-setup.js:245-246`). SQLite reuses the highest id after that row is deleted.
- Today the layout is overwritten nightly, so the exposure is small. Boards will live for months and get copied across profiles.
- Example: Derek's board references song 812. Someone deletes song 812 (the newest import), then imports a new track, which gets id 812. Derek's "Comedy Sports" F5 now plays the new track at the show.
- Song deletion today clears the id from the *live* models (`song-management/song-removal.js:91-101`). It cannot clean the saved boards of every profile.
- A related problem: pointing `database_directory` at a different library makes every id dangle, or match the wrong song.

This is a new fact against the Architecture line "Boards store song ids only". **Change, either:**
- **(a)** Migrate `mrvoice` to `AUTOINCREMENT`. That means a one-time table rebuild with `sqlite_sequence` seeded to `MAX(id)`. It is cheap, and it fixes the problem for live sessions too. Or:
- **(b)** Store `{id, filename}` per slot and drop any slot whose filename no longer matches on load.

(a) is the smaller change. (b) also catches library swaps. Doing both is reasonable.

### 9. Loading a board must never write the pruned result back

- Today, missing ids are pruned in memory on restore (`hotkeys/index.js:168-211`, `holding-tank/index.js:115-151`) and then persisted by the next save.
- If a board loads while the library is temporarily wrong (unmounted external drive, wrong `database_directory`), a later **Update** would make the loss permanent.

**Change:**
- State in the brief that dropping missing ids affects the live session only. The saved board keeps them.
- When ids are dropped, surface a count, e.g. "3 songs in this board aren't in the library". The operator should not find out by pressing F5.

### 10. The Update guard targets the wrong thing

- The brief says to aim the startup guard at saved boards and exempt Update, "including an intentional empty board".
- But saved boards are only written by explicit actions anyway. The real risk is **Update clicked while the board is half-loaded**:
  - during init;
  - after `restoreHotkeySnapshot` throws (the catch clears the lock and the holding tank is never restored, `profile-state/index.js:354-356`);
  - mid board switch, while `getSongsByIds` is awaiting.
- In those states, Update stores a partial layout on purpose.

**Change:**
- Disable Update, New Board and Delete in the menu until the renderer reports `boardLoad: 'ready'` for the current load generation.
- Report load failures as `'failed'`. Don't fall through to an empty layout.
- The global `window.isRestoringProfileState` boolean is not enough: it is cleared before holding-tank init (`renderer.js:521-525`). It is also set by unrelated flows (library import, backup restore).

### 11. Auto-backup will churn on the recovery record and push out good backups

- Auto backup runs every 30 minutes and copies the whole profile directory when its hash changes (`auto-backup-timer.js`, `profile-backup-manager.js:556-601`). Retention keeps 25 backups.
- If the recovery record lives in the profile directory, every show creates a backup roughly every 30 minutes of nothing but live-session churn. That pushes the older backups that hold real board history out of retention.
- The hash skips names that start with `.` or contain `backup` (`profile-change-detector.js:12`), but the *copy* still includes them.

**Change:**
- Keep recovery outside the profile directory, e.g. `userData/recovery/<profileKey>.json`. Or exclude it explicitly from both the hash and the copy.
- Do the same for **Duplicate Profile**, which copies the directory recursively (`profile-manager.js:696-743`) and would otherwise copy the recovery file too.
- This is the concrete form of the brief's "must not treat the recovery record as a board".

### 12. Backup restore deletes the whole profile directory, so the brief must decide what a restore does to boards

- `restoreBackup` runs `rm -rf` on the profile directory, then copies the backup in (`profile-backup-manager.js:355-421`). Nothing is merged.
- Restoring yesterday's backup therefore drops any board created today, including one imported from someone else. Restoring a pre-boards backup drops all boards and then migrates `state.json` into a single "Board".

**Change:**
- Say in the brief that restore **replaces all boards**, with the existing pre-restore snapshot as the undo.
- Show the board names in the restore confirmation, e.g. "This backup has 2 boards: Board, Comedy Sports. Your current boards (4) will be replaced."
- Detecting a pre-boards backup only needs a check for the boards file inside the backup directory.

### 13. Board switch while audio plays: the current behavior is accidental, so specify it and test it

`autoplay_next` and `triggerEarlyCrossfade` find the playing row with `document.querySelector('.now_playing')` and follow `nextElementSibling` (`audio/audio-manager.js:516-634`).

- Holding-tank restore calls `replaceChildren()`, so `.now_playing` disappears. The song finishes and the playlist stops. That matches the brief, but only by accident.
- Hotkey restore mutates `<li>`s in place, so the `active-hotkey` highlight stays on a key that now holds a *different* song. That is misleading during a show.
- Switching to Playlist mode after a board switch re-finds the playing song by songid in the new holding tank (`mode-management/index.js:131-170`). If the new board contains that song, it reattaches `now_playing` and **autoplay will advance into the new holding tank**, which contradicts the brief's settled decision.
- F-key presses during the awaited `getSongsByIds` read `songid` from a half-updated DOM.

**Change:**
- Make the board swap clear `now_playing`, `selected_row` and `active-hotkey`. Keep `#song_now_playing` and `sharedState.sound`.
- Fetch song rows first, then apply the model and DOM in one synchronous step.
- Keep mode-management's re-find from reattaching after a swap.
- Add E2E coverage for "switch board mid-playlist → song finishes → nothing advances".

### 14. Mid-show misclicks on the menu have no undo

- Under the settled no-prompt rules, choosing a board from the list, choosing Import Board…, or choosing Delete (after its confirm) silently replaces the live session.
- The board list sits right next to `Update "Comedy Sports"` in the same menu. One slip discards the night with the audience watching.

This fact is not covered by the "night is discarded on clean exit" decision, which is about leaving the app, not about in-app menu actions. **Suggestion:**
- Keep the previous live session in memory.
- Show a non-modal "Switched to X — Undo" toast for about 10 seconds.

That is not a prompt and not a snapshot history: it is one in-memory step that disappears on exit. If even that feels too close to the "no automatic snapshots" non-goal, at minimum make Import Board add the board **without** activating it.

### 15. Library import replaces `profiles/` underneath a running session, and the brief doesn't mention library transfer

- `.mxvlib` import deletes and replaces `userData/profiles` and `profiles.json` (`library-transfer-manager.js:638-656`), then restarts through `app.exit`. It currently depends on the renderer-side lock to avoid writing stale state afterwards (`library-transfer/index.js:371`).
- **Change:** the new recovery writer and the retire step must both honor "library import in progress". Otherwise they would write into, or recreate, directories in the freshly imported tree.
- Also, `.mxvlib` export already moves every profile to another computer, so boards *will* move between computers with it. The non-goal "Moving a board to another computer" should say "beyond what Library Export already does".
- That cross-machine path keeps ids consistent only because the database moves with it. Worth one sentence in the brief.

### 16. Delete Current Profile will recreate an orphan directory, and boards make it worse

- `renderer.js:411-437` deletes the profile and then calls `switchProfileWithSave()`. That runs `mkdir -p` and writes `state.json` into the deleted profile's directory (`profile-manager.js:868`).
- A later profile with the same name then fails to create ("directory already exists").
- `fallback-profile` is also set to the deleted name. Closing the launcher then relaunches with `--profile=<deleted>`, which is never validated against the registry.
- **Change:** retire and recovery writes must never create directories. The delete flow must clear the hand-off token.

### 17. Legacy `.mrv` import can put dangling ids into the live session, and Update then saves them into a board

- `_populateHotkeysImpl` assigns the id to the model first (`hotkeys/index.js:277-319`). `setLabelFromSongId` then rejects for a missing song, the rejection is not awaited, and the stale id stays in the model with a blank label.
- `.hld` import accepts any line, with no validation (`file-operations.js:121-160`).
- **Change:** validate ids against the database before assigning. Report "N songs in this file are not in your library".

---

## P2 — Gaps and polish

18. **The data model says "order", but tabs are fixed.** There are always 5 hotkey tabs and 5 holding-tank tabs (`TAB_COUNT = 5` in both state classes). `loadFromSnapshot` silently drops tabs outside 1..5. "Order" has no meaning today. Say "exactly 5 + 5 tabs in v1" and let the version field cover any future change.

19. **Selected tab is a new field.** The current snapshot has no selected-tab field. Also decide whether a board switch should move the operator to the saved tab. Jumping tabs mid-show is disorienting. I'd restore the selection only on profile open, and keep the current tab on switch.

20. **Rename and Delete only on the active board** make the brief's own refresh workflow ("import again and delete the old copy") require switching to the old copy first, which throws away the live session. Allow Rename and Delete on *any* board through a submenu or a small "Manage Boards…" dialog. Deleting an inactive board does not touch the session.

21. **Board identity and naming.**
    - Use stable ids (UUIDs) for storage and menu identity, and names only for display. Rename then never moves files.
    - Define name uniqueness as case-insensitive and trimmed, with the same 50-character limit as profiles.
    - Define the list order. Creation order means a new board doesn't jump around, as alphabetical order would.
    - For imports, suggest `Comedy Sports (Derek)` over `Comedy Sports (2)`. Store `importedFrom: {profile, boardId, at}` so the refresh workflow can show what is newer.

22. **The crash prompt needs context.** Show the time of the last change, e.g. "Restore the show in progress from 9:42 PM?". A recovery record left behind by a profile that never reopens will surface months later, so either expire it after N days or show the age prominently. Consider keeping a *declined* recovery until the next clean exit, so one misclick on the prompt isn't fatal.

23. **The recovery record must name its board id.** If that board was deleted, by another path or by restoring a backup, decide the outcome. My suggestion: restore the layout onto the active board, with the header showing the active board name.

24. **Modified indicator.** The header could show `Comedy Sports •` when the live session differs from the saved board. That is cheap: compare the two snapshots. It tells the operator whether Update is needed before they leave, without any prompt. It also makes Update less likely to be clicked "just in case".

25. **The header has two inconsistent writers.** `renderer.js:169-193` writes the bare profile name. `profile-ui-controller.js:216-228` writes `Profile: <name>`. The board name has to update in-process on switch and rename, unlike the profile name. Consolidate both into one function.

26. **The keyboard rationale is off.** "Update has no keyboard shortcut. The function keys belong to playback." The relevant fact is that `Cmd/Ctrl+S` and `Cmd/Ctrl+O` are bound today (`application-menu.js:140,149`). Also, Save Hotkeys To File (`Cmd+S`) **is already dead**: it sends `start_hotkey_save` and nothing listens. That is useful evidence that removing legacy save breaks fewer people than the release section fears; only the panel icon works.
    - Decide whether `Cmd+O` stays on Import Hotkey File or is dropped.
    - Leaving `Cmd+S` unbound is consistent with "don't teach save". Say that is the reason.

27. **Migration mechanics.** There is no migration framework. Recommend a lazy, idempotent migration on profile open: "no boards file → create from `state.json`, else from `state.json.backup`, else empty". That one rule also covers restoring a pre-boards backup and library imports from older machines.
    - **Do not reuse or delete `state.json`.** Leave it frozen and write recovery under a new name. Beta-channel users can move between versions, and an older build reading a `state.json` that is now being written as the live recovery record would open the wreckage again.
    - Profiles created lazily without `state.json` (Default User) get an empty board.
    - The "one short note" fits the existing per-profile What's New tour mechanism (`tours_seen`), so each profile sees it once.

28. **New IPC must validate profile and board identifiers.** Import Board needs main to read another profile's boards. Check the profile against the registry and the board id against a strict pattern. Use `ipc/guards.js`. There is a bad precedent to avoid: `restoreBackup` and `deleteBackup` pass an unvalidated `backupId` into `path.join` (`profile-backup-manager.js:358,432`), so a `../` id can delete or restore outside the backup directory. That is pre-existing and worth fixing separately.

29. **The hotkey directory preference** ("Hotkeys / Holding Tank directory") becomes only the default folder for legacy import dialogs. Relabel it or note that in the brief.

30. **Storage shape.** For this data size (about 10 small arrays per board), one `boards.json` per profile (`{version, activeBoardId, boards:[{id, name, createdAt, updatedAt, importedFrom?, hotkeys, holdingTank, selected}]}`) written atomically is simpler than one file per board. Every mutation (New, Rename, Delete, active change) becomes a single atomic replace, so the index and the board files can never disagree.

31. **Tests the brief should name**, all E2E unless noted:
    - Switch Profile → close launcher → session intact (the hand-off token).
    - Switch Profile → pick B → A's recovery retired.
    - Kill the process with a recovery present → prompt on A, no prompt on B.
    - Renderer crash → quit → recovery survives.
    - Board switch mid-playlist does not advance.
    - Migration from real `state.json` fixtures (unit).
    - Restoring a pre-boards backup.
    - Import Board name collision.
    - Update disabled during load (unit or E2E).
    - Corrupt `boards.json` falls back to `.prev` (unit).
    - Atomic write (unit).

---

## Pre-existing bugs found during review, fix independently

- `before-quit` / `window-all-closed` never registered (#1). **Prerequisite for boards.**
- `backupId` path traversal in restore and delete (#28). Security.
- Switch-profile save writes to `profiles/unknown/` when `getCurrent` fails (`profile-state/index.js:429`).
- Delete Current Profile recreates an orphan directory (#16).
- `.mxvlib` manifest `profileCount` is always 0: it checks `Array.isArray` on an object (`library-transfer-manager.js:161`).
- Dead "Save Hotkeys To File" menu item (#26).
- Holding-tank rename button tooltip says "Rename Hotkey Tab" (`index.html`).
- Hotkey tab double-click rename is registered twice (`ui-interaction-events.js:229-262` and `hotkeys-events.js:216-237`).

## Suggested brief edits, in short

1. Add a **Session lifecycle** section: the exit-path table from #1, the hand-off token from #2, renderer-crash handling from #3, and update-install as a hand-off.
2. Replace "That save has to stop" with "That save goes to the recovery record."
3. Add **Storage guarantees**: atomic writes, one previous generation, corrupt file is never treated as empty, recovery stored outside the profile directory.
4. Add **Song identity**: an AUTOINCREMENT migration and/or a filename check. Pruning is live-only and reported.
5. Define **View → Start a New Session** as "Revert to saved board", or remove it.
6. Gate Update, New and Delete on board load being ready.
7. Specify the board-swap playback contract (clear highlights, no re-find), with a test.
8. Allow Rename and Delete on non-active boards. Name imported copies by their source profile.
9. Mention library transfer and the restore-replaces-all-boards semantics.
10. Optional: an undo toast for switch, import and delete, plus a modified indicator in the header.
