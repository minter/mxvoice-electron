# Boards Module

A board is a saved hotkey and holding-tank layout. This module opens the profile's active board at startup and runs the Board menu commands. Saved boards live in the profile's `boards.json`, owned by the main process.

## Files

- `index.js` - startup: opens the active board (asking about a show in progress after a crash) and wires the menu commands.
- `layout-applier.js` - swaps the whole hotkey and holding-tank layout in place without touching playback.
- `commands.js` - runs each Board menu command (switch, update, new, revert, rename, delete, import), one at a time.
- `import-dialog.js` - the Import Board dialog listing other profiles' boards.
- `header.js` - shows "<profile> · <board>" in the search-column header.
- `messages.js` - user-facing messages shared by startup and the commands.

Live edits are recorded for crash recovery by `profile-state`; only a Board menu command saves a board.
