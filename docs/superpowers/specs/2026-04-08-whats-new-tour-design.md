# What's New Guided Tour — Design Spec

## Overview

A per-profile "What's New" guided walkthrough that highlights new features after app updates. Uses Driver.js to step users through UI elements with brief text callouts. Auto-triggers once per profile per release, and is always replayable on demand from the app menu.

## Library

**Driver.js** (v1.4.x)
- MIT license — no AGPL concerns
- ~83KB, zero dependencies
- JSON-driven step definitions
- Built-in overlay, highlight, and popover positioning
- npm: `driver.js`

## Tour Data Model

Tour definitions live in `src/renderer/modules/whats-new/tours.js`. Each release version maps to an array of steps:

```json
{
  "tours": {
    "4.3.0": {
      "title": "What's New in 4.3.0",
      "steps": [
        {
          "element": "#crossfade-control",
          "title": "Crossfade Between Tracks",
          "description": "Smoothly blend from one track to the next with the new crossfade slider.",
          "side": "bottom",
          "align": "start"
        },
        {
          "element": "#song-form-volume",
          "title": "Per-Track Volume Control",
          "description": "Adjust volume for individual tracks right from the edit dialog.",
          "side": "right",
          "align": "center",
          "preAction": {
            "type": "function",
            "name": "openEditForFirstSong"
          },
          "postAction": {
            "type": "closeModal",
            "target": "#songFormModal"
          }
        },
        {
          "element": null,
          "title": "New Menu Options",
          "description": "Check the Songs menu for new import and export options.",
          "skipIfMissing": false
        }
      ]
    }
  }
}
```

### Step Fields

| Field | Required | Description |
|---|---|---|
| `element` | No | CSS selector for the target element. `null` for centered popover (no highlight). |
| `title` | Yes | Short heading displayed in the popover. |
| `description` | Yes | Brief description of the feature. |
| `side` | No | Popover position relative to element: `top`, `bottom`, `left`, `right`. Default: `bottom`. |
| `align` | No | Popover alignment: `start`, `center`, `end`. Default: `center`. |
| `skipIfMissing` | No | If `true`, skip this step when the target element is absent or not visible. Default: `false`. |
| `preAction` | No | Action to execute before showing this step. |
| `postAction` | No | Action to execute when leaving this step (Next, Previous, or Dismiss). |

### Action Types

Actions are used in `preAction` and `postAction` fields:

| Type | Fields | Description |
|---|---|---|
| `openModal` | `target` (CSS selector) | Opens a Bootstrap modal via `safeShowModal()`. |
| `closeModal` | `target` (CSS selector) | Dismisses a Bootstrap modal. |
| `click` | `target` (CSS selector) | Simulates a click on a DOM element. |
| `function` | `name` (string) | Calls a registered helper function by name. |
| `hide` | `target` (CSS selector) | Sets `display: none` on an element. |

### Registered Helper Functions

The tour manager maintains a registry of helper functions for complex multi-step UI operations:

- **`openEditForFirstSong`** — Selects the first song row in the results table, fetches its data via `secureDatabase.getSongById()`, populates the edit form, and opens `#songFormModal`. Skips the step if the database is empty.
- **`showContextMenuForFirstSong`** — Selects the first song row and programmatically shows `#mxv-context-menu` positioned near it. Skips if no songs exist.

New helpers are added as needed when tour steps require them.

## Per-Profile Tracking

Tour completion state is stored in profile preferences using the existing `secureElectronAPI.profile.getPreference` / `setPreference` system.

**New preference key:** `tours_seen`

```json
{
  "tours_seen": ["4.2.0", "4.3.0"]
}
```

An array of version strings for which the tour has been completed or dismissed. Checking whether to auto-trigger is a simple `!toursSeen.includes(currentVersion)` against the keys in `tours.js`.

## Trigger Logic

### Auto-trigger (on startup)

Runs during the app bootstrap sequence, after DOM initialization and after the `firstRunModal` check:

1. Read `tours_seen` from profile preferences (default: `[]`).
2. Get the current app version.
3. Check if `tours.js` has an entry for this version.
4. If a tour exists AND the version is not in `tours_seen` → launch the tour.
5. On tour completion or dismissal → append the version to `tours_seen` and save.

The auto-trigger runs after `firstRunModal` logic so new users see the welcome flow first, not a "What's New" tour.

### On-demand (menu item)

A "What's New" menu item is added to:
- **macOS:** The app-name menu, between "Release Notes" and "Contact Support..."
- **Windows/Linux:** The Help menu, same relative position

The menu click sends `menu:whats-new` via IPC to the renderer, which launches `showWhatsNew()`. This replays the tour for the current version regardless of `tours_seen` state.

