# Shows — Product Brief

Status: decision record for review. Not an implementation plan.

Mx. Voice is used to run audio at improv shows. A person opens their profile at the start of the night and expects the hotkeys and holding tank to be the layout they prepared for that show. During the show they move tracks around. Today the app saves those changes continuously, so the next launch opens the wreckage of the last show. There is no way back to the prepared layout.

This brief splits "who is at the machine" from "which show is loaded," and makes the prepared show something you return to without remembering to save on the way out.

## The idea

A **profile** is a person. It keeps that person's preferences, and it owns their shows.

A **show** is the prepared layout for one show: every hotkey tab and every holding-tank tab. A profile has one or more shows and remembers which show was active. Opening the profile loads that show as it was saved.

The layout on screen during a show is a **live session**. It is allowed to diverge from the saved show. While it does, the show has **unsaved changes**, and the header says so. A normal quit or a profile switch throws the session away without asking. Switching to another show asks first when there are unsaved changes. The saved show does not change unless someone explicitly saves it or saves it as a new show.

Derek and Jesse on the same theater computer share the song library and have separate profiles. Jesse can copy one of Derek's saved shows into her own profile. The copy is hers. His show does not change when she edits hers, and her copy does not pick up his later edits.

## Goals

- Opening a profile loads the last show that was active, in its saved state.
- Switching shows loads the other show's saved state, after offering to save the one on screen.
- The night's changes survive a crash. They do not survive a clean quit or a profile switch, and they survive a show switch only if the operator chooses Save.
- Changing what a show will open as next time is an explicit act, taken while the person who wants the change is still there.
- A person can keep more than one show on their profile.
- One person can copy another person's saved show on the same computer.
- An existing profile's current layout becomes a show, so this upgrade does not start anyone from empty.
- Old hotkey (`.mrv`) and holding-tank (`.hld`) files can still be read onto a tab.

## Non-goals

- Private shows. A saved show may be copied by any profile on this computer. Profiles are not locked, so a hidden flag would not keep anyone out of the show anyway. Saving is the act that makes a layout copyable. The unsaved session stays invisible to other profiles.
- Moving a show to another computer. Same-computer copy is the move that matters now.
- A shared folder of show files, or a send/handover step. Derek does not export. Jesse copies from his profile.
- Replacing one of Jesse's shows from Derek's newer copy. Import always adds a show. Refreshing means importing again and deleting the old copy.
- Version history of a night, automatic snapshots, or a save prompt when quitting, logging out, or switching profiles.
- Putting the song library, categories, audio files, or preferences into a show.
- A keyboard launch layout. This version does not design it.
- Keeping audio playing through a profile switch. A profile switch still reloads the page and stops audio. A show switch keeps the song playing. Carrying audio across a profile switch is a separate, later project.
- A visual redesign of the three columns, the tabs, or the transport.

## What a show contains

- Every hotkey tab: name, order, and the song id on each key.
- Every holding-tank tab: name, order, and the song ids in order.
- Which hotkey tab and which holding-tank tab were selected.

A show does not contain theme, font size, directories, update settings, or the Holding/Playlist mode. Those stay profile preferences and keep saving themselves.

Song ids refer to the shared library on this computer. Copying a show between profiles on this machine finds the same tracks. A song id is never reused for a different song, so a show can never quietly point at the wrong track. Loading a show drops song ids that are no longer in the library. The drop happens in the live session only, the saved show is not rewritten, and the person is told how many songs were dropped. A dropped song does not count as an unsaved change.

The stored show needs a version field so a later addition can land without breaking shows saved by this version.

## Behavior

### Opening and leaving

Entering a profile, from the launcher or from Switch Profile, loads that profile's active show from its saved state. The live session starts equal to that show.

These exits discard the live session and do not ask anything:

- Quit, or close the window.
- A different profile actually opening, including Log Out.

Choosing Switch Profile opens the profile picker in the same window. Cancelling it, or picking the same person again, leaves the live session exactly as it was. Nothing is restored, because nothing was torn down, and there is no crash prompt. The session is discarded only once a different profile is the one that opens.

The next entry loads the saved show again. No one has to save at the end of the night. The next person can switch profiles without deciding whether the person who left wanted anything kept.

### Switching shows

Switching to another show, or importing one, replaces the layout on screen. When the show on screen has no unsaved changes, it happens at once. When it has unsaved changes, the app asks first:

**Save changes to "Comedy Sports"?** with **Save**, **Don't Save** and **Cancel**.

