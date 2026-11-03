# Shows Review-2 Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the second pre-release review's section 1, and apply the user's two decisions, so the first show and the stop key behave exactly as an upgrading operator expects.

**Architecture:** Six small, independent changes, each pinned by tests:
- the migration's first write;
- the Esc gesture;
- the hotkey context-menu row marker;
- a one-time fade migration;
- the crash prompt's default;
- release notes and the CI timeout.

**Tech Stack:** Electron main + renderer ES modules, Bootstrap 5, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-22-shows-prerelease-review-2.md` (section 1 and section 2's decisions). The product spec is `docs/superpowers/specs/2026-10-17-shows-design.md`.

## Decisions (user, 2026-10-22)

1. **Fade length stays as it was.** On the first 4.4.0 launch, copy the app-wide `fade_out_seconds` into every profile once.
2. **Restore is the crash prompt's default.** Return takes "Restore show in progress". The prompt stays non-dismissible.

## Global Constraints

- Everything in `AGENTS.md` applies:
  - IPC results are wrapped;
  - run `npm run build:preload` after any preload or channel change;
  - no skipped tests;
  - coverage floors in `vitest.config.js` only go up.
- Node 22: `export PATH=$HOME/.nvm/versions/node/v22.23.1/bin:$PATH`. E2E: `env -u ELECTRON_RUN_AS_NODE E2E_BACKGROUND=1 npx playwright test <spec>`.
- Copy: plain words for a non-technical sound operator. Never delete user data on a failure path.
- Live shows: F1–F12 must always work. Esc must never stop a song other than the one playing when Esc went down.

## Review Focus

1. **Shows file can't be written on the first launch** (full disk, read-only folder). The first show must still be the user's layout, and Save must work once the cause is fixed. (Task 1)
2. **Rolled "Esc, then F-key" within 300 ms.** The new song must keep playing at full volume. (Task 2)
3. **Esc held while the renderer is blocked for longer than 300 ms.** It must fade, not cut. (Task 2)
4. **A profile created after the fade migration ran, or an install that never had an app-wide `fade_out_seconds`.** No second migration, and new profiles keep the default. (Task 4)
5. **Return pressed the moment the crash prompt appears.** It restores. (Task 5)

---

### Task 1: The first show survives a failed first write

**Files:** `src/main/modules/show-store.js` (`load` → `buildMigration` → `writeNew`), `src/main/modules/show-session.js` (open path), `src/main/modules/atomic-json-file.js` (rename retry), `src/renderer/modules/shows/index.js` (notice), plus their unit tests.

**Interfaces:**
- Produces:
  - When `writeNew` fails during migration with an I/O error (not a `version` or `unregistered` refusal), `load()` resolves with the migrated `{ doc, source }` plus `unsaved: true` and `notice: UNSAVED_MIGRATION_NOTICE`. It does not throw.
  - The notice reads exactly: `Mx. Voice couldn't save this show yet. Your layout is safe; it will be saved the next time you save the show or open Mx. Voice.`
  - The session opens `ready` with that doc. Later `save()` / `updateActive` / `createShow` write `shows.json` normally.
  - The next launch migrates again from `state.json`. `migratedShowId` keeps the id stable.
  - `.prev` handling is unchanged.
- `renameWithRetry` on win32 retries EPERM/EBUSY/EACCES for about 2000 ms in total (for example 10 attempts with backoff capped at 400 ms).

- [ ] Write failing tests:
  - `a migration whose first write fails with ENOSPC still opens the migrated layout, ready, with the unsaved notice`;
  - `Save after an unsaved migration writes shows.json`;
  - `a version refusal still fails the open` (a regression guard);
  - `renameWithRetry retries for about 2 s on win32`.
- [ ] Implement until they pass. Use the existing notice/toast path that `openSessionOnStartup` already shows (`opened.notice`).
- [ ] Run `tests/unit/main/show-store*.test.js`, `show-session.test.js`, `atomic-json-file*.test.js`, `shows-startup.test.js`, then commit: `fix(shows): the first show survives a failed first write`

