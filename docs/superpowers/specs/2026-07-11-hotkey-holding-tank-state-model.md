# Situation Brief: In-Memory State Model for Hotkeys & Holding Tank

**Status:** Implemented on `codex/hotkey-state-model`; final integration review remains.

## Implementation Update

The migration described below has now been completed for both collections:

- `HotkeyState` and `HoldingTankState` own assignment/order and tab-name data.
- Profile saves serialize model snapshots; neither collection scrapes the DOM at save time.
- Profile restore loads the models, batch-fetches song metadata, filters deleted songs, and renders all five tabs directly.
- Restore no longer activates Bootstrap tabs or waits on animation timing.
- Legacy HTML is read into the models only at the legacy-load compatibility boundary.
- Core mutations, including swaps, reordering, clears, renames, deletion, and file population, update the models.
- Unit coverage now exercises snapshot compatibility, mutation rules, batching, and subscriber isolation.

The global `window.isRestoringProfileState` lifecycle flag remains because profile backup, library transfer, renderer initialization, and profile-state still coordinate through it. Hotkeys and the holding tank no longer read it themselves. Replacing that cross-module protocol should be handled separately rather than folded into the state-model migration.

**Origin:** Item 5 (final remaining major item) of the 2026-07-11 architectural review. Items 1–4 are complete: dead-code/boundary cleanup (`docs/superpowers/plans/2026-07-11-dead-code-and-boundary-cleanup.md`), IPC domain split + channel manifest + drift guard (`docs/superpowers/plans/2026-07-11-ipc-domain-split.md`), and the DI-getter follow-ups (getDb/getMainWindow/getCurrentProfile live getters).

## The Problem

For hotkeys and the holding tank, **the DOM is the database**. There is no in-memory model of "which song is assigned where" — the authoritative record is `songid` attributes on `<li>` elements in the live document. Everything else (profile `state.json`, legacy electron-store blobs) is a serialization cache produced by scraping the DOM.

Consequences, each observed in practice:

1. **The songid-invariant bug class.** A songid must live on the hotkey `<li>` only, never the inner `<span>` — span songids go stale and surface via songDrag. This has bitten at least once (fixed in v4.x; regression-tested by `tests/e2e/seeded/hotkeys/songid-persistence.spec.js`). The invariant is enforced only by comments (`src/renderer/modules/hotkeys/hotkey-data.js:110`, `src/renderer/modules/profile-state/index.js:412-414`) — nothing structural prevents reintroduction.
2. **Persistence by DOM scraping.** `profile-state/index.js` (`extractHotkeyTabs` ~lines 33-134, `extractHoldingTankTabs` ~140-191) re-reads the entire DOM (5 tabs × 12 keys) on every save, debounced 300ms, even when the caller already knows exactly what changed.
3. **Restore drives the UI through itself.** `restoreHotkeyTabs` (`profile-state/index.js` ~336-469) programmatically clicks Bootstrap tab links and waits `setTimeout(50)` for animations before touching the now-active tab's DOM (~lines 378, 503). Timing-based coordination; inherently racy under slow CI.
4. **A hand-rolled global lock papers over the races.** `window.isRestoringProfileState` is checked ad hoc in `hotkeys/index.js:224`, `holding-tank/index.js:86`, and three places in `profile-state/index.js`. `profile-state/README.md` ("Critical Data Protection", added as a v4.1.1 hotfix) documents that this lock was insufficient at least once.
5. **Unit-untestable core logic.** The swap/assign/persist logic can only be verified end-to-end. There are zero unit tests for `hotkeys/*`, `holding-tank/*`, or `profile-state/*` — exactly the modules with the worst bug history — because the logic is inseparable from a live DOM + Electron main process.
6. **Structural duplication between the two modules.** Both independently implement the same "tabbed drop-target collection with persistence" in incompatible styles (class-based vs plain-function):
   - profile-vs-legacy-store save branching with the `isRestoringProfileState` guard: `hotkeys/index.js:222-277` vs `holding-tank/index.js:84-137`
   - tab renaming via `customPrompt`: `hotkeys/index.js:767-784` vs `holding-tank/index.js:504-514`
   - clear-all with `customConfirm`; drag/drop assignment; FunctionRegistry wrapper functions
   - `setLabelFromSongId`/swap logic is duplicated even *within* hotkeys: `hotkeys/index.js:385-475` (class method + fallback) vs `hotkeys/hotkey-data.js:61-183` (module function + its own fallback)
7. **Redundant DB round-trips.** Assigning/restoring re-queries `getSongById` over IPC for rows the caller often already holds from search results. Latency matters in a live-performance tool.

## Where State Lives Today (the five stores)

| Store | Contents | Authority |
|---|---|---|
| DOM attributes (`<li songid>`, tab labels, `#selected_row`) | hotkey assignments, holding-tank contents, selection | **primary — everything else derives from this** |
| `shared-state.js` singleton | audio objects (Howl/wavesurfer), a few UI flags, category cache | in-memory; has a `VALID_KEYS` allowlist + `subscribe()` — the good pattern, used by only ~7 of ~30 modules |
| `window.*` globals (~94 assignments / 34 files) | `currentSelectedHotkey`, `isRestoringProfileState`, `moduleRegistry`, misc locks | ad hoc |
| electron-store (global) | **legacy** pre-profile hotkey/holding-tank HTML blobs; global prefs | fallback path when no profileState module |
| Profile `state.json` | per-profile `{hotkeys: [{tabNumber, tabName?, hotkeys: {f1..f12: songId}}], holdingTank: [{tabNumber, tabName?, songIds: []}]}` (written via `profileManager.saveProfileState`, main process) | persistent snapshot, rebuilt from DOM |

