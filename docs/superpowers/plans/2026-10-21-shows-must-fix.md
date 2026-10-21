# Shows Must-Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the pre-release review's must-fix items, so that updating to this version can't lose the night's work or strand the app in a state where nothing saves.

**Architecture:** These are small, independent hardening changes at the edges of the existing show session. They cover:
- startup dialogs;
- operations that end the session and then fail;
- a path guard;
- a restored legacy migration;
- an undoable update handoff;
- copy.

No new subsystems. Each task fixes one finding and pins it with tests.

**Tech Stack:** Electron (main + context-isolated preload), vanilla ES-module renderer, Bootstrap 5 modals, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-21-shows-prerelease-review.md` (section 1). The product spec is `docs/superpowers/specs/2026-10-17-shows-design.md`.

## Decisions (user, 2026-10-21)

1. **Quit, window close, profile switch, New/Duplicate Profile and Log Out stay silent** about unsaved changes, as the spec says. Only the copy changes (Task 6).
2. **Save keeps its confirm and has no shortcut** (decided earlier).
3. Everything else in review section 1 gets fixed.

Coordinator rulings, recorded in the ledger:
- **Restore Backup and Export Library ask to save unsaved changes first**, using the same Save / Don't Save / Cancel prompt as show switch and Import. They are not quit or switch. Restore replaces the profile on screen, and both claim to capture the profile.
- **Version 4.4.0.** It matches the tour key; a beta build sets `4.4.0-beta.N`.

## Global Constraints

- Everything in `AGENTS.md` applies. In particular:
  - no bundler;
  - IPC results are wrapped `{ success, data|value|error }`;
  - `npm run build:preload` after any preload or channel change;
  - no skipped tests;
  - coverage floors in `vitest.config.js` may only go up.
- Node 22: `export PATH=$HOME/.nvm/versions/node/v22.23.1/bin:$PATH`. E2E runs with `env -u ELECTRON_RUN_AS_NODE E2E_BACKGROUND=1 npx playwright test <spec>`.
- Logging: `window.debugLog?.info/warn/error(msg, { module, function, ... })` in the renderer, and `debugLog` in main.
- User-facing copy: plain words for a non-technical sound operator. Use "show", "profile", "layout on screen". No error codes in messages.
- Never delete user data on a failure path: when unsure, keep the file.

## Review Focus

1. **The update check finishing while a startup prompt is open.** The prompt must stay up and keep its answer. (Task 1 E2E)
2. **A Windows file lock during restore or delete after the session has ended.** The app must come back to a working show, not a disabled Shows menu. (Task 2 unit tests, failure injected)
3. **An existing profile named only with non-Latin letters or symbols.** Delete, backup, restore and duplicate must refuse; nothing outside that profile is touched. (Task 3 unit tests)
4. **A 3.x user whose `config.json` holds hotkeys but whose holding tank is empty, or the reverse.** Whatever exists must be migrated. (Task 4 unit tests)
5. **`quitAndInstall()` returning without quitting.** Save, autosave and played counts must work again, and a later clean quit must leave no crash prompt. (Task 5 unit tests)

---

### Task 0: Bring the branch up to date and set the version (coordinator)

**Files:** a merge commit, `package.json`, `tests/unit/renderer/whats-new-tours.test.js` (create)

- [ ] Merge `origin/main` into `boards`, which brings in PR 825 (the backupId traversal fix) and the dependency batch. Resolve conflicts, keeping both sides' intent. Expect them in `profile-backup-manager.js` and its tests.
- [ ] Bring in the two `v4.3.2`-only commits, `535cab79` (preload packaging fix) and `2d09c186` (disk-backed drop test), with `git cherry-pick`. Skip either if its change is already present.
- [ ] Set `package.json` `"version": "4.4.0"`, and update `package-lock.json` to match with `npm install --package-lock-only`.
- [ ] Add the test `the newest tour key matches the package version's major.minor`. It reads the keys of `tours.js`'s default export and `package.json`'s version, and expects the highest key's `X.Y` to equal the package's `X.Y`.
- [ ] Run the full gates, then commit.

