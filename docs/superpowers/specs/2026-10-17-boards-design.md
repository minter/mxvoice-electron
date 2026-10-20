# Boards — Product Brief

Status: decision record for review. Not an implementation plan.

Mx. Voice is used to run audio at improv shows. A person opens their profile at the start of the night and expects the hotkeys and holding tank to be the layout they prepared for that show. During the show they move tracks around. Today the app saves those changes continuously, so the next launch opens the wreckage of the last show. There is no way back to the prepared layout.

This brief splits "who is at the machine" from "which show is loaded," and makes the prepared show something you return to without remembering to save on the way out.

## The idea

A **profile** is a person. It keeps that person's preferences, and it owns their boards.

A **board** is the prepared layout of one show: every hotkey tab and every holding-tank tab. A profile has one or more boards and remembers which board was active. Opening the profile loads that board as it was saved.

The layout on screen during a show is a **live session**. It is allowed to diverge from the saved board. A normal quit, a profile switch, or a board switch throws the session away. The saved board does not change unless someone explicitly updates it or creates a new board from it.

Derek and Jesse on the same theater computer share the song library and have separate profiles. Jesse can copy one of Derek's saved boards into her own profile. The copy is hers. His board does not change when she edits hers, and her copy does not pick up his later edits.

## Goals

- Opening a profile loads the last board that was active, in its saved state.
- Switching boards loads the other board's saved state.
- The night's changes survive a crash. They do not survive a clean quit, a profile switch, or a board switch.
- Changing what a board will open as next time is an explicit act, taken while the person who wants the change is still there.
- A person can keep more than one show on their profile.
- One person can copy another person's saved board on the same computer.
- An existing profile's current layout becomes a board, so this upgrade does not start anyone from empty.
- Old hotkey (`.mrv`) and holding-tank (`.hld`) files can still be read onto a tab.

## Non-goals

- Private boards. A saved board may be copied by any profile on this computer. Profiles are not locked, so a hidden flag would not keep anyone out of the board anyway. Saving is the act that makes a layout copyable. The unsaved session stays invisible to other profiles.
- Moving a board to another computer. Same-computer copy is the move that matters now.
- A shared folder of board files, or a send/handover step. Derek does not export. Jesse copies from his profile.
- Replacing one of Jesse's boards from Derek's newer copy. Import always adds a board. Refreshing means importing again and deleting the old copy.
- Version history of a night, automatic snapshots, or a save prompt when leaving.
- Putting the song library, categories, audio files, or preferences onto a board.
- A keyboard launch layout. The name "board" leaves room for that later. This version does not design it.
- Keeping audio playing through a profile switch. A profile switch still reloads the page and stops audio. A board switch keeps the song playing. Carrying audio across a profile switch is a separate, later project.
- A visual redesign of the three columns, the tabs, or the transport.

## What a board contains

- Every hotkey tab: name, order, and the song id on each key.
- Every holding-tank tab: name, order, and the song ids in order.
- Which hotkey tab and which holding-tank tab were selected.

A board does not contain theme, font size, directories, update settings, or the Holding/Playlist mode. Those stay profile preferences and keep saving themselves.

Song ids refer to the shared library on this computer. Copying a board between profiles on this machine finds the same tracks. A song id is never reused for a different song, so a board can never quietly point at the wrong track. Loading a board drops song ids that are no longer in the library. The drop happens in the live session only, the saved board is not rewritten, and the person is told how many songs were dropped.

The stored board needs a version field so a later addition can land without breaking boards saved by this version.

## Behavior

### Opening and leaving

Entering a profile, from the launcher or from Switch Profile, loads that profile's active board from its saved state. The live session starts equal to that board.

These exits discard the live session and do not ask anything:

- Quit, or close the window.
- A different profile actually opening, including Log Out.
- Switch board.

Choosing Switch Profile opens the profile picker in the same window. Cancelling it, or picking the same person again, leaves the live session exactly as it was. Nothing is restored, because nothing was torn down, and there is no crash prompt. The session is discarded only once a different profile is the one that opens.