- **Save** saves "Comedy Sports" with the layout on screen, then switches.
- **Don't Save** switches and throws the changes away.
- **Cancel** stays on "Comedy Sports". Nothing changes, and the menu check stays on it.

Cancel is the default. Return, Esc and closing the prompt all choose it, so a reflex keystroke never saves over a show or loses one.

The prompt is the operator's moment, not the end of the night. The person switching shows is at the machine and knows whether the changes matter. Quit, closing the window, profile switch and Log Out still never ask.

### Crash recovery

While a session is open, the app may write a recovery copy of the live layout. That copy is not a show. A clean quit, a profile switch, or a show switch retires it.

If the last exit of a profile was not clean, the next open of **that** profile asks whether to restore the show in progress. The default is the saved show. The person who just crashed can choose the recovery copy. Anyone else accepts the default and gets the saved show. Opening a different profile shows nothing about the crash.

Restoring a crashed session loads it as the live layout. It still does not change the saved show. A later clean quit throws it away again.

### Changing a show

Two explicit ways to keep the layout on screen:

- **Save "Comedy Sports"…** replaces that saved show with the layout now on screen. The show's name is part of the command, and the command asks for a single confirmation that names the show, because replacing a show is the irreversible mistake. Anything changed after the save still disappears on the next clean exit.
- **Save As...** takes the layout now on screen, asks for a name, and adds a show. The new show becomes the active one. The show it came from keeps its saved layout, and Save As does not ask whether to discard it.

While the layout on screen differs from the saved show, the header shows a dot after the show's name. Saving clears it. So does changing the layout back to what was saved.

**Rename "Comedy Sports"...** and **Delete "Comedy Sports"...** act on the show on screen. To tidy another show, switch to it first. Delete asks for confirmation, and the confirmation says the layout on screen will be replaced. The show is left immediately:

- If other shows remain, the next show in the list becomes active and loads. That discards the live session without the save prompt, because the person has just confirmed that this show goes away.
- If it was the last show, an empty show takes its place and shows immediately.

A profile always has at least one show.

Save is allowed to store an empty layout, because someone may want a show to open clear. Automatic writes are not. An empty or half-loaded layout must never replace a saved show by itself. The guard that already refuses to overwrite profile state during startup has to apply to saved shows.

Clearing a tab changes the live session only.

**Revert to Saved…** replaces the live session with the active show as it was saved. It is enabled only when the session is ready and there are unsaved changes (the header dot); otherwise it is disabled and does nothing. It asks once, then reloads the show. It replaces View → Start a New Session, which goes away.

Switching shows, reverting, importing a show, or deleting the active show can happen while audio is playing. The song that is already playing continues, and its name stays in the now-playing display. Stop still stops it. The marks that point at the old layout are cleared: the playing-row highlight, the selected row and the active hotkey. Playlist mode does not advance into the holding tank that just loaded, even if the operator switches to Playlist mode afterwards. The operator chooses the next sound.

### Copying from someone else

Import Show lists the other profiles on this computer and the saved shows in each. It does not list the current profile, and it does not list anyone's live session.

Choosing Derek → Comedy Sports adds a new show to Jesse's profile and makes it active. If Jesse's show on screen has unsaved changes, she is asked to save them first, the same as switching shows. Derek's show is untouched. The copy is always named after the show and the profile it came from, for example "Comedy Sports (Derek)". If Jesse already has a show with that name, 2, 3 and so on are added. The copy remembers where it came from. Import never overwrites an existing show.

### Old hotkey and holding-tank files

Those files predate profiles and tabs. A `.mrv` file is one hotkey tab. A `.hld` file is one holding-tank list. People still have them, and some of those files are the show they actually prepared, while the layout the app has been auto-saving is the wreckage.

Each tab's ⋯ menu (and the right-click menu on a tab) has **Save Tab to File…** and **Load Tab from File…**, after Rename and Clear. They act on the selected tab of that panel.

- Save writes the selected hotkey tab as a `.mrv` file (`f1::<id>` to `f12::<id>`, then `tab_name::<name>` with spaces as `_` when the tab has a name) or the selected holding-tank tab as a `.hld` file (one song id per line). These are the formats older versions read and write, so files go both ways. The save dialog opens in the hotkey folder, with the tab label as the file name, for example `Preshow.hld` or `Tab 2.mrv`.
- Load fills the selected tab from a file. A hotkey file's tab name, if it has one, is applied. If the tab already has songs, it asks first (`Replace the songs in "Preshow"?`, Cancel is the default); an empty tab loads without asking. Songs missing from the library are skipped and counted, and a file with no songs says so. A load waits until the show has finished loading.

