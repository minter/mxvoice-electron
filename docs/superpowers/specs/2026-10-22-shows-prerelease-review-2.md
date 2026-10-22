# Shows release: second pre-release review

Branch `boards` at `729dcde0` vs `main` merge-base `8f52f70f` (126 commits, 119 files in `src`). It includes the must-fix work from the first review and the three fade/Esc commits.

Five parallel reviewers covered:
1. upgrade and first show;
2. session, recovery and update;
3. renderer, playback and fade;
4. UI and copy;
5. IPC, release and tests.

The coordinator checked each High against the code and ran a real-data check. The per-area reports and proof scripts are in the session scratchpad.

## The first show on upgrade: verified

- **Real data.** I ran this build against a copy of a real install: 15 profile folders, 13 registered, plus Default User with 3.x-era `config.json` HTML still present.
  - All 13 registered profiles opened on a "Default Show" identical to their `state.json`: every F-key, every holding-tank row in order, and tab names.
  - Each opened with no prompt, no toast and no unsaved dot.
  - A clean quit left `shows.json` with one show and an empty recovery folder.
  - A simulated 3.x Default User (no `state.json`, the real `config.json` `hotkeys` HTML) got F1 = 7 and F2 = 18, matching the HTML, and was marked migrated.
- **Synthetic fixtures** built from the v3.1.5–v4.3.2 writers (reviewer 1):
  - every `state.json` format migrates exactly, including duplicates in the holding tank, empty tabs, five tabs and tab 1 active;
  - no crash prompt on first launch;
  - not dirty after apply, even with missing songs;
  - several profiles migrate cleanly in one session;
  - the AUTOINCREMENT rebuild keeps ids.
- Note: 4.3.2's own 3.x migration never actually ran (its loaders return early whenever a profile is active), so this release is the first to carry 3.x layouts forward.

## 1. Fix before the PR

| # | Issue | Where | Fix |
|---|---|---|---|
| 1.1 | **If the first `shows.json` write fails, the first show is empty.** Causes: a full disk, a read-only or Dropbox/OneDrive-managed profile folder, or Windows antivirus holding the file past the ~300 ms rename retry. The migration builds the right layout, but `open()` throws when it can't write. The operator sees blank F-keys, "couldn't load this show", and a session stuck in `failed`. 4.3.2 showed the full layout. Reproduced with ENOSPC and `chmod 555`. | `show-store.js:250-251`, `show-session.js:226-243` | Return the migrated document even when the write fails, and mark it "not saved yet". The next Save, autosave or launch then writes it. Toast "Mx. Voice couldn't save this show yet; your layout is safe". Lengthen the Windows rename retry to 1–2 s. |
| 1.2 | **Esc stops the wrong song.** A tap cuts on key-up, and a hold fades when the 300 ms timer fires, but neither checks that the same sound is still playing. A rolled "Esc, then F-key" cuts or fades the *new* cue. Proved with the real module. In 4.3.2 the cut was on key-down, so the next F-key was safe. | `escape-stop-gesture.js:42-63` | Record the sound at key-down, and only stop if it's still current. Cancel a pending hold when a new song starts or another key is pressed. |
| 1.3 | **Holding Shift+Esc cuts instead of fading.** Key auto-repeat calls `stopPlaying(true)` again, and the new "a second stop during a fade cuts" rule turns it into a cut. | `audio-controller.js`, global binding and search-field path | Ignore repeat key-downs (`event.repeat`) for both stop paths. |
| 1.4 | **The hold-to-fade decision depends on timer order.** If the renderer stalls past 300 ms, key-up is handled before the timer and a deliberate fade becomes a cut. This also makes the fade E2E tests flaky on slow CI. | `escape-stop-gesture.js` | In `keyUp()`, fade whenever the key was down ≥ 300 ms (measure `performance.now()`), whichever handler runs first. |
| 1.5 | **Right-clicking a hotkey, then pressing another F-key or switching shows, kills that slot for the session.** The context menu renames the row's id to `selected_row`, and clearing the selection strips the id. The slot then plays nothing, and after a switch it keeps the old show's label. This bug predates the branch, but the layout applier adds a second trigger. | `dom-initialization.js:~303`, `hotkey-operations.js:59`, `layout-applier.js:40` | Mark the context-menu row with a class or data attribute instead of changing its id. |
| 1.6 | **Release notes.** Nothing puts `docs/release-notes/shows.md` into the GitHub release body that 4.3.2 users see in "Update Available". The notes also leave out: Esc tap/hold, that fade length now follows Preferences (see 2.1), and that Esc under a dialog closes the dialog instead of stopping the music. | `docs/release-notes/shows.md`, release process | Add the missing lines, and paste the notes into the release body (or automate that). |
| 1.7 | **CI has never run on this branch**, and the Windows E2E job is close to its 20-minute limit. HEAD has about 320 tests and 87 launches, which projects to 17–19.5 min against the last Windows run of 12m51s for 231 tests. | `.github/workflows/e2e-tests.yml:17` | Push and run CI. Raise `timeout-minutes` to 30 or shard the Windows job. |

## 2. Decisions (user, 2026-10-22)

