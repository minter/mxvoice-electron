# Shows release: pre-release review

Branch `boards` vs `main` merge-base `56d1f9db` (101 commits, 110 files in `src`, about 7,000 lines added). Reviewed 2026-10-21 by five parallel reviewers, one per area: upgrade/data, session/recovery, renderer, UI/copy, IPC/security/tests. The coordinator checked every Critical/High claim against the code. The per-area reports, with all Low items and everything checked and found sound, are in the session scratchpad.

**Bottom line:** the core is solid. The checks covered:
- migration from every `state.json` format 4.1–4.3.2, checked against 14 real profiles;
- the AUTOINCREMENT rebuild (ids preserved, rolls back on failure), run against the real legacy DDL;
- atomic writes, the session's fence and generation logic, playback across a show swap, the restoration lock, and escaping of every user-supplied name.

What isn't safe yet is the edges. Some dialogs and failure paths can silently throw away the night's unsaved layout, or leave the app in a state where nothing saves, with no message. Section 1 must be fixed before release.

---

## 1. Must fix before release

### 1.1 The crash-restore prompt can delete the show in progress without a real choice
- `shows/index.js:102`, `modal-utils.js` (customConfirm), `show-session.js:336`, `recovery-store.js` `retire` = `fs.rm`.
- Esc, Return (Cancel has focus), a backdrop click or × all answer **"Open saved show"**. Main then deletes the recovery record and tonight's played counts for good. Esc is the operator's stop key.
- **Worse:** the update check runs at `ready-to-show`. If an update is out, `#newReleaseModal` opens, and every modal's `show.bs.modal` handler calls `hideAllModals()` (`ui-interaction-events.js:81-93`). That hides the crash prompt, which resolves as "Open saved show" with no input from the user. The same path on the "Shows unreadable" prompt resolves as **Quit**, so the app closes itself at launch.
- **Fix:**
  - make the crash and unreadable prompts static (no Esc, backdrop or ×) and exempt from `hideAllModals`;
  - defer the update notice until startup prompts are settled;
  - have "discard" move the record to `<key>.discarded.json` (cleared on the next clean quit) instead of deleting it.

### 1.2 Unsaved changes are dropped without warning on Quit, closing the window, profile switch, New/Duplicate Profile and Log Out
- `app-setup.js:89-105` (the quit confirm only mentions audio), Cmd-Q (no prompt), `renderer.js` switch/logout, `profile-ui-controller.js`.
- This was a deliberate spec decision, but it reverses 4.3 behavior. 4.3 saved the layout continuously, so an upgrader who sets up hotkeys and closes the app loses that work. The tour line "Quitting puts it back next time" reads as the opposite of what happens.
- **Decision needed.** Recommended: when there are unsaved changes, Quit/close and profile switch use the same Save / Don't Save / Cancel prompt that show switch already uses. At minimum, the quit confirm should say "Unsaved changes to "X" will be lost" and offer Save. Update the tour and release-notes copy either way.

### 1.3 Backup restore and library export ignore unsaved changes; failed restore, import or delete leaves a dead session
- `ipc/profile-backup-handlers.js:126-140`, `library-transfer-manager.js:567-584`, `profile-delete.js:33-41`, `profile-backup/index.js:226`.
- **Restore:** the dialog promises "A backup of your current profile will be created first". The live layout now lives only in `userData/recovery/`, so neither the pre-restore backup nor an export includes it, and `end('backup-restore')` deletes it.
- **Failure:** `showSession.end()` runs *before* the operation. If the restore fails (missing backup folder, Windows file lock), or the import or current-profile delete fails, the page stays up with an ended session:
  - the whole Shows menu is disabled;
  - autosave and crash recovery are refused;
  - play counting stops;
  - the recovery and played files are already deleted. A failed library import has already run `recoveryStore.clearAll()` for every profile.

  Only a restart recovers, and nothing tells the user.
- **Fix:**
  - run `settleUnsavedChanges` before restore and export;
  - validate (backup exists, archive readable) before `end()`;
  - on any failure after `end()`, reload the window so the session reopens from disk;
  - defer `clearAll()` until the import commits.

  Add tests for each failure path; none exist today.