### Task 2: Esc stops only the song it went down on, fades by hold time, and ignores key repeat

**Files:** `src/renderer/modules/keyboard-manager/escape-stop-gesture.js`, `src/renderer/modules/audio/audio-controller.js` and wherever Shift+Esc is bound (global binding and the search-field path), `tests/unit/renderer/escape-stop-gesture.test.js`, `tests/e2e/seeded/playback/fade.spec.js`

**Interfaces:**
- `new EscapeStopGesture({ stop, isFadingOut, currentSound, now, holdMs, setTimer, clearTimer })`:
  - `currentSound: () => unknown` returns the playing sound object (`sharedState.get('sound')`).
  - `now: () => number` defaults to `performance.now()`.
- `keyDown(event)` records `this.pressedSound = currentSound()` and `this.pressedAt = now()`.
- `stop(fadeOut)` is called only when `currentSound()` is still `this.pressedSound` and not null. Otherwise the press is dropped.
- `keyUp()` fades when `now() - pressedAt >= holdMs`, whether or not the timer fired, and cuts otherwise. It is a no-op once the hold timer has already stopped.
- Playback starting (any `playSongFromId`/hotkey play) cancels a pending hold. Expose `gesture.cancelHold()` and call it from the play path, or have the identity check above be sufficient. State which one you did.
- Shift+Esc (fade) ignores `event.repeat` on both the global binding and the search-field path.

- [ ] Write failing unit tests:
  - `Esc down, a new song starts, Esc up: nothing is stopped`;
  - `Esc down, a new song starts, the hold timer fires: nothing is stopped`;
  - `Esc held 400 ms with the timer delayed past keyup: fades`;
  - `a tap under 300 ms cuts the song that was playing`;
  - `Shift+Esc key repeat during a fade does not cut`.
- [ ] Implement until they pass. Then E2E in `fade.spec.js`: `holding Shift+Esc fades to silence without cutting`. Drive real key repeat with `page.keyboard.down('Shift')`, `keyboard.down('Escape')`, wait, then up. Assert the fade reaches silence over the fade time, not instantly.
- [ ] Run the unit file and `tests/e2e/seeded/playback/fade.spec.js` twice, then commit: `fix(audio): Esc stops only the song it went down on`

### Task 3: The hotkey context menu doesn't rename the hotkey row

**Files:** `src/renderer/modules/event-coordination/dom-initialization.js` (~303-330: `hotkeyLi.id = 'selected_row'`), the context-menu actions that read `#selected_row` for a hotkey (Play, Edit, Remove, Mark as Unplayed), `src/renderer/modules/hotkeys/hotkey-operations.js` (`restoreHotkeyId`), and the tests.

**Interfaces:**
- While the song context menu is open on a hotkey slot, the row keeps its `fK_hotkey` id. It is marked `data-context-target="true"` instead. The menu actions resolve their target from that marker for hotkeys, and from `#selected_row` for search and holding-tank rows. The marker is removed when the menu closes.
- `restoreHotkeyId` is no longer needed for this path. Delete it if nothing else uses it.

- [ ] Write failing tests (unit if the code is testable, otherwise E2E in `tests/e2e/seeded/hotkeys/`):
  - `right-click F3, press F2, F3 still plays`;
  - `right-click F3, switch shows, F3 shows the new show's song`;
  - `context-menu Play / Edit / Mark as Unplayed on a hotkey act on that hotkey`.
- [ ] Implement until they pass. Run the hotkeys unit and E2E specs, then commit: `fix(hotkeys): the context menu no longer renames the hotkey row`

### Task 4: Fades sound the same after the update

**Files:** `src/main/modules/profile-manager.js` (or a new `src/main/modules/fade-migration.js`), the wiring at startup in `src/main/index-modular.js` (before any window loads), and tests.