If no tour is defined for the current version, the menu item opens the GitHub release notes URL as a fallback (same behavior as the existing "Release Notes" menu item).

## Step Lifecycle

Each step follows this sequence:

1. Execute `preAction` (if defined) — open modal, call helper function, etc.
2. Wait for DOM to settle (requestAnimationFrame + short delay for animations).
3. Check if `element` exists and is visible; if `skipIfMissing` is true and element is absent, skip to next step.
4. Highlight the element and show the popover via Driver.js.
5. User clicks Next, Previous, or Skip/Dismiss.
6. Execute `postAction` (if defined) — close modal, hide element, etc.
7. Wait for DOM to settle.
8. Proceed to the next/previous step, or end the tour.

**On dismiss at any point:** All pending `postAction` cleanup runs so the app is not left in an intermediate state (modal open, context menu visible, etc.).

## Module Architecture

New module at `src/renderer/modules/whats-new/`:

### `tours.js`
Tour data as described above.

### `tour-manager.js`
The tour engine. Responsibilities:
- Load and parse `tours.js`.
- Check profile preferences for `tours_seen`.
- Create and configure the Driver.js instance with adaptive theming.
- Execute `preAction`/`postAction` sequences with DOM settle waits.
- Manage the helper function registry.
- Handle `skipIfMissing` logic.
- Mark tours as seen on completion/dismissal.

### `index.js`
Public API:
- **`initWhatsNew()`** — Called during app bootstrap. Checks if a tour should auto-trigger and launches it if so.
- **`showWhatsNew()`** — Called from the `menu:whats-new` IPC handler. Launches the tour for the current version unconditionally.

## Integration Points

### 1. App Bootstrap
In `src/renderer/modules/app-bootstrap/` or `src/renderer/modules/event-coordination/dom-initialization.js`:

```javascript
// After firstRunModal check and DOM is ready
import { initWhatsNew } from '../whats-new/index.js';
await initWhatsNew();
```

### 2. IPC Handler
In the renderer's IPC listener setup:

```javascript
secureElectronAPI.on('menu:whats-new', () => {
  import('../whats-new/index.js').then(m => m.showWhatsNew());
});
```

### 3. Application Menu
In `src/main/modules/app-setup.js`, add a "What's New" menu item:

**macOS** (in the app-name submenu, after "Release Notes"):
```javascript
{
  label: "What's New",
  click: () => {
    mainWindow.webContents.send('menu:whats-new');
  }
}
```

**Windows/Linux** (in the Help submenu, after "Release Notes"):
Same structure.

### 4. Preload
No changes needed. Uses existing `secureElectronAPI.profile.getPreference` and `setPreference`.

## Visual Style

**Adaptive theming** — the Driver.js popover matches the user's `screen_mode` preference:

- **Light mode:** White background, dark text, subtle shadow.
- **Dark mode:** Dark background (`#2d2d44`), light text, border accent.

Implemented via a CSS class on the Driver.js popover container (e.g., `.driver-popover-dark` / `.driver-popover-light`) toggled based on the current `screen_mode` value. A small CSS file or additions to an existing stylesheet handles this.

**Popover layout:**
- Title (bold, 14px)
- Description (regular, 13px)
- Footer: step counter ("1 of 4") on the left, "Skip" and "Next/Previous" buttons on the right
- Highlight border color: accent purple (`#6c63ff`) or the app's existing accent color

## Version Matching

Version matching is **exact** — a tour entry for `"4.3.0"` triggers only for version `4.3.0`, not `4.3.1`. If a patch release has noteworthy changes, it gets its own tour entry in `tours.js`.

## Edge Cases

- **Empty database:** Steps using `openEditForFirstSong` or `showContextMenuForFirstSong` skip gracefully when no songs exist.
- **First-time user:** `firstRunModal` takes priority; the "What's New" tour triggers on subsequent launches if the version has a tour.
- **Multiple version tours unseen:** Only the tour for the current version auto-triggers. Previous version tours are accessible on-demand if the menu item is enhanced to show a version picker (future enhancement, not in v1).
- **DOM element removed between versions:** `skipIfMissing` handles this per-step.
- **Tour interrupted (app closed mid-tour):** The version is NOT added to `tours_seen` since the completion/dismiss callback didn't fire. The tour will re-trigger on next launch.

## Dependencies

**New npm dependency:**
- `driver.js` (^1.4.0) — MIT license, ~83KB

**No other new dependencies required.**

## Testing Strategy

- **Unit tests (Vitest):** Tour manager logic — preference reading/writing, version matching, `skipIfMissing` evaluation, action execution sequencing.
- **E2E tests (Playwright):** Full tour flow — auto-trigger on fresh profile, dismiss behavior, on-demand replay via menu, pre/post action sequences (modal open/close), adaptive theme switching.