### 1.4 Deleting a profile whose name sanitizes to "" deletes every profile
- `profile-paths.js:10-28`, `profile-manager.js:445-466`.
- `sanitizeProfileName('日本語' | '🎭' | '!!!')` is `''`, so `getProfileDirectory` returns `userData/profiles` itself, and Delete runs `rmSync` on it recursively. Versions 4.1–4.3.2 accepted such names, so they can exist in the field. This branch only blocks new ones.
- **Fix:** one guard, used by delete, backup, restore, duplicate, shows and recovery paths: throw when the directory key is empty, and assert `profileDir !== profilesDir` before any `rm`. Consider migrating such profiles to a safe folder name.

### 1.5 Users upgrading from 3.x/4.0 get an empty Default Show, and it's saved
- Removal on `main` in `bc3140a3` (unreleased: `v4.3.2` still has `checkNeedsMigrationLoad`), plus `show-store.js:165, 192`.
- The pre-profile migration (global `config.json` `hotkeys`/`holding_tank`) is gone. On first open, `buildMigration` finds no `state.json`, writes an empty `shows.json`, and never tries again. The custom update feed lets 3.x installs update straight to this release.
- **Fix:** in `buildMigration`, for Default User with no `state.json`, read the legacy `config.json` keys (as 4.3.2 did) before falling back to empty. At least don't save a `migrated-empty` show when those keys exist. Or decide that 3.x must update through 4.3.2 first, and enforce that in the feed.

### 1.6 An update install that doesn't quit leaves the session fenced
- `update-install.js:22-33`, `show-session.js:429-447`.
- `handoff('update')` fences the session before `quitAndInstall()`. electron-updater has real no-quit paths: on Windows/Linux the installer fails to spawn or install was already called; on macOS a Squirrel error leaves it waiting forever. After that, Save, switching, autosave and played counts stop until a restart. A later clean quit keeps the stale handed-off record, so the next launch shows a surprise prompt or silently restores an old layout. Reproduced with the real session module.
- **Fix:** add `cancelHandoff()`, called on an `autoUpdater` error or when no `before-quit` arrives within N seconds. Or mark the handoff only once the quit is certain (`before-quit-for-update`).

### 1.7 Release housekeeping
- `package.json` is `4.3.1`, but 4.3.2 has shipped and the tour is keyed `4.4.0`. As 4.3.x, 4.3.2 users would never be offered the update and the Shows tour would never show. **Bump to 4.4.0** (or `4.4.0-beta.N`), and add a test that the newest tour key matches the package major.minor.
- `v4.3.2` came from a side branch. `535cab79` ("Fix stale preload packaging") and `2d09c186` aren't on `main` or this branch. `main` also has five newer commits, including PR 825 (the backupId path-traversal fix) and the dependency bump. Merge both lines in before release.

---

## 2. Should fix (likely to bite someone)

