# Shows Module

A show is a saved hotkey and holding-tank layout. This module opens the profile's active show at startup and runs the Shows menu commands. Saved shows live in the profile's `shows.json`, owned by the main process.

## Files

- `index.js` - startup: opens the active show (asking about a show in progress after a crash) and wires the menu commands.
- `layout-applier.js` - swaps the whole hotkey and holding-tank layout in place without touching playback.
- `commands.js` - runs each Shows menu command (switch, update, new, revert, rename, delete, import), one at a time.
- `import-dialog.js` - the Import Show dialog listing other profiles' shows.
- `header.js` - shows "<profile> · <show>" in the search-column header.
- `messages.js` - user-facing messages shared by startup and the commands.

Live edits are recorded for crash recovery by `profile-state`; only a Shows menu command saves a show.