Loading changes the live session only. The saved show changes when the person then uses Save or Save As. There is no scan of the hotkey folder and no automatic show per file. The app cannot tell which files were a show.

A show keeps the whole night. A tab file is a reusable piece, such as a pre-show playlist or a standard set of drops, to load into several shows. This version does not add a show file for other computers.

## UI

### Shows menu

Shows get their own top-level menu, titled **Shows**. They do not go under Profile. The Profile menu is who is at the machine: switch, log out, new, duplicate, delete, backup. Those actions are rare, and some of them are destructive. Choosing the show for tonight is not one of them.

The menu contains:

- The profile's shows, with a check on the active one. Choosing one switches shows.
- A separator
- Save "Comedy Sports"…
- Save As...
- Revert to Saved…
- Rename "Comedy Sports"...
- Delete "Comedy Sports"...
- Color, a submenu: None, Teal, Blue, Purple, Pink, Coral, Amber, Green, with a check on the current show's color
- A separator, then Import Show...

Save and Save As are the words people already know for keeping their work, so the menu uses them. What keeps the night from becoming a document is the rest of the design: a clean exit never asks, and the saved show comes back next time.

Nothing in the Shows menu has a keyboard shortcut. Cmd/Ctrl+O and Cmd/Ctrl+S are left unbound rather than reassigned. Save replaces a prepared show and asks first, and it should be chosen from the menu, not hit by a reflex keystroke.

### Header

The search-column header already shows the profile name. It also shows the active show name, so the loaded show is visible without opening a menu. A dot after the name means the layout on screen has unsaved changes. The header is a label. It does not open the Shows menu. Commands that replace or delete a show do not belong on that label.

### Show color

A show can have an accent color, so the operator can tell at a glance which show is loaded. Shows → Color sets it for the show on screen, with no prompt; None takes it off. The color is stored on the show as a palette key (`teal`, `blue`, `purple`, `pink`, `coral`, `amber`, `green`) or null; an unknown key reads as no color, and a document with colors still opens in a build without them. The migrated Default Show starts with none.

The color appears in three places only, in light and dark mode: the window background behind the panels (the gutters around and between the three panels and the transport, painted by `.container-fluid`; the 200 stop of the palette in light mode, the 600 stop in dark), a 2px accent under the active hotkey and holding-tank tab, and a pill around the show name in the header. Panels, headers, tab rows, song rows, F-key badges, the Holding/Playlist toggle, the transport, dialogs and the ⋯ menus are never colored, and no text sits directly on the colored background. The styles live in their own stylesheet, keyed on `html[data-show-color]`, so the feature can be removed by dropping the file or the attribute.

### Played counts