| # | Issue | Where | Fix |
|---|---|---|---|
| 2.1 | A failed show load, switch, revert or import (or a failed ready report) leaves the session `failed`: every Shows command is disabled, nothing autosaves, and there's no retry. | `show-session.js:349-358`, `shows/index.js:169-179`, `commands.js:60-74` | Allow activate/revert from `failed`. Add "Try again" to the alert, and say changes aren't being kept. |
| 2.2 | A failed recovery-file delete or rewrite in `resolveRecovery` (Windows lock) fails the whole startup open. | `show-session.js:314-342` | Catch and log, as `retireRecovery` does. Retry `rm` on win32. |
| 2.3 | F1–F12 stop working while a text prompt has focus (Save As, Rename Show, Rename Tab), because Mousetrap ignores keys in inputs. | `overlay-shortcut-guard.js:47-49` | Let F-keys through for `.prompt-input`, or add the `mousetrap` class. |
| 2.4 | What's New auto-starts after an in-process profile switch (seen is per profile), covering the window mid-show. | `tour-manager.js:69-80` | Don't auto-start on a switch reload, or make "seen" app-wide. |
| 2.5 | The "N songs aren't in the library" toast returns every launch and switch, and Save stays disabled because dropped ids don't count as changes, so it can't be cleared. | `show-session.js:356-363`, `show-menu.js` | Enable Save while dropped songs exist, or say "Save the show to remove them", or toast once. |
| 2.6 | A corrupt or locked `profiles.json` reads as `{Default User}`, and `adoptProfileDirectory` / `updateProfileLastUsed` then save that over the real file, dropping every other profile. | `profile-manager.js:90-146, 273-293` | Refuse to save after a non-ENOENT read error. Write atomically. Rebuild from `profiles/*`. |
| 2.7 | Legacy aliased names (`Bob` + `bob!`) share one recovery and played record, so one profile gets the other's crash prompt or counts. | `profile-paths.js:46`, `recovery-store.js` | Store the exact profile name in the record and ignore a mismatch. |
| 2.8 | A Windows shutdown or logoff may record a crash instead of a clean exit and show "window stopped working" (low confidence). | `window-state-manager.js:147`, `renderer-crash-handler.js` | Set a closing flag, and skip `rendererGone` while it's set. |
| 2.9 | Startup failure copy: a newer-version `shows.json` gets a generic message. The unreadable prompt doesn't say where the file was kept, and a dismissal means Quit. | `shows/index.js:28, 139-178` | Give the version failure its own message. Make the dialog static. Name the folder. |
| 2.10 | Profile picker: Enter ignores the focused button, and rows aren't keyboard-reachable, so a keyboard-only user can't switch. | `picker-view.js:189-196, 326-337` | Respect a focused button. Add arrow keys and focusable rows. |
| 2.11 | Downgrade then upgrade: 4.3 sees the frozen pre-upgrade `state.json`, and its later edits are ignored on re-upgrade, with no notice either way. | `show-store.js` | Document it in the release notes. Optionally mirror the active show to `state.json` for one release. |
| 2.12 | Tour and release copy: "Quitting puts it back next time" is ambiguous, Windows says Exit not Quit, and there's no mention of the removed Hotkeys menu and Cmd-O/Cmd-S, or that switching no longer restarts. | `tours.js:24-28`, `docs/release-notes/shows.md` | Rewrite once 1.2 is decided. |
| 2.13 | Library import writes `mxvoice.db`, but a legacy `mrvoice.db` in the same folder wins at startup, so imported shows point at the wrong songs (pre-existing). | `library-transfer-manager.js:595`, `database-setup.js:113` | Rename the old DB aside on import. |

## 3. Polish (low risk)

- Tab-file load: re-check show and tab right before the write, after the song lookup (`tab-files.js:168`).
- Applying a layout clears the selected *search* row (`layout-applier.js:40`).
- Renaming an unnamed tab and pressing OK names it "1". An empty name can't reset it.
- Confirm dialogs whose default is Confirm don't focus it, so Return does nothing (`modal-utils.js:92`).
- The Delete-show confirm doesn't say it's permanent. Deleting the only show recreates an empty "Default Show", which can look like data loss.
- Save As/Rename with an empty name silently cancels.
- Shows commands are silently dropped while any dialog is open.
- The tab ⋯ menu has no arrow keys, and focus leaks out of it.
- Raw `EACCES…` errors are shown to users (`tab-files.js`, picker).
- Long profile names overflow the picker.
- The restore confirm gets long with many shows.
- `profileExists` uses `in` (prototype keys); Windows reserved names (`CON`, `NUL`) are accepted.
- `.tmp-*` and `.corrupt-*` files accumulate and are copied into backups.
- No length caps on tab names or holding-tank size from IPC.
- `end()` stops at the first failed retire. `open()` doesn't reset `mutating`. `trackProfileSwitch` isn't wrapped in `step()`.
- Atomic-rename retry on Windows gives up after about 300 ms (antivirus can hold files longer).
- The AUTOINCREMENT rebuild matches the `id` column case-sensitively and keeps only the first `.pre-autoincrement` copy.
- Unused `launcher:delete-profile` preload API.

## 4. Test gaps worth closing with the fixes

Failed restore, import and delete after `end()`; empty-key and aliased legacy profile names; the crash prompt racing the update dialog; an update install that doesn't quit; downgrade then re-upgrade; a 3.x `config.json` migration; a switch while the recovery prompt is open; Windows EBUSY on delete and restore.

## 5. Checked and found sound (highlights)