SQLite (`mrvoice` table) is the canonical song-metadata store and is not at issue.

## What Must Not Break (constraints for any design)

- **`state.json` on-disk format** — profiles must round-trip across versions. `profileManager.saveProfileState` (main, `src/main/modules/profile-manager.js`) also does backup-before-overwrite and empty-over-existing warn logging; unit tests exist (`tests/unit/main/profile-manager-save-state.test.js`).
- **Legacy electron-store fallback** — users without profile state (pre-profile installs) still load/save via store blobs; migration path `profile:get-legacy-migration-data` exists.
- **Hotkey/holding-tank FILE format** — `.mrv`/hotkey files opened/saved via `dialog-handlers` + `file-operations.js` (`hotkey-file-parser` has unit tests).
- **Behavioral details users rely on:** 5 tabs × F1–F12 hotkeys; tab renames; drag/drop from search results and between collections; batch operations ("caller saves, not callee" contract noted in `holding-tank/index.js:265-323`); playback interactions (`playSongFromId` global).
- **e2e suite is the current safety net:** `tests/e2e/seeded/hotkeys/*` (incl. `songid-persistence.spec.js`), `holding_tank/*`, `profiles/lifecycle.spec.js` must keep passing throughout any migration.

## Sketch of the Target (direction, not design)

A plain-data model owns the state; the DOM becomes a rendering of it:

- `HotkeyState`: array of `{tabNumber, tabName, assignments: Map<fkey, songId>}` with explicit mutations (`assign`, `swap`, `clearTab`, `renameTab`, `loadFromSnapshot`, `toSnapshot`). Pure, unit-testable in milliseconds; the songid invariant becomes unrepresentable (songids exist only in the model; the renderer decides where attributes go, in exactly one place).
- Same shape for `HoldingTankState` (`songIds` list per tab), both built on one shared "tabbed collection" abstraction that also centralizes: persistence (profile vs legacy-store branch, debounce, restoration lock), rename/clear prompts, and FunctionRegistry wrapper generation.
- Persistence reads `toSnapshot()` — no DOM scraping. Restore is `loadFromSnapshot()` + render — no tab-clicking, no `setTimeout(50)`, and the `isRestoringProfileState` global lock can likely die (renders don't trigger save because saves are driven by model mutations, not DOM events).
- `shared-state.js`'s existing `VALID_KEYS`/`subscribe` pattern is the natural home or template for wiring model → renderer.
- Song metadata for labels: pass the already-fetched song row into `assign` where available; fall back to one `getSongById` (batch `get-songs-by-ids` exists for restore).

## Suggested Migration Order (de-risked)

1. Extract the pure model + snapshot round-trip for **hotkeys only**, with unit tests asserting compatibility against real `state.json` fixtures (write fixtures from the current extract functions' output).
2. Swap hotkeys' save path to `model.toSnapshot()` (DOM still renders as today; scraping deleted). e2e `songid-persistence` is the gate.
3. Swap hotkeys' restore path to `loadFromSnapshot` + explicit render (kill tab-clicking/sleeps for hotkeys).
4. Generalize into the shared tabbed-collection abstraction; migrate holding tank onto it (repeat 1–3).
5. Cleanup: remove `isRestoringProfileState` if nothing needs it, dedupe the `setLabelFromSongId` twins, delete the extract-by-scraping functions.

Each step keeps the app shippable and e2e-green; no big-bang.

## Open Questions (for the brainstorming session)

1. **Where does the model live?** Extend `shared-state.js` (existing allowlist/subscribe infra) vs a new dedicated module per collection vs `moduleRegistry` entries. Interacts with item 6 (module communication conventions).
2. **Render granularity:** full re-render of a tab on any mutation (simplest, likely fast enough at 5×12 scale) vs targeted DOM updates. Bootstrap tab-pane visibility semantics need checking for render-while-hidden (the current tab-clicking exists because label-setting assumed the active tab).
3. **Drag/drop integration:** drag sources currently read songids off DOM nodes (`songDrag`). Do drops mutate the model directly, or keep reading DOM and treat DOM→model as an input event? (Model-direct is cleaner; DOM-read is smaller diff.)
4. **Legacy store blobs are HTML strings** — keep the fallback as-is (scrape once at migration/load into the model) or migrate legacy users to snapshots on first save?
5. **`window.currentSelectedHotkey` and selection state** — fold into the model, into shared-state, or leave for item 6?
6. **Batch-operation contract** — with model mutations driving debounced saves, the "caller saves explicitly after batch" convention can go away; confirm no caller depends on save *not* happening mid-batch.

## Key Files (reading list for whoever picks this up)

- `src/renderer/modules/hotkeys/index.js`, `hotkeys/hotkey-data.js`, `hotkeys/hotkey-ui.js`, `hotkeys/hotkey-operations.js`
- `src/renderer/modules/holding-tank/index.js`
- `src/renderer/modules/profile-state/index.js` + its `README.md` (restoration-lock history)
- `src/renderer/modules/shared-state.js` (the pattern to build on)
- `src/main/modules/profile-manager.js` (`saveProfileState`) and `src/main/modules/ipc/profile-handlers.js` (`profile:load-state`, `profile:save-state*`)
- `tests/e2e/seeded/hotkeys/songid-persistence.spec.js` (the regression test for the motivating bug)
- Memory note: `project_hotkey_songid_invariant.md` (songid lives on `<li>` only)
