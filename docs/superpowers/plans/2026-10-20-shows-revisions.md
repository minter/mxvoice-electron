# Shows Revisions Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Apply the four product decisions the user made after previewing the boards build on the `boards` branch:
- boards become **Shows**;
- Rename and Delete act on the current show only;
- the save commands are **Save "<show>"** and **Save As…**, with an unsaved-changes dot in the header;
- switching shows or importing asks to save unsaved changes.

**Architecture:** One mechanical rename first (R1), so every later task works in the new vocabulary. Then three small behavior changes:
- R2: menu shape;
- R3: wording plus a `dirty` flag the main-process session already knows how to compute (the equality rule);
- R4: a three-choice prompt in the renderer before switch and import.

**Spec:** `docs/superpowers/specs/2026-10-17-boards-design.md`. R0 renames it to `…-shows-design.md` and amends it. It builds on `docs/superpowers/plans/2026-10-20-boards.md`, whose Amendments still hold except where the decisions below replace them.

## Decisions (user, 2026-10-20)

1. **Name: Shows.** The menu is titled **Shows**, and all user-facing text says "show". Code, IPC channels, preload API, files and tests are renamed too, because nothing has shipped. The migrated first show is named **Show**.
2. **Rename and Delete act on the current show only.** They are two plain items, `Rename "<show>"…` and `Delete "<show>"…`, replacing the two submenus. Amendment 5 is reversed.
3. **Save wording.** `Update "<show>"` becomes **`Save "<show>"`**, and `New Board…` becomes **`Save As…`**. The rule against using the words Open, Save or Save As is dropped. The header shows a "•" after the show name while the layout on screen differs from the saved show.
4. **Ask before switching away from unsaved changes.** On a show switch or Import Show, when there are unsaved changes, ask: **"Save changes to "<show>"?"** with the buttons **Save** / **Don't Save** / **Cancel**, where **Cancel is the default** (Return, Esc and close). Rules:
   - Save writes the current show, then continues.
   - Don't Save continues and discards the changes.
   - Cancel stops, and nothing changes.
   - Revert keeps its own discard confirm.
   - Delete of the current show keeps its confirm.
   - Quit, closing the window, profile switch and Log Out stay **silent**. The end-of-night rule is unchanged.

## Global Constraints

Everything in the boards plan's Global Constraints still applies, with these changes:
- Rename identifiers that mean the feature: `board`→`show`, `Board`→`Show`, `boards`→`shows`, `BOARDS`→`SHOWS`.
- **Never** touch the unrelated words that contain "board": keyboard, Keyboard, clipboard, dashboard, onboard, soundboard, `keyboard-manager`, and so on. Match on word boundaries or whole identifiers only.
- IPC channel names `board:*` become `show:*`. The preload `secureElectronAPI.boards` becomes `secureElectronAPI.shows`, and `events.onBoardCommand` becomes `events.onShowCommand` on `menu:show-command`. The per-profile file `boards.json` (and `.prev`) becomes `shows.json`.
- Interfaces keep their shapes. Only the names change.

## Tasks

### Task R0: Amend the brief and rename it

- [ ] Run `git mv docs/superpowers/specs/2026-10-17-boards-design.md docs/superpowers/specs/2026-10-17-shows-design.md`.
- [ ] Apply Decisions 1–4 throughout, in the brief's own product voice:
  - the vocabulary;
  - the Board menu section, now the Shows menu;
  - "Changing a board";
  - the decision table rows for no prompt, Update naming, Rename/Delete on any board, and the "Open, Save, Save As" rule;
  - the Release notes bullets.

  Keep the end-of-night silent-discard decision, and add a row saying switching shows asks because the operator is present.
- [ ] Commit: `docs(shows): rename boards to shows; save prompt on switch`

### Task R1: Rename boards to shows

**Files:** every file under `src/` and `tests/` that names the feature, plus `AGENTS.md`, the module READMEs, `docs/release-notes/boards.md` (rename it to `shows.md`) and the What's New tour text.

- File renames, for example:
  - `board-document.js` → `show-document.js`
  - `board-store.js` → `show-store.js`
  - `board-session.js` → `show-session.js`
  - `board-menu.js` → `show-menu.js`
  - `ipc/board-handlers.js` → `ipc/show-handlers.js`
  - `src/renderer/modules/boards/` → `src/renderer/modules/shows/`
  - the matching tests, `tests/e2e/seeded/boards/` → `tests/e2e/seeded/shows/`, and the test utils `seed-boards.js` → `seed-shows.js` and `board-e2e.js` → `show-e2e.js`
- `getProfileBoardsPath` → `getProfileShowsPath`, pointing at `<profileDir>/shows.json`. The first migrated show is named `Show`. Update the default in `createDocument`, the "deleting the only show" replacement, and every test expectation.
- User-facing copy: every string that says board/Board says show/Show, including the menu title `Shows`, prompts, toasts, the crash prompt ("Open saved show"), tour steps, release notes and AGENTS.md. Menu labels: `Import Show…`, `Import Hotkey File…`, `Import Holding Tank File…`. R2 and R3 own the Save, Save As, Rename and Delete labels; in R1, rename them mechanically (`Update "<show>"`, `New Show…`, `Rename Show`, `Delete Show`).
- Analytics event names: `board_*` → `show_*`.
- Verification:
  - `git grep -nIiw -E 'boards?' -- src tests AGENTS.md` returns only intentional historical mentions, which should be none in src;
  - `git grep -nI -E 'keyboard|clipboard' -- src` gives the same count as before the change;
  - the full unit suite passes;
  - `npm run build:preload` succeeds and the drift guard is green;
  - the whole E2E suite passes.