- **Migration:** every `state.json` format from 4.1.0 to 4.3.2 matches; `.backup` fallback, `.prev` repair, quarantine, newer-version refusal; `migratedShowId` is deterministic.
- **AUTOINCREMENT rebuild:** ids preserved, sequence seeded at MAX(id), transactional, opens fine in old versions.
- **Session:** captured-profile writes, generation and openSeq guards, the Save race, the never-ready keep rule, crash-loop protection, renderer-crash hand-off order.
- **Renderer:** restoration lock always released, recovery never captures a half-applied layout, playback survives a swap, command serialization, the save-changes prompt defaults to Cancel.
- **IPC/security:** show IPC validated; no XSS (all names via `textContent` or escaping); removed channels fully gone; packaging includes all new files; coverage floors raised, no skipped tests.

---

## Status after the must-fix plan (2026-10-21)

Plan: `docs/superpowers/plans/2026-10-21-shows-must-fix.md`. Every task was reviewed and a final whole-branch review was run.

| Item | Status | Commits |
|---|---|---|
| 1.1 Crash and unreadable prompts | Fixed. They can't be dismissed or hidden by another modal, the release notes wait until startup settles, and "Open saved show" sets the record aside as `<key>.discarded.json`. A failed set-aside no longer fails the open. | 3b894b12, 9b261036, c01c86d4 |
| 1.2 Silent quit/switch | Kept silent (user decision). The close-window confirm now says unsaved changes won't be kept, and the tour and release notes say it plainly. | d773ed7a |
| 1.3 Restore, export, import, delete | Fixed. Restore and Export ask to save first. Each operation validates before ending the session. On a failure after that point the window reloads, or the app restarts after an import. Import clears recovery only after it commits. A failed delete keeps the layout and counts, and a failed restore keeps the counts. | 255d71e1, c01c86d4 |
| 1.4 Empty folder name | Fixed. The path helpers throw, delete, backup, restore and duplicate refuse, and `rmSync` asserts it never targets the profiles folder. | 2aea2754 |
| 1.5 3.x/4.0 migration | Fixed. Default User with no `state.json` migrates `config.json` `hotkeys`/`holding_tank`. An unreadable config is never saved as empty. | 241a87d6 |
| 1.6 Update install that doesn't quit | Fixed. `cancelHandoff`, a 15 s quit timer, and on macOS a wait for Squirrel (with a 2 min ceiling) before handing off, plus a `before-quit-for-update` backstop. The unused `RESTART_AND_INSTALL` IPC was removed. | e586eb1a, 27331cac, d50edcda, e890c0b6 |
| 1.7 Housekeeping | Done. Version 4.4.0, a test that the tour key matches the package version, and `main` merged (PR 825). The v4.3.2-only fixes were already present. | e29796d4, b44b807c, 42424f72 |
| Found while fixing | The tour left a popover on screen when closed mid-step. Fixed. | e9d2f0e0, fc977f81 |

### Deferred (follow-ups; none blocks the release per the final review)

- An empty-folder-name legacy profile is now safe but degraded: it opens to the unreadable prompt, with no crash recovery and no preferences. A follow-up could migrate it to a safe folder name.
- A failed library import restarts into the crash prompt ("didn't close normally"). The data is safe; the wording is off.
- A static modal (release notes, Preferences) can open beneath an open prompt.
- Export with unsaved changes is silently dropped while a dialog is open.
- Restore failure messages use a confirm (OK/Cancel); an alert would read better.
- Renamed 3.x tab names aren't migrated (matches 4.3.2).
- Missing tests: the `renderer.js` delete-failure branch (the script isn't unit-testable); the wiring of the dirty quit detail into the dialog; a seeded E2E for a 3.x `config.json`; an E2E for the save prompt over the restore dialog; the update not-installed notice.
- The coverage floor for lines is at 52 against a measured 52.03.
- Before release: run the 5 audio-output E2E tests (playback basic/fade, hotkey stop, holding-tank mode playback, first-run play) on CI macOS/Windows. They failed locally on 2026-10-21 on both new and pre-change code with both Electron versions, so it's an environment issue, but confirm.
- From review sections 2–3, still open: failed show load or apply leaves the session `failed` with no retry (2.1); F-keys don't work while a text prompt has focus (2.3); the tour auto-starts after a profile switch (2.4); the dropped-songs toast repeats (2.5); `profiles.json` can shrink when its read fails (2.6); aliased recovery keys (2.7); Windows shutdown (2.8); startup failure copy (2.9); picker keyboard (2.10); downgrade notes (2.11); `mrvoice.db` on import (2.13); plus the section 3 polish items.