The next entry loads the saved board again. No one has to save at the end of the night. The next person can switch profiles without deciding whether the person who left wanted anything kept.

### Crash recovery

While a session is open, the app may write a recovery copy of the live layout. That copy is not a board. A clean quit, a profile switch, or a board switch retires it.

If the last exit of a profile was not clean, the next open of **that** profile asks whether to restore the show in progress. The default is the saved board. The person who just crashed can choose the recovery copy. Anyone else accepts the default and gets the saved board. Opening a different profile shows nothing about the crash.

Restoring a crashed session loads it as the live layout. It still does not change the saved board. A later clean quit throws it away again.

### Changing a board

Two explicit actions:

- **Update "Comedy Sports"** replaces that saved board with the layout now on screen. The board's name is part of the command, and the command asks for a single confirmation that names the board. This is the only confirm in the leave/save path, and it exists because replacing a board is the irreversible mistake. Anything changed after the update still disappears on the next clean exit.
- **New Board** takes the layout now on screen, asks for a name, and adds a board. The new board becomes the active one. It does not ask whether to discard the previous board.

Rename and Delete work on any board, picked from a list. Delete asks for confirmation. Deleting a board that is not active never touches the live session. When the board being deleted is the active one, the confirmation says the layout on screen will be replaced, and the board is left immediately:

- If other boards remain, the next board in the list becomes active and loads. That discards the live session, the same as switching boards.
- If it was the last board, an empty board takes its place and shows immediately.

A profile always has at least one board.

Update is allowed to store an empty layout, because someone may want a show to open clear. Automatic writes are not. An empty or half-loaded layout must never replace a saved board by itself. The guard that already refuses to overwrite profile state during startup has to apply to saved boards.

Clearing a tab changes the live session only.

**Revert to "Comedy Sports"** replaces the live session with the active board as it was saved. It asks once, then reloads the board. It replaces View → Start a New Session, which goes away.

Switching boards, reverting, importing a board, or deleting the active board can happen while audio is playing. The song that is already playing continues, and its name stays in the now-playing display. Stop still stops it. The marks that point at the old layout are cleared: the playing-row highlight, the selected row and the active hotkey. Playlist mode does not advance into the holding tank that just loaded, even if the operator switches to Playlist mode afterwards. The operator chooses the next sound.

### Copying from someone else

Import Board lists the other profiles on this computer and the saved boards in each. It does not list the current profile, and it does not list anyone's live session.

Choosing Derek → Comedy Sports adds a new board to Jesse's profile and makes it active. Derek's board is untouched. If Jesse already has a board of that name, the new one is named after the board and the profile it came from, for example "Comedy Sports (Derek)", with 2, 3 and so on added if that name is also taken. The copy remembers where it came from. Import never overwrites an existing board.

### Old hotkey and holding-tank files

Those files predate profiles and tabs. A `.mrv` file is one hotkey tab. A `.hld` file is one holding-tank list. People still have them, and some of those files are the show they actually prepared, while the layout the app has been auto-saving is the wreckage.

Import onto the current tab:

- A hotkey file fills the current hotkey tab. If the file has a tab name, that name is applied.
- A holding-tank file fills the current holding-tank tab. These files have no tab name.

Import changes the live session only. The saved board changes when the person then uses Update or New Board. There is no scan of the hotkey folder and no automatic board per file. The app cannot tell which files were a show.

Saving new `.mrv` and `.hld` files goes away. A whole board is the unit worth keeping and the unit worth copying. This version does not add a board file for other computers.

## UI

### Board menu

Boards get their own top-level menu. They do not go under Profile. The Profile menu is who is at the machine: switch, log out, new, duplicate, delete, backup. Those actions are rare, and some of them are destructive. Choosing the show for tonight is not one of them.

The menu contains:

- The profile's boards, with a check on the active one. Choosing one switches boards.
- Update "Comedy Sports"
- Revert to "Comedy Sports"
- New Board...
- Rename, a submenu listing every board
- Delete, a submenu listing every board
- A separator, then Import Board...
- Import Hotkey File... and Import Holding Tank File...

The words Open, Save, and Save As do not appear. They teach people that the night is a document they are supposed to save.

Nothing in the Board menu has a keyboard shortcut. The function keys belong to playback. Open and Save shortcuts (Cmd/Ctrl+O and Cmd/Ctrl+S) are left unbound rather than reassigned, because those keys teach people that the night is a document.

### Header

The search-column header already shows the profile name. It also shows the active board name, so the loaded show is visible without opening a menu. The header is a label. It does not open the Board menu. Commands that replace or delete a board do not belong on that label.

### What comes off the panels

Remove the open-folder and save icons from the Holding Tank header and the Hotkeys header. Rename and clear stay.

Remove the Hotkeys menu. Its only items are Open Hotkeys File and Save Hotkeys To File. Those commands move to the Board menu as the two legacy imports, and the save command is not replaced.

### What does not move

The Profile menu stays as it is. The launcher still picks a person before the main window opens. It does not pick a board. The columns, tabs, search, and transport stay.

## Architecture

This is the shape, not the file layout.

**Saved boards** live with the profile that owns them. Each board is independent data. The profile remembers which board is active. Duplicate Profile copies boards. Delete Profile deletes them. New Profile starts with one empty board.

**Recovery** is a separate write, for the profile that is open, retired on every clean exit. It must be a different record from the saved boards so a crash write cannot replace a board.

**Preferences** keep their current auto-save. They are not boards.

**The library** stays one shared database. Boards store bare song ids and nothing else about the song. The library never hands out the same id twice.

**Profile backup and restore** must include saved boards and which board was active. They must not treat the recovery record as a board. A backup taken during a show restores the prepared boards, not the live mess.

**Today's `state.json`** is the live layout, written on hotkey and holding-tank changes and again on quit and profile switch. That job moves to the recovery record. `state.json` itself is frozen and is no longer written. It stops being the thing the next launch opens.

## Storage and lifecycle

### Storage

- Every write to a board file is atomic. A crash in the middle of a write leaves the old file intact.
- The boards file keeps one previous generation beside it, so one bad write is recoverable.
- A file that cannot be read is never treated as empty and is never overwritten.
- The old `state.json` is never written again. It stays frozen, so an older version of the app that is run again still opens the layout the profile had before the upgrade.

### What each exit does to the recovery copy

| Exit | Recovery copy |
| --- | --- |
| Quit, close the window, Windows logoff or shutdown | Retired. The exit is clean. |
| Switch to a different profile | Retired for the profile that was left. |
| Switch board, Revert, delete the active board | Retired. |
| Library import, which restarts the app | All recovery copies are cleared. |
| Backup restore | The current profile's recovery copy is retired. |
| Update install | Kept for the next open. If that open is within 15 minutes, the layout is restored silently, with no prompt. |
| Delete Current Profile | That profile's recovery copy is removed with it. |
| The window crashes but the app survives | Never retired. The app offers to reload the window and restores the layout silently. |
| The app crashes, is killed, or loses power | Never retired. The next open of that profile asks, as described under Crash recovery. |

Recovery always belongs to the profile that opened the session, whichever profile is current when the exit happens.

A layout identical to the saved board is never written as a recovery copy. Any existing copy is retired instead. A show nobody touched therefore never prompts after a crash.

### Before a board is ready

Update, New Board, Revert and Delete are disabled until the board has finished loading. If loading fails, the app stays in that failed state and says so. It never falls through to an empty layout, because an empty layout is one click from replacing a real board.

## Refactoring