- **Fade length:** keep the old length. On the first 4.4.0 launch, copy the app-wide `fade_out_seconds` into each profile once.
- **Crash prompt:** Restore is the default (Return and dismiss).

Background:

- **2.1 Fade length changes for existing users.**
  - 4.3.2 faded using the app-wide `fade_out_seconds` and ignored each profile's Preferences value. On this machine that is 2 s app-wide, while most profiles store 3 and Default User stores 2.
  - 4.4.0 uses the profile value, so most people's fades silently get longer (2 s → 3 s). Preferences had been showing a number that wasn't being used.
  - Options:
    - (a) On the first 4.4.0 launch, copy the app-wide value into each profile once, so fades stay as they were.
    - (b) Keep the new behavior and say it in the release notes.
  - Recommend (a). It's a one-time migration, and "sounds the same after the update" is the safer promise.
- **2.2 Default answer on the crash prompt.**
  - Return, the default, picks "Open saved show", which sets tonight's layout and counts aside. The copy is kept as `.discarded.json`, but no UI can bring it back.
  - The window-crash dialog defaults the other way (Reload and restore).
  - A failed restore, delete or import now reopens into this same prompt, so Return there throws away the work those fixes kept.
  - Restore is the reversible choice: Revert to Saved is one click.
  - Recommend making **Restore** the default. The spec chose the saved show, so this reverses a spec decision.

## 3. Should fix (likely to bite someone)

| # | Issue | Where | Fix |
|---|---|---|---|
| 3.1 | Renamed tabs from 3.x/4.0 aren't migrated, though the names are in the saved nav HTML. | `legacy-config-layout.js` | Parse `#hotkey_tabs` / `#holding_tank_tabs` link text. |
| 3.2 | A backup restore that fails partway (`rm` with no retries, then copy) leaves a half-deleted profile, which reopens on an empty or stale Default Show. The real shows survive only in the pre-restore backup, and nothing says so. | `profile-backup-manager.js` restore | Copy into a temp folder, then swap it in with a rename. On failure, restore from the pre-restore backup automatically, or tell the user where it is. |
| 3.3 | macOS: after Install Now, the app can quit up to 2 minutes later, mid-show. A failed install can't be retried: the button stays disabled, the toolbar indicator hides, and the message points at a menu item that doesn't exist. | `update-install.js`, update UI | Show "Waiting for the update to finish downloading…" with a Cancel. Re-enable the button after a failure. Fix the copy to say "the Update button". |
| 3.4 | Brand-new installs now get the upgrade-only 4.4.0 tour on top of the Get Started dialog. | `whats-new` auto-trigger | Skip the auto-tour on a first run. |
| 3.5 | Profile picker: Return on a focused Cancel or × runs the primary action, creating or switching a profile. The picker can't be used from the keyboard (2.10 earlier). | `picker-view.js:326-337` | Respect the focused button. Add arrow keys and focusable rows. |
| 3.6 | Create Backup Now leaves out unsaved changes, while Export and Restore ask first. | `profile-backup/index.js` | Ask to save first, or say in the dialog that unsaved changes aren't included. |
| 3.7 | With an alert open and focus still in the search box, Esc stops the music and keystrokes land behind the dialog (medium confidence). | modal focus | Move focus into the dialog when it shows. |
| 3.8 | Downgrade to 4.3.x and re-upgrade: the newer `state.json` is silently ignored. Reproduced. | `show-store.js` | Document it in the release notes, or import a newer `state.json` as a show. |
| 3.9 | A song that ends during a stop-fade replays at full volume when Loop is on. This predates the branch, but hold-to-fade makes it more likely. | `audio-manager.js` loop | Don't loop while a stop-fade is running. |
| 3.10 | Repeated items from review 1: the dropped-songs toast comes back every launch with no next step (2.5); startup failure messages don't say what to do (2.9); profile switch, New, Duplicate and Log Out drop unsaved changes silently while quit now warns (by decision). | | |

## 4. Low and polish

These are in the per-area reports: copy, ARIA and CSS details, test-title and log details, the statements coverage floor 0.33 points above its limit, fixed sleeps in E2E, and untested wiring (the What's New auto-start under E2E, a 3.x upgrade E2E, an update that doesn't quit).

## 5. Checked and sound

- **Must-fix fixes:** re-checked and holding.
  - Startup prompts are non-dismissible and the startup gate settles.
  - Restore, import and delete validate before ending the session, and a failed delete keeps its records.
  - The empty-key guard is on every path helper.
  - `cancelHandoff` / Squirrel wait / backstop.
- **IPC:** validation and traversal guards are in place, removed channels are fully gone, and every name is escaped wherever it's rendered.
- **Release config:** version 4.4.0 matches the tour key, the 4.3.2 preload packaging fix is present, and the update channel is unchanged.
- **Tests:** unit 1407 pass, including on a case-sensitive volume; coverage floors only went up; no skipped tests.
- **First-launch walkthroughs:** the four paths (one profile, many profiles, 3.x, new install), Shows menu order and labels, each tour claim checked against behavior, colors, tab truncation, played pills.