### Task 0b: Closing the tour mid-transition must not leave a popover behind

Found while running Task 0's gates. At version 4.4.0, `tests/e2e/seeded/ui/whats-new-tour.spec.js` "tour-opened preferences…" fails because an earlier test leaves a popover open: "Closing the Window Asks First", with `tourManager.activeDriver === null`. The sequence: the 4.4.0 tour opens; Next is clicked, and step 1's postAction (`closeSwitchProfileForTour`) is still awaiting; × is clicked. `onDestroyStarted` cleans up and destroys, then the in-flight `transitionTo` resumes and shows step 2 on a dead tour. A user who clicks × right after Next gets a stuck popover over the window.

**Files:** `src/renderer/modules/whats-new/tour-manager.js` (`launchTour`'s `transitionTo` and `onDestroyStarted`), `tests/unit/renderer/whats-new-tour-manager.test.js`

**Interfaces:** no new exports. Behavior:
- `transitionTo` captures the driver it started with. After every await, it stops without calling `moveTo` if the tour is closing or `this.activeDriver` is no longer that driver.
- `onDestroyStarted` waits for any in-flight transition to finish or bail before running cleanup, so `cleanupFromStep` runs on the step actually shown.
- No `.driver-popover` remains after a destroy.

- [ ] Write the failing unit test `closing the tour while a step transition is in flight leaves no popover and never moves the dead tour`. Use a deferred postAction that resolves after destroy starts, and assert `moveTo` is not called after destroy.
- [ ] Implement until it passes. Then run the whole `tests/e2e/seeded/ui/whats-new-tour.spec.js` twice; all 8 tests must pass both times.
- [ ] Commit: `fix(whats-new): closing the tour mid-step leaves no popover behind`

### Task 1: Startup prompts can't be dismissed or hidden into a destructive answer

**Files:**
- Modify: `src/renderer/modules/utils/modal-utils.js` (customConfirm options), `src/renderer/modules/ui/bootstrap-adapter.js` (`hideAllModals`), `src/renderer/modules/shows/index.js` (crash and unreadable prompts), `src/renderer/modules/ui/update-indicator.js` and/or the `mxvoice:show-modal` path (defer the release-notes modal), `src/main/modules/recovery-store.js` (soft discard), `src/main/modules/show-session.js` (`resolveRecovery` discard)
- Test: `tests/unit/renderer/modal-utils*.test.js`, `tests/unit/renderer/shows-startup.test.js`, `tests/unit/main/recovery-store.test.js`, `tests/unit/main/show-session.test.js`, `tests/e2e/seeded/shows/session-lifecycle.spec.js`

**Interfaces:**
- `customConfirm(message, title, { ..., dismissible = true })`. With `dismissible: false`:
  - the modal is `backdrop: 'static', keyboard: false`;
  - it has no × button;
  - it resolves **only** from its two buttons;
  - a `hidden.bs.modal` it didn't cause does not resolve it. The prompt shows itself again.
- Every dialog that `modal-utils.js` creates carries `data-mxv-prompt="true"`. `hideAllModals()` skips elements with that attribute.
- Startup gate: `shows/index.js` exports `whenStartupSettled(): Promise<void>`, resolved in `openSessionOnStartup`'s `finally`. The release-notes modal (`#newReleaseModal`) is shown only after it resolves. Other modals are unaffected.
- `recoveryStore.discard(profile)`: renames `<key>.json` to `<key>.discarded.json`, replacing an older one; a missing file is fine. The played file gets the same treatment (`<key>.played.json` → `<key>.played.discarded.json`). `clearAll()` also removes `*.discarded.json`. `resolveRecovery('discard')` calls `discard` instead of `retire` and `retirePlayed`.

- [ ] Write failing unit tests:
  - `customConfirm with dismissible:false ignores Esc, backdrop and an outside hide, and resolves only from its buttons`;
  - `hideAllModals skips data-mxv-prompt dialogs`;
  - `resolveRecovery discard keeps the record as <key>.discarded.json and the played counts as <key>.played.discarded.json`;
  - `clearAll removes discarded copies`;
  - `the crash prompt and the unreadable prompt are opened with dismissible:false`;
  - `the release-notes modal waits for whenStartupSettled`.
- [ ] Implement until they pass. Keep the crash prompt's default button and labels exactly as they are: Return still takes "Open saved show" (spec). Only dismissal changes.
- [ ] E2E in `session-lifecycle.spec.js`, test `an update notice during the crash prompt doesn't answer it`:
  1. create a crash record;
  2. launch;
  3. while the prompt is open, dispatch `mxvoice:show-modal` for `#newReleaseModal` from the page;
  4. expect the prompt to stay visible and the recovery file to still exist;
  5. click "Restore show in progress" and expect the restored layout.
- [ ] Run the affected unit tests and that spec, then commit: `fix(shows): startup prompts can't be dismissed into discarding the show in progress`

### Task 2: Restore, import and delete never strand the session or lose unsaved changes

**Files:**
- Modify: `src/main/modules/ipc/profile-backup-handlers.js`, `src/main/modules/library-transfer-manager.js`, `src/main/modules/profile-delete.js`, `src/renderer/modules/profile-backup/index.js`, `src/renderer/modules/library-transfer/index.js`, `src/renderer/modules/shows/commands.js` and `shows/index.js` (export the prompt), `src/renderer.js` (delete-profile failure path)
- Test: `tests/unit/main/profile-backup-handlers.test.js`, `tests/unit/main/library-transfer-manager*.test.js`, `tests/unit/main/profile-delete*.test.js`, `tests/unit/renderer/show-commands.test.js`, the renderer backup and library tests

**Interfaces:**
- `shows/index.js` exports `askToSaveUnsavedChanges(trigger: 'restore'|'export'): Promise<boolean>`. It wraps the existing `settleUnsavedChanges` with its default deps.
  - Returns `true` to go on and `false` to stop (Cancel or a failed Save; on a failed Save the existing failure alert shows).
  - Returns `true` at once when nothing is unsaved or the session isn't ready.
- **Main, restore:** validate first (the backup id is in this profile's metadata and its folder exists; PR 825 already validates the id format). On failure, return `{ success:false, error }` **before** `end()`. If `restoreBackup` fails after `end()`, the handler returns `{ success:false, error, sessionEnded:true }`.
- **Main, library import:** validate the archive (readable, has a database) before `end('library-import')`. Move `recoveryStore.clearAll()` to after the import has committed. On a failure after `end()`, return `sessionEnded: true`.
- **Main, delete current profile:** if `deleteProfile` fails after `end('profile-deleted')`, return `{ success:false, error, sessionEnded:true }`.
- **Renderer:** on any result with `sessionEnded: true`, show the existing failure message with the sentence `Mx. Voice will reload the show.` added, then call `window.location.reload()`. That reopens the session from disk; the recovery record, kept as in Task 1 where it applies, comes back.

- [ ] Write failing unit tests:
  - `restore of a missing backup fails before ending the session`;
  - `a restore that fails after end returns sessionEnded`;
  - `a library import that fails validation leaves the session and recovery files alone`;
  - `clearAll runs only after a successful import`;
  - `a current-profile delete that fails after end returns sessionEnded`;
  - renderer: `restore asks to save unsaved changes before its confirm; Cancel stops`;
  - renderer: `export asks to save unsaved changes first; Cancel stops`;
  - renderer: `a sessionEnded failure reloads the window`.
- [ ] Implement until they pass. In `profile-backup/index.js`, call `askToSaveUnsavedChanges('restore')` before the existing confirm. In `library-transfer/index.js`, call `askToSaveUnsavedChanges('export')` before the export save dialog.
- [ ] Run the affected unit tests and `tests/e2e/seeded/*backup*` / library specs, then commit: `fix(shows): restore, import and delete keep a working session when they fail; ask to save first`

### Task 3: A profile whose name sanitizes to nothing can't reach shared folders

**Files:**
- Modify: `src/main/modules/profile-paths.js`, `src/main/modules/profile-manager.js` (`getDeleteProfileBlocker`, `deleteProfile`, duplicate), `src/main/modules/profile-backup-manager.js` (backup/restore dirs), `src/main/modules/show-store.js`, `src/main/modules/recovery-store.js` callers
- Test: `tests/unit/main/profile-paths.test.js`, `tests/unit/main/profile-manager*.test.js`, `tests/unit/main/profile-backup-manager*.test.js`

**Interfaces:**
- `profile-paths.js` exports `hasUsableDirectoryKey(name): boolean`, which is false when `getProfileDirectoryKey(name)` is `''`.
- `getProfileDirectory`, `getRecoveryPath` and the backup-directory helper **throw** `Error('Profile name has no usable folder name')` for such a name. They never return the shared parent.
- `getDeleteProfileBlocker` returns the user message `This profile's name can't be used for a folder, so Mx. Voice can't delete it safely. Rename it in a newer version or contact support.` when the key is empty.
- `deleteProfile` asserts `path.resolve(profileDir) !== path.resolve(getProfilesDirectory())` immediately before `rmSync`, and refuses otherwise.
- `show-store` refuses such a profile as `unreadable`. The existing unreadable prompt then offers an empty show, and nothing is written to `profiles/shows.json`.

- [ ] Write failing tests with names `日本語`, `🎭` and `!!!`:
  - `getProfileDirectory throws`;
  - `delete is blocked with the message`;
  - `deleteProfile never removes the profiles folder even if the blocker is bypassed`;
  - `backup and restore refuse`;
  - `duplicate refuses`;
  - `show-store never writes profiles/shows.json`.
- [ ] Implement until they pass.
- [ ] Run the unit suites, then commit: `fix(profiles): never treat the profiles folder as a profile's folder`

### Task 4: Bring back the one-time 3.x/4.0 migration into the Default Show

**Files:**
- Modify: `src/main/modules/show-store.js` (`buildMigration`). Create `src/main/modules/legacy-config-layout.js`.
- Test: `tests/unit/main/legacy-config-layout.test.js`, `tests/unit/main/show-store.test.js`

**Reference:** read `git show v4.3.2:src/renderer/modules/app-initialization/data-preloader.js`, along with `loadHotkeys` / `loadHoldingTank` and whatever they called in v4.3.2's hotkeys and holding-tank modules, to learn the stored HTML shapes. The v4.3.2 rules:
- applies only to `Default User`;
- only when that profile has no `state.json`;
- only when the `migration_completed` preference isn't `true`;
- only when global `config.json` `hotkeys` and/or `holding_tank` are strings containing `songid=`.

**Interfaces:**
- `parseLegacyConfigLayout(config: object): Layout | null`, a pure function. It reads `config.hotkeys` and `config.holding_tank` HTML strings and returns a layout in the shape `normalizeLayout` accepts. Hotkeys are tab 1..N with `f1..f12` song ids from `songid` attributes, in the order the old HTML stores them; the holding tank's song ids are in row order. It returns `null` when neither has a `songid`.
- Parse with a small regex or tokenizer over the HTML, not a DOM; main has no DOM. Only `songid="digits"` values are read; nothing else from the HTML is used.
- In `buildMigration`, for `Default User` with no `state.json`, no `.backup`, and `migration_completed !== true`: read `userData/config.json` and, when `parseLegacyConfigLayout` returns a layout, migrate that instead of the empty layout, with source `'migrated-legacy-config'`. Never modify `config.json`. On a read or parse error, fall back to empty as today, but **don't save** a `migrated-empty` document when `config.json` couldn't be read. Throw `io` so the profile retries next launch, as the existing I/O refusal does.

- [ ] Write failing tests:
  - fixtures built from the real v4.3.2 HTML shapes (hotkeys only, holding tank only, both, malformed, no `songid`);
  - `buildMigration` uses the legacy layout only for Default User;
  - `buildMigration` ignores it when `state.json` exists or `migration_completed` is true;
  - an unreadable `config.json` is not saved as empty.
- [ ] Implement until they pass.
- [ ] Run the unit suites, then commit: `fix(shows): migrate 3.x/4.0 hotkeys and holding tank into the Default Show`

### Task 5: An update install that doesn't quit gives the session back

**Files:**
- Modify: `src/main/modules/show-session.js` (add `cancelHandoff`), `src/main/modules/update-install.js`, `src/main/modules/recovery-store.js` (reuse `clearHandoff`), the wiring in `index-modular.js` / `app-lifecycle.js`
- Test: `tests/unit/main/show-session.test.js`, `tests/unit/main/update-install.test.js`

**Interfaces:**
- `session.cancelHandoff(): Promise<void>`. It is a no-op unless the session is handed off and not ended. It:
  - clears `fenced` and `handedOff`;
  - clears the handoff mark with `recoveryStore.clearHandoff(profile)`, queued;
  - rewrites the played file without its handoff mark when counts exist.

  Afterwards, `saveRecovery`, mutations, `recordPlay` and a later `end('clean-exit')` behave as if no handoff had happened.
- `createUpdateInstaller({ prepareForUpdateInstall, getAutoUpdater, cancelHandoff, onQuitStarted, debugLog, timeoutMs = 15000 })`:
  1. it calls `prepareForUpdateInstall()`, then `quitAndInstall()`;
  2. if `autoUpdater` emits `error`, or no quit starts within `timeoutMs`, it calls `cancelHandoff()` and logs a warning;
  3. "quit started" is signalled by the app's `before-quit` (wire `onQuitStarted` to it).
- If the quit never starts, the user is told: `The update couldn't be installed. Mx. Voice will keep running; try again from the menu later.` Use an existing renderer alert/toast path if there is one; otherwise a main `dialog.showMessageBox`.

- [ ] Write failing tests, using the real `createShowSession` with in-memory stores, as the review's script did:
  - `cancelHandoff after handoff('update') re-enables saveRecovery, Save and recordPlay`;
  - `a clean exit after cancelHandoff retires the record`;
  - `installUpdateNow cancels the handoff on an updater error`;
  - `installUpdateNow cancels the handoff when no quit starts within the timeout` (fake timers);
  - `installUpdateNow does not cancel once before-quit has fired`.
- [ ] Implement until they pass.
- [ ] Run the unit suites, then commit: `fix(shows): an update install that doesn't quit gives the session back`

### Task 6: Copy: say what quitting does with unsaved changes

**Files:** `src/main/modules/app-setup.js` (`confirmQuitOnWindowClose`), `src/renderer/modules/whats-new/tours.js`, `docs/release-notes/shows.md`, and the matching unit and E2E expectations

- [ ] In the window-close Quit confirm, when the show session reports `dirty`, the detail becomes `Closing the window quits ${app.name}. Anything playing will stop, and changes to "<show>" since it was last saved won't be kept.` Otherwise keep today's text. The session state is read via the same getter the menu uses. Cmd-Q stays silent.
- [ ] Tour (`tours.js`): replace "Quitting puts it back next time" and the Quit wording with:

  > Quitting or switching profiles doesn't save the show. Next time, it opens as you last saved it.

  Wherever the menu Quit is named, write "Quit (Exit on Windows)".
- [ ] Release notes (`docs/release-notes/shows.md`) get the same sentence, plus one line each:
  - the Hotkeys menu, with its Cmd/Ctrl-O and Cmd/Ctrl-S shortcuts, is gone (use Shows → Save, and each tab's ⋯ menu for files);
  - switching profiles no longer restarts the app;
  - closing the window now asks before quitting.
- [ ] Tests: unit-test the dirty and clean variants of the quit detail through the `APP_TEST_MODE` seam, or by exporting a `quitDetail(appName, state)` helper. Update any tour or release-notes snapshot.
- [ ] Commit: `docs(shows): say plainly that quitting doesn't save the show`

### Task 7: Gates and final review (coordinator)

- [ ] Run `npm run build:preload`, `npm run test:no-skips`, `npm run test:unit:coverage` (raise the floors if they rose), and the whole E2E suite.
- [ ] Do the final whole-branch review of Tasks 0–6 on the most capable model, then one fix round if needed.
- [ ] Mark section 1 of the review doc with each item's fixing commit.