- Stop writing hotkey and holding-tank edits through to the layout that the next launch will open. Point those writes at the recovery record.
- On a clean quit, profile switch, or board switch, retire the recovery record and do not update the active board. Profile switch today saves the live layout before it leaves. That save has to stop.
- Load the active saved board when a profile opens, instead of loading `state.json` as the show.
- Keep the startup guard that refuses to persist a half-loaded layout. Aim it at saved boards. An explicit Update is the exception, including an intentional empty board.
- Extend profile create, duplicate, delete, backup, and restore to boards.
- Remove the panel open/save actions and the Hotkeys menu items that save or open a single tab as the way to keep a show. Keep a reader for the old files, and run it from the Board menu onto the current tab.
- Add the Board menu, the header label, crash-restore prompt, Import Board, Update, New, Rename, and Delete.
- Tests that expect the live layout to be the next launch's layout, or that expect a profile switch to persist it, have to change with the behavior.

## Release

The upgrade creates each profile's first board from the layout already stored for that profile, and marks it active. Name it **Board**. The person can rename it. Do not try to guess a show name, and do not try to pick a `.mrv` or `.hld` file for them.

That first board is whatever the app saved last. For many people that is the end of the last show, not the layout they wish they had prepared. This is the sharp edge of the release. The app has no earlier "good" copy except whatever is in those old files and in profile backups, and both of those may also be wreckage. Release notes need to say, in plain language:

- The layout you had is now a board named Board.
- From this version on, changes during a show are kept only if you Update that board or create a New Board.
- Quitting puts the saved board back next time.
- If the real show is still in an old hotkey or holding-tank file, import it onto the tabs and then Update or create a New Board.
- Other people's saved boards can be copied with Import Board.

First launch after the upgrade should not ask them to save, and should not offer a pile of imported files. One short note that this layout is now their board is enough. They already have the import commands if the layout is wrong.

Profile backups created before the upgrade contain `state.json` and no boards. Restoring one of those backups should run the same migration: that layout becomes a board. Say so in the restore path, because that layout may be a mid-show backup rather than a prepared show.

People who use the folder and save icons as the way they keep a show will find those icons gone. The replacement is Update and New Board, plus Import Board for another person on this computer. Legacy import remains for files they already have.

## Decisions that look like open questions

These are settled. A review that reopens them should say what new fact contradicts them.

| Decision | Why |
| --- | --- |
| The night is discarded on a clean exit, with no prompt | The next person cannot know whether the last person wanted the mess kept. Forgetting to save is the safe failure. Saving by accident is not. |
| Update names the board and asks once | Replacing a show is the irreversible write. Quit, profile switch, and board switch stay silent. |
| Crash restore defaults to the saved board | The person who crashed is motivated to choose restore. Everyone else is safe if they accept the default. |
| Copy, never link or overwrite | Jesse's edits must not change Derek's board, and a second import must not clobber a board she already has. |
| No private flag | It would not be real privacy, and it would hide the board Jesse is supposed to find. |
| No board file, no shared folder, no send step | On this computer the board already lives in the owner's profile. |
| Legacy save removed, legacy import kept | New files of one tab are a second, worse copy of a board. Old files are still how some prepared shows exist. |
| Own Board menu, header is a label | Profile is who. Board is the show. The header has to show which show is loaded, and it cannot hold replace and delete. |
| Backing out of Switch Profile keeps the night | The picker opens over the live show. Cancelling it, or picking the same person, changes nothing, so opening the picker can never destroy the show. |
| Song ids are never reused | A board stores bare ids. If an id could later mean a different song, an old board would silently play the wrong track. A missing song is dropped and counted instead. |
| Revert to the saved board | It replaces Start a New Session. People need a way back to the prepared layout in the middle of a night, and it names the board it returns to. |
| Rename and Delete work on any board | The person should not have to load a board to tidy it. Deleting a board that is not active never disturbs the show on screen. |
| Delete loads the next board now | The header and the screen have to stay on a real board. Delete of the active board is a switch, and delete of the last board shows the empty replacement immediately. |
| A board change does not take over playback | The current song finishes or is stopped by the operator. The holding tank that just loaded does not start playing by itself. |