A sound operator needs to see which tracks have already been played tonight without taking them off the panels; some drops are played again and again. Each song has a played count for the night. It goes up by one the moment playback starts, from any source: a hotkey (F-key, double-click or the context menu's Play), the holding tank, search, autoplay or a playlist advance and its crossfade, and the play button. Finishing, pausing, resuming or stopping does not count, and a song that fails to load does not count. Counts are per song, not per slot, so a song on F1 and in the holding tank shows the same count in both.

A song played at least once shows a small muted pill, ▶ and the count, after its name in a hotkey slot, at the right end of its holding tank row, and at the end of its Title cell in search results. The pill never dims a row and never changes F-key badges, now-playing or selection styling. It stays visible when a hotkey name is cut off with an ellipsis. Its styles live in their own stylesheet (`played-counts.css`), with the two colors in `colors.css`.

The counts belong to the profile's session, not to a show. They start empty whenever a profile opens, and they carry across show switches, Revert, Import and Save. They are not part of the show document, and they never affect the unsaved-changes dot or the comparison with the saved show. **Shows → Reset Played**, after Revert to Saved, clears them all without asking; it is enabled when the show is ready and any song has been played. **Mark as Unplayed** in a song's right-click menu (search result, holding tank row or hotkey slot) clears that one song, and is shown only for a song played tonight.

For crash safety the counts are written, on every change, to `userData/recovery/<key>.played.json` beside the recovery copy, with the same profile, fence and queue rules. A clean exit, a profile switch and the other exits in the table below retire it wherever they retire the recovery copy, and a library import clears it with the rest. Retiring the recovery copy because the layout matches the saved show leaves it alone. A played file counts as a show in progress: after a crash with counts but no layout change, the next open asks as usual; Restore brings back the counts (with the saved show, or with the recovery copy when there is one), and Open saved show clears them. An update install or a window crash restores them silently, like the layout.

### What comes off the panels

Remove the open-folder and save icons from the Holding Tank header and the Hotkeys header. Rename and clear stay.

Remove the Hotkeys menu. Its only items are Open Hotkeys File and Save Hotkeys To File. Those commands move to each tab's ⋯ menu as Load Tab from File… and Save Tab to File…, acting on one tab.

### What does not move

The Profile menu stays as it is. The launcher still picks a person before the main window opens. It does not pick a show. The columns, tabs, search, and transport stay.

## Architecture

This is the shape, not the file layout.

**Saved shows** live with the profile that owns them. Each show is independent data. The profile remembers which show is active. Duplicate Profile copies shows. Delete Profile deletes them. New Profile starts with one empty show.

**Recovery** is a separate write, for the profile that is open, retired on every clean exit. It must be a different record from the saved shows so a crash write cannot replace a show.

**Unsaved changes** are known from the same comparison that decides whether to write a recovery copy. A layout that differs from the saved show has unsaved changes. A layout equal to it does not.

**Preferences** keep their current auto-save. They are not shows.

**The library** stays one shared database. Shows store bare song ids and nothing else about the song. The library never hands out the same id twice.

**Profile backup and restore** must include saved shows and which show was active. They must not treat the recovery record as a show. A backup taken during a show restores the prepared shows, not the live mess.

**Today's `state.json`** is the live layout, written on hotkey and holding-tank changes and again on quit and profile switch. That job moves to the recovery record. `state.json` itself is frozen and is no longer written. It stops being the thing the next launch opens.

## Storage and lifecycle

### Storage

- Every write to a shows file is atomic. A crash in the middle of a write leaves the old file intact.
- The shows file keeps one previous generation beside it, so one bad write is recoverable.
- A file that cannot be read is never treated as empty and is never overwritten.
- The old `state.json` is never written again. It stays frozen, so an older version of the app that is run again still opens the layout the profile had before the upgrade.

### What each exit does to the recovery copy

| Exit | Recovery copy |
| --- | --- |
| Quit, close the window, Windows logoff or shutdown | Retired. The exit is clean. |
| Switch to a different profile | Retired for the profile that was left. |
| Switch show, Revert, delete the active show | Retired. |
| Library import, which restarts the app | All recovery copies are cleared. |
| Backup restore | The current profile's recovery copy is retired. |
| Update install | Kept for the next open. If that open is within 15 minutes, the layout is restored silently, with no prompt. |
| Delete Current Profile | That profile's recovery copy is removed with it. |
| The window crashes but the app survives | Never retired. The app offers to reload the window and restores the layout silently. |
| The app crashes, is killed, or loses power | Never retired. The next open of that profile asks, as described under Crash recovery. |

Recovery always belongs to the profile that opened the session, whichever profile is current when the exit happens.

A layout identical to the saved show is never written as a recovery copy. Any existing copy is retired instead. A show nobody touched therefore never prompts after a crash, and never asks to be saved on a switch.

### Before a show is ready

Save, Save As, Revert and Delete are disabled until the show has finished loading. If loading fails, the app stays in that failed state and says so. It never falls through to an empty layout, because an empty layout is one click from replacing a real show.

## Refactoring

- Stop writing hotkey and holding-tank edits through to the layout that the next launch will open. Point those writes at the recovery record.
- On a clean quit, profile switch, or show switch, retire the recovery record and do not update the active show unless the operator chose Save at the switch prompt. Profile switch today saves the live layout before it leaves. That save has to stop.
- Load the active saved show when a profile opens, instead of loading `state.json` as the show.
- Keep the startup guard that refuses to persist a half-loaded layout. Aim it at saved shows. An explicit Save is the exception, including an intentional empty show.
- Extend profile create, duplicate, delete, backup, and restore to shows.
- Remove the panel open/save actions and the Hotkeys menu items that save or open a single tab as the way to keep a show. Keep a reader for the old files, and run it from the Shows menu onto the current tab.
- Add the Shows menu, the header label and its unsaved-changes dot, the crash-restore prompt, the save prompt on switch and import, Import Show, Save, Save As, Rename, and Delete.
- Tests that expect the live layout to be the next launch's layout, or that expect a profile switch to persist it, have to change with the behavior.

## Release

The upgrade creates each profile's first show from the layout already stored for that profile, and marks it active. Name it **Default Show**. The person can rename it. Do not try to guess a show name, and do not try to pick a `.mrv` or `.hld` file for them.

That first show is whatever the app saved last. For many people that is the end of the last show, not the layout they wish they had prepared. This is the sharp edge of the release. The app has no earlier "good" copy except whatever is in those old files and in profile backups, and both of those may also be wreckage. Release notes need to say, in plain language:

- The layout you had is now a show named Default Show.
- From this version on, changes during a show are kept only if you Save that show or use Save As to make a new one.
- Quitting puts the saved show back next time. A dot after the show's name means there are changes that quitting will throw away.
- Switching to another show asks whether to save your changes first.
- If the real show is still in an old hotkey or holding-tank file, load it onto the tabs (Load Tab from File… in the tab's ⋯ menu) and then Save or Save As.
- Other people's saved shows can be copied with Import Show.

First launch after the upgrade should not ask them to save, and should not offer a pile of imported files. One short note that this layout is now their show is enough. They already have the import commands if the layout is wrong.

Profile backups created before the upgrade contain `state.json` and no shows. Restoring one of those backups should run the same migration: that layout becomes a show. Say so in the restore path, because that layout may be a mid-show backup rather than a prepared show.

People who use the folder and save icons as the way they keep a show will find those icons gone. The replacement is Save and Save As, plus Import Show for another person on this computer. Tab files still save and load from each tab's ⋯ menu.

## Decisions that look like open questions

These are settled. A review that reopens them should say what new fact contradicts them.

| Decision | Why |
| --- | --- |
| The night is discarded on a clean exit, with no prompt | Quit, closing the window, profile switch and Log Out never ask. The next person cannot know whether the last person wanted the mess kept. Forgetting to save is the safe failure. Saving by accident is not. |
| Switching shows asks to save unsaved changes | The operator is present. The person choosing another show is the one who made the changes and knows whether they matter. Cancel is the default, so Return or Esc never saves over a show or loses one. A show with no unsaved changes switches without asking. |
| Save names the show and asks once | Replacing a show is the irreversible write. The name in the command and in the confirmation says which show will change. |
| The commands are Save and Save As | They are the words people already know for keeping their work. The silent clean exit, not the vocabulary, is what keeps the night from becoming a document. The header dot shows when there is something to save. |
| Crash restore defaults to the saved show | The person who crashed is motivated to choose restore. Everyone else is safe if they accept the default. |
| Copy, never link or overwrite | Jesse's edits must not change Derek's show, and a second import must not clobber a show she already has. |
| No private flag | It would not be real privacy, and it would hide the show Jesse is supposed to find. |
| No show file, no shared folder, no send step | On this computer the show already lives in the owner's profile. |
| Tabs can be saved to and loaded from files | A show keeps the whole night; a tab file is a reusable piece (a pre-show playlist, a standard set of drops) to load into several shows. The file formats are unchanged, so old files still load and new files work in older versions. |
| Own Shows menu, header is a label | Profile is who. The show is what is loaded. The header has to show which show is loaded, and it cannot hold replace and delete. |
| Backing out of Switch Profile keeps the night | The picker opens over the live show. Cancelling it, or picking the same person, changes nothing, so opening the picker can never destroy the show. |
| Song ids are never reused | A show stores bare ids. If an id could later mean a different song, an old show would silently play the wrong track. A missing song is dropped and counted instead. |
| Revert to the saved show | It replaces Start a New Session. People need a way back to the prepared layout in the middle of a night. |
| Revert only with unsaved changes | With nothing changed there is nothing to discard, so the item is disabled. The header dot and the menu agree on whether the show has changed. |
| Rename and Delete act on the current show | Like Save and Revert, each command names the show it changes, and that show is the one on screen. Nothing is renamed or deleted that the person cannot see. Tidying another show means switching to it first. |
| Delete loads the next show now | The header and the screen have to stay on a real show. Delete of the active show is a switch, and delete of the last show shows the empty replacement immediately. Its own confirmation replaces the save prompt. |
| Color is a show property, saved at once | Like the name, it describes the show, not the layout on screen, so choosing a color saves immediately and never touches the layout or the unsaved-changes dot. Save As and Import Show copy it, since the copy is the same show to the operator. |
| Played counts are per song for the night | The operator wants to know whether a track has been heard tonight, wherever it sits, so counts follow the song, not the slot. They are cleared when a profile opens, kept across show switches (a show change is still the same night), never saved in a show, and saved beside the recovery copy so a crash restore brings them back. |
| A show change does not take over playback | The current song finishes or is stopped by the operator. The holding tank that just loaded does not start playing by itself. |