**Interfaces:**
- `migrateFadeToProfiles({ store, listProfiles, loadProfilePreferences, saveProfilePreferences, debugLog })` returns `{ migrated: string[] }`. It runs once:
  - If the global store flag `fade_out_migrated_to_profiles` is `true`, it does nothing.
  - Otherwise it reads the global `fade_out_seconds`. A missing value or anything not a positive finite number means `2`, the 4.3.2 default.
  - It writes that value as `fade_out_seconds` into every registered profile's preferences, then sets the flag.
  - A profile whose preferences can't be read or saved is skipped and logged. The flag is still set, so this never loops.
  - It never touches the global value.
- It runs at startup after the registry loads and before the main window is created.

- [ ] Write failing tests:
  - `copies the global 2 into every profile and sets the flag`;
  - `a missing global value copies 2`;
  - `a second run does nothing`;
  - `a profile whose preferences fail to save is skipped and the rest are migrated`;
  - `a profile created after the migration keeps the new default` (create it after the flag is set; expect 3).
- [ ] Implement until they pass. Run the unit suites, then commit: `fix(audio): keep each profile's fade length the same after the update`

### Task 5: Restore is the crash prompt's default

**Files:** `src/renderer/modules/shows/index.js` (crash prompt in `resolveRecovery`), `src/renderer/modules/utils/modal-utils.js` (`customConfirm` focuses the confirm button when `defaultAction === 'confirm'`), the tests, and the What's New and release-notes copy if they describe the default.

**Interfaces:**
- The crash prompt calls `customConfirm(crashMessage(savedAt), 'Restore show?', { confirmLabel: 'Restore show in progress', cancelLabel: 'Open saved show', defaultAction: 'confirm', dismissible: false })`.
- `customConfirm` with `defaultAction: 'confirm'` focuses the confirm button on `shown.bs.modal`, so Return takes it. The cancel default is unchanged for every other caller.
- Update `docs/superpowers/specs/2026-10-17-shows-design.md` wherever it says the saved show is the default. Record the decision as "user, 2026-10-22".

- [ ] Write failing tests:
  - `the crash prompt defaults to restore` (deps.confirm options);
  - `customConfirm with defaultAction confirm focuses the confirm button`;
  - E2E in `session-lifecycle.spec.js`: `Return on the crash prompt restores the show in progress`.
- [ ] Implement until they pass. Update any existing E2E that pressed Return or Esc expecting the saved show. Run the shows unit tests and `session-lifecycle.spec.js`, then commit: `fix(shows): Restore is the crash prompt's default`

### Task 6: Release notes and CI

**Files:** `docs/release-notes/shows.md`, `src/renderer/modules/whats-new/tours.js` (only if a step contradicts Tasks 2, 4 or 5), `.github/workflows/e2e-tests.yml`, `build/README.md` (release steps).

- [ ] Add these lines to the release notes, in the file's voice:
  - Tap Esc to cut, or hold Esc to fade out. Shift+Esc still fades.
  - Esc in a dialog now just closes the dialog and leaves the music playing.
  - Fades use the length set in Preferences, and each profile keeps the fade length it had before the update.
  - After a crash, Return restores the show in progress.
- [ ] In `e2e-tests.yml`, raise `timeout-minutes` from 20 to 30.
- [ ] Add a release step to `build/README.md`: paste `docs/release-notes/shows.md` into the GitHub release body. 4.3.2 users see that text in Update Available.
- [ ] Commit: `docs(release): stop-key and fade notes; release body; E2E timeout`

### Task 7: Gates and final review (coordinator)

- [ ] Run `npm run build:preload`, `npm run test:no-skips`, `npm run test:unit:coverage` and the whole E2E suite.
- [ ] Re-run the coordinator's real-data first-show check (`scratchpad/realcheck.mjs`) on a fresh copy, including the fade values per profile after launch.
- [ ] Do the final whole-branch review of Tasks 1–6, then one fix wave.
- [ ] Mark review-2 section 1 with each item's fixing commit.