- Commit: `refactor(shows): rename boards to shows`. It may be split per layer.

### Task R2: Rename and Delete act on the current show

**Files:** `src/main/modules/show-menu.js`, `src/renderer/modules/shows/commands.js`, and their tests.

- Menu order:
  1. the show radio list
  2. separator
  3. `Save "<show>"`
  4. `Save As…`
  5. `Revert to "<show>"`
  6. `Rename "<show>"…`
  7. `Delete "<show>"…`
  8. separator
  9. `Import Show…`, `Import Hotkey File…`, `Import Holding Tank File…`
- The Rename and Delete commands are sent with no `boardId`/`showId`; the renderer uses the active show. Delete-other and its copy go away. Delete keeps the current-show confirm (`The layout on screen will be replaced with "<next>".` or `…with an empty show.`, title `Delete "<show>"?`, Delete/Cancel with Cancel as the default).
- The session and IPC `renameShow(id, name)` / `deleteShow(id)` keep their id argument. The renderer passes the active id.
- Tests:
  - the menu has no Rename or Delete submenus;
  - Rename and Delete target the active show;
  - update the E2E specs that deleted or renamed a non-active show to go through the current one.
- Commit: `feat(shows): rename and delete act on the current show`

### Task R3: Save wording and the unsaved-changes dot

**Files:** `show-menu.js`, `show-session.js`, `ipc/show-handlers.js`, the preload, `shows/commands.js`, `shows/header.js`, and their tests.

- Labels:
  - `Save "<show>"` (command `save`, formerly `update`), with confirm title `Save "<show>"?` and the confirm button `Save`;
  - `Save As…` (command `save-as`, formerly `new`), with prompt title `Save As` and message `Name for the new show`.

  Keep the existing Save confirm ("… will open with the layout on screen now. Its saved layout will be replaced."). Rename the analytics events `show_saved` / `show_saved_as`.
- Dirty flag in the main session:
  - `dirty` is true after a `saveRecovery` that WROTE, i.e. the layout differs from the saved show;
  - it's false after one that retired (equal), and after `open`, `activate`, `revert`, `import`, `updateActive` (save), `createShow` (save-as) and `startEmpty`;
  - `state()` includes `dirty`;
  - `saveRecovery` returns `{ dirty }` in its data.
- Renderer:
  - `profile-state`'s recovery save passes the returned `dirty` to `shows/header.js` `setDirty(dirty)`;
  - the header renders `"<show> •"` while dirty, with the dot in its own span, `#show-dirty`, so tests can find it, and `title="Unsaved changes"`;
  - the header refresh after commands reads `state().dirty`.
- Tests: the dirty transitions in the session unit tests; the header dot in a unit test; an E2E where an edit shows the dot, Save clears it, and an edit that's undone back to saved clears it.
- Commit: `feat(shows): Save and Save As wording; unsaved-changes dot`

### Task R4: Ask to save before switching or importing

**Files:** `src/renderer/modules/utils/modal-utils.js`, `shows/commands.js`, and their tests.

- Add `customChoice(message, title, choices, { defaultValue })` to `modal-utils.js`:
  - `choices` is `[{ value, label, variant }]`;
  - it resolves to the chosen value, or to `defaultValue` on Esc, backdrop or close;
  - the default button is focused, so Return takes it;
  - the message and title are escaped like `customConfirm`.

  Unit-test it.
- In `commands.js`, before `switch` and `import`:
  1. flush the pending recovery save, so `dirty` is current (`profile-state` `flushProfileState`);
  2. read `shows.getState()`;
  3. if `dirty`, ask `Save changes to "<show>"?` (title `Unsaved changes`) with choices Save (primary), Don't Save, and Cancel (the default).
     - Save calls the same path as the `save` command but without its own confirm, then continues.
     - Don't Save continues.
     - Cancel stops, rebuilds the menu so the radio check snaps back, and sends no analytics event.

  If the Save fails, stop and show the failure; don't switch.
- `switch` with no unsaved changes behaves exactly as today.
- Revert, Delete, Save As, profile switch, Log Out and Quit get no new prompt.
- Tests:
  - unit tests for the three choices on switch and on import;
  - the flush-before-check ordering;
  - E2E: edit → switch → Cancel stays put; edit → switch → Don't Save loads the other show and the edit is gone; edit → switch → Save switches and the first show keeps the edit (verified by switching back).
- Commit: `feat(shows): ask to save unsaved changes before switching or importing`

### Task R5: Gates and preview

- [ ] Run `npm run build:preload`, `npm run test:no-skips`, `npm run test:unit:coverage` (raise the floors if they rose), and the whole E2E suite.
- [ ] Do the final whole-branch review of R0..R4.
