---
name: Soundboard Mode Implementation
overview: Implement a full-screen Soundboard view mode as an alternative to the traditional three-panel layout. The soundboard will feature a large grid of buttons with a collapsible search panel, multiple tabs, save/load functionality, and proper view state management.
status: COMPLETED (January 2026)
todos: []
---

# Soundboard Mode Implementation Plan

**STATUS: ✅ COMPLETED**  
Implementation completed January 2026. This document remains for historical reference.

## Implementation Notes

The soundboard mode has been fully implemented with the following key features:
- Dynamic grid layout with responsive columns (3-6 based on window width)
- Collapsible search panel with animated toggle (350px → 0px transition)
- Five tabs for organizing soundboard pages
- File import/export (`.mxb` format, single page per file)
- Profile state integration (saves button assignments and search panel state)
- Keyboard navigation with arrow keys, Enter/Space, Delete/Backspace
- Visual feedback for playing buttons (pulse animation)
- Grid constrained to `calc(100vh - 140px)` to keep playback controls visible
- No scrolling - buttons scale to fill available vertical space

## Key Decisions Made

1. **Grid Layout**: Dynamic grid that fills available space (not fixed size)
2. **Button Limits**: No hard limit initially; monitor performance with 50+ buttons
3. **Keyboard Navigation**: Arrow keys, Tab, Enter (common soundboard patterns)
4. **Button Reordering**: Yes - allow drag-to-reorder within grid
5. **Empty State**: Show empty placeholder buttons ("Drop song here") not blank screen
6. **Context Menu**: Options TBD during implementation
7. **Search Panel**: Reuse existing search module, maintain independent state
8. **Feature Flag**: No special flag - available in View menu directly
9. **Visual Feedback**: Follow common soundboard UI patterns
10. **Error Handling**: Leverage existing patterns from hotkeys/holding tank

## Overview

Add a new "Soundboard View" mode that replaces the traditional three-panel layout (Holding Tank | Search | Hotkeys) with a full-screen soundboard grid. Users can toggle between Traditional View and Soundboard View, with each view maintaining its own state.

## Architecture

### View Management

- Two distinct views: **Traditional View** (current) and **Soundboard View** (new)
- Only one view active at a time

- View state preserved when switching

- View preference persisted per profile

### Soundboard View Components

1. **Main Grid Area**: Large, responsive button grid for soundboard buttons

2. **Search Panel**: Collapsible panel on the right side for song search/assignment
3. **Tab Navigation**: 5 tabs (like hotkeys/holding tank) for multiple soundboard pages

4. **Player Controls**: Bottom player panel remains visible

## Implementation Details

### 1. View Switching System

**Location**: `src/renderer/modules/view-manager/` (new module)

**Responsibilities**:

- Track current active view (traditional vs soundboard)

- Handle view switching logic
- Preserve/restore view state

- Persist view preference to profile state

**Key Functions**:

- `switchToTraditionalView()` - Show three-panel layout, restore state
- `switchToSoundboardView()` - Show soundboard layout, restore state
- `getCurrentView()` - Return current view mode

- `saveViewPreference()` - Persist view choice per profile

**State Management**:

- Store view mode in profile state: `currentView: 'traditional' | 'soundboard'`

- Preserve traditional view state when switching away

- Preserve soundboard view state when switching away

### 2. Soundboard Module

**Location**: `src/renderer/modules/soundboard/`**Structure**:

```javascript
soundboard/
├── index.js              # Main module singleton
├── soundboard-grid.js    # Grid layout and button management
├── soundboard-data.js    # Data operations (save/load/assignments)
├── soundboard-ui.js      # UI operations (tabs, search panel)
├── soundboard-events.js  # Event handlers (click, drag-drop)
└── README.md
```



**Key Features**:

- Grid of buttons (responsive: 4-6 columns based on window size)

- Button assignment via drag-drop from search panel

- Right-click context menu for button management

- Visual feedback (playing state, selection)
- Tab management (5 tabs, like hotkeys)

**Data Structure**:

```javascript
// In-memory structure (for profile state)
soundboardPages: {
  page1: {
    tabName: 'Act 1',  // Custom tab name (or null if default)
    buttons: {
      '0-0': { songId: '123', title: 'Song Name', ... },
      '0-1': { songId: '456', ... },
      // Grid position as key: 'row-col'
    }
  },
  page2: { ... },
  // ... page5
}

// File format (.mxb JSON structure)
{
  "version": "1.0.0",
  "created": "2025-01-XX...",
  "pages": [
    {
      "pageNumber": 1,
      "tabName": "Act 1",  // null if using default number
      "buttons": {
        "0-0": { "songId": "123", "title": "Song Name", "artist": "...", "time": "..." },
        "0-1": { "songId": "456", ... }
      }
    },
    // ... page2-5
  ],
  "metadata": {
    "description": "Optional board description",
    "lastModified": "...",
    // Other board-specific settings
  }
}
```

### 3. Search Panel Component

**Location**: `src/renderer/modules/soundboard/soundboard-search-panel.js`

**Features**:
- Collapsible panel on right side
- **Reuse existing search module**: Leverage `src/renderer/modules/search/` for search functionality
- Search controls (category, search box, advanced search) - same as traditional view
- Compact list view of search results
- Drag-drop source for grid buttons
- Right-click context menu
- Toggle button to show/hide panel
- Persist panel state (open/closed) per profile
- **Independent search state**: Search panel maintains its own filter state (doesn't interfere with traditional view)

**UI Behavior**:

- Default: Open (for setup)

- Can be collapsed to maximize grid space

- Slide animation when toggling

- Width: ~300-400px when open

- Overlay or push grid (user preference)

### 4. Save/Load Functionality

**Location**: `src/renderer/modules/soundboard/soundboard-data.js`**Implementation**:

- Follow same pattern as hotkeys/holding tank

- Save to profile state: `soundboardPages` key

- File operations: `saveSoundboardFile()`, `openSoundboardFile()`

- Export/import soundboard configurations

- Integration with `src/main/modules/file-operations.js`

**File Format**:

- File extension: `.mxb` (Mx. Voice Soundboard)
- **Structured data format (JSON)** - Unlike hotkeys (`.mrv`) and holding tank (`.hld`) which use line-based formats, soundboard files use JSON for complex grid data
- JSON structure includes:
  - **Metadata**: Version, creation date, last modified, optional board description
  - **Page/Tab data**: Tab names (custom names or null for defaults), page numbers
  - **Button assignments**: Grid positions, song IDs, song metadata (title, artist, time)
  - **Board settings**: Any board-specific configuration (future extensibility)

### 5. Keyboard Shortcut Management

**Location**: `src/renderer/modules/keyboard-manager/` (modify existing)

**Changes Needed**:

- Detect current view mode

- Disable F1-F12 hotkey handlers when in soundboard view

- Re-enable when switching back to traditional view

- Add view switching keyboard shortcut (e.g., `Cmd/Ctrl+B`)

**Implementation**:

- Check `viewManager.getCurrentView()` before processing F-key shortcuts
- Conditional binding/unbinding of hotkey handlers
- Preserve hotkey state when switching views

### 6. UI Integration

**Menu Integration**:

- Add menu item: View → Soundboard Mode (toggle)
- **No feature flag needed**: Available directly in View menu (beta status can be indicated in UI if desired)
- Keyboard shortcut for switching views (e.g., `Cmd/Ctrl+B`)
- Visual indicator of current mode (menu item checked/unchecked)

**Header/Toolbar**:

- Mode toggle button in main header

- Search panel toggle button (when in soundboard view)

- Tab navigation for soundboard pages

**HTML Structure**:

- New container: `#soundboard-view` (hidden by default)

- Traditional view: `#traditional-view` (current layout)

- Toggle visibility based on active view

### 7. State Persistence

**Profile State Keys**:

- `currentView`: 'traditional' | 'soundboard'

- `soundboardPages`: Object with page data

- `soundboardSearchPanelOpen`: Boolean (panel visibility)

- `soundboardActiveTab`: Number (1-5)

**Save Operations**:

- Auto-save on button assignment/removal

- Save on tab switch
- Save on view switch

- Manual save via menu (like hotkeys)

### 8. Event Handling

**Grid Button Events**:

- **Click**: Play song (stops current sound and plays new one - standard "one-shot" mode)
- **Double-click**: Edit assignment (or reassign song)
- **Right-click**: Context menu (options TBD during implementation)
- **Drag**: Reorder buttons within grid (change position)
- **Drag-over**: Visual feedback (highlight drop target)
- **Keyboard**: Arrow keys navigate, Enter plays, Tab moves between buttons

**Playback Controls** (same as traditional view):
- **Stop**: Escape key or stop button (immediate stop)
- **Fadeout**: Shift-Escape or Shift-Stop button (fade out current sound)
- **One-shot mode**: Clicking a soundboard button automatically stops current sound and plays new one (standard soundboard behavior)
- No additional soundboard-specific controls needed

**Search Panel Events**:

- Drag from search results to grid buttons

- Click to select, then click grid button to assign

- Right-click context menu

**Tab Events**:

- Click tab: Switch soundboard page

- Double-click tab: Rename (like hotkeys)

- Tab state persists per page

## File Changes

### New Files

- `src/renderer/modules/view-manager/index.js`

- `src/renderer/modules/view-manager/README.md`

- `src/renderer/modules/soundboard/index.js`

- `src/renderer/modules/soundboard/soundboard-grid.js`

- `src/renderer/modules/soundboard/soundboard-data.js`

- `src/renderer/modules/soundboard/soundboard-ui.js`
- `src/renderer/modules/soundboard/soundboard-events.js`

- `src/renderer/modules/soundboard/soundboard-search-panel.js`

- `src/renderer/modules/soundboard/README.md`

### Modified Files

- `src/index.html` - Add soundboard view container, mode toggle UI

- `src/renderer/modules/app-bootstrap/module-config.js` - Register soundboard and view-manager modules

- `src/renderer/modules/keyboard-manager/index.js` - Add view-aware F-key handling
- `src/main/modules/file-operations.js` - Add soundboard file save/load handlers

- `src/main/modules/app-setup.js` - Add menu item for view switching

- `src/renderer/modules/profile-state/index.js` - Add soundboard state keys

## Implementation Steps

1. **Create View Manager Module**

- Implement view switching logic

- State preservation/restoration

- Profile state integration

2. **Create Soundboard Module Structure**

- Basic module skeleton
- Grid layout component

- Button rendering

3. **Implement Search Panel**

- Collapsible panel component
- Search integration
- Drag-drop functionality

4. **Add Tab Management**

- 5 tabs like hotkeys

- Tab switching logic

- Page state management

5. **Implement Save/Load**

- Profile state persistence

- File operations (save/load)
- Export/import

6. **Keyboard Shortcut Integration**

- View-aware F-key handling

- View switching shortcut

- Disable hotkeys in soundboard mode

7. **UI Integration**

- HTML structure
- CSS styling
- Menu items
- Toggle buttons

8. **Testing**

- View switching
- State preservation
- Save/load functionality

- Keyboard shortcuts

- Drag-drop operations

## Dependencies

- Existing modules: `hotkeys`, `holding-tank`, `search`, `audio`, `profile-state`
- Bootstrap 5 for UI components

- Existing drag-drop infrastructure

- File operations from main process

## Grid Layout Details

### Dynamic Grid Algorithm

- **Column calculation**: `Math.floor((availableWidth - padding) / (minButtonWidth + gap))`
- **Minimum button size**: ~120px width, ~80px height (touch-friendly)
- **Maximum columns**: 6 (adjustable based on testing)
- **Gap between buttons**: ~10-15px
- **Padding**: ~20px from edges
- **Responsive breakpoints**: Adjust button size/columns based on window width

### Empty State

- **Show empty placeholder buttons**: Display grid of empty buttons with "Drop song here" or similar placeholder text
- **Not blank screen**: Always show grid structure so users know where to add sounds
- **Helpful message**: Optional tooltip or message for first-time users

### Button Limits

- **No hard limit initially**: Allow dynamic grid to fill space
- **Performance testing**: Monitor with 50+ buttons, add limits if needed
- **Virtual scrolling**: Consider if performance degrades with many buttons

### Keyboard Navigation

- **Arrow keys**: Navigate between buttons (up/down/left/right)
- **Tab**: Move focus between buttons
- **Enter/Space**: Play selected button
- **Escape**: Clear selection
- **Delete/Backspace**: Remove song from selected button (if button has song)

## Considerations

- Grid button sizing: Responsive based on window size, minimum 120x80px
- Button layout: Dynamic grid that fills available space
- Performance: Monitor with many buttons, add virtual scrolling if needed
- Accessibility: Full keyboard navigation support
- Mobile/touch: Touch-friendly button sizes (minimum 120x80px)
- Error handling: Leverage existing patterns from hotkeys/holding tank

## Additional Considerations (Based on Codebase Analysis)

### Critical Integration Points

1. **Profile State Module Integration**

   - Soundboard state must be extracted/restored via `profile-state/index.js`
   - Add `extractSoundboardTabs()` function (similar to `extractHotkeyTabs()`)
   - Add `restoreSoundboardTabs()` function (similar to `restoreHotkeyTabs()`)
   - Include soundboard in `extractProfileState()` return object
   - Include soundboard in `loadProfileState()` restoration
   - **CRITICAL**: Respect `window.isRestoringProfileState` lock - don't save during restoration
   - Validate songs exist in database before restoring (like hotkeys/holding tank do)

2. **File Operations Pattern**

   - Add `loadSoundboardFile()` to `src/main/modules/file-operations.js`
   - Add `saveSoundboardFile()` to `src/main/modules/file-operations.js`
   - Use file extension `.mxb` (Mx. Voice Soundboard) for soundboard files
   - Follow same dialog pattern as hotkeys (`.mrv`) and holding tank (`.hld`)
   - **File format: JSON (structured data)** - Unlike hotkeys/holding tank which use line-based formats, soundboard uses JSON for complex grid structure
   - JSON structure includes:
     - **Metadata section**: Version, creation date, last modified, optional board description
     - **Pages array**: Each page with tab name, page number, and button assignments
     - **Button assignments**: Grid positions (row-col), song IDs, and song metadata
     - **Future extensibility**: Can add board-specific settings without breaking existing files
   - Use `JSON.stringify()` for saving (with indentation for readability), `JSON.parse()` for loading
   - Validate JSON structure on load with version checking for future compatibility

3. **Module Bootstrap Registration**

   - Add `view-manager` to `src/renderer/modules/app-bootstrap/module-config.js`
   - Add `soundboard` to `src/renderer/modules/app-bootstrap/module-config.js`
   - Ensure proper initialization order (view-manager before soundboard)
   - Follow existing module pattern (singleton + named exports)

4. **Event Coordination Integration**

   - Add soundboard event handlers to `src/renderer/modules/event-coordination/`
   - Create `soundboard-events.js` in event-coordination module
   - Register with `EventCoordination` class
   - Follow existing event handler patterns (SearchEvents, HotkeysEvents, etc.)

5. **Window Resize Handling**

   - Grid must recalculate layout on window resize
   - Integrate with existing `scaleScrollable()` function if needed
   - Handle responsive column count changes
   - Preserve button assignments during resize

6. **Tab Management Pattern**

   - Use Bootstrap 5 tabs (like hotkeys/holding tank)
   - Follow same tab structure: `#soundboard_tabs` with 5 tabs
   - Tab content: `#soundboard_list_1` through `#soundboard_list_5`
   - Double-click to rename tabs (like hotkeys)
   - Use Bootstrap adapter: `showTab()` from `ui/bootstrap-adapter.js`

7. **State Extraction from DOM**

   - Extract soundboard state directly from DOM (like hotkeys/holding tank)
   - Query grid buttons by position/ID
   - Extract song IDs and metadata
   - Include tab names in state
   - Handle empty buttons gracefully

8. **Database Validation on Restore**

   - Validate songs exist before restoring to grid
   - Query database: `SELECT * FROM mrvoice WHERE id = ?`
   - Skip deleted songs (log warning)
   - Update button labels with current song metadata
   - Follow same pattern as `restoreHotkeyTabs()`

9. **Menu Integration**

   - Add menu item in `src/main/modules/app-setup.js`
   - Menu path: View → Soundboard Mode (toggle)
   - Add keyboard shortcut: `Cmd/Ctrl+B` (or similar)
   - Send IPC message to renderer to switch views
   - Update menu item state (checked/unchecked) based on current view

10. **Keyboard Manager View Awareness**

    - Modify `src/renderer/modules/keyboard-manager/index.js`
    - Check `viewManager.getCurrentView()` before processing F-keys
    - Only bind F-key handlers when in traditional view
    - Unbind F-key handlers when switching to soundboard view
    - Re-bind when switching back to traditional view
    - Preserve F-key state (don't lose assignments)

11. **Drag-Drop Infrastructure Reuse**

    - Use existing `src/renderer/modules/drag-drop/` infrastructure
    - Reuse `songDrag()` function for dragging from search panel
    - Create `soundboardButtonDrop()` similar to `hotkeyDrop()`
    - Follow same event handler pattern
    - Use `setLabelFromSongId()` pattern for button labels

12. **Audio Module Integration**

    - Soundboard buttons use same audio playback as traditional view
    - Call `audio.playSongFromId(songId)` when button clicked
    - **Playback behavior**: Clicking a soundboard button automatically stops current sound and plays new one (standard "one-shot" mode)
    - **Stop controls**: Same as traditional view:
      - **Stop**: Escape key or stop button (immediate stop)
      - **Fadeout**: Shift-Escape or Shift-Stop button (fade out current sound)
    - Visual feedback: highlight playing button
    - Use existing audio state management
    - Respect autoplay/loop settings (if enabled globally)
    - **No additional controls needed**: Existing playback infrastructure is sufficient for soundboard mode

13. **CSS/Styling Considerations**

    - Add soundboard-specific styles to `src/stylesheets/index.css`
    - Follow existing responsive design patterns
    - Use CSS variables from `colors.css`
    - Grid layout: CSS Grid or Flexbox
    - Button sizing: Responsive, touch-friendly
    - Search panel: Slide animation, overlay or push

14. **Profile Directory Structure**

    - Soundboard files saved to profile directory (like hotkeys)
    - Path: `profiles/<ProfileName>/soundboards/` (or similar)
    - Add to `getProfileDirectory()` in `src/main/index-modular.js`
    - Follow same sanitization pattern for profile names

15. **Module Registry Integration**

    - Register soundboard module in `window.moduleRegistry`
    - Access via `window.moduleRegistry.soundboard`
    - Follow existing module access patterns
    - Don't use direct `window.soundboard` (use registry)

16. **Bootstrap Adapter Usage**

    - Use `showTab()` from `ui/bootstrap-adapter.js` for tab switching
    - Don't use jQuery or direct Bootstrap API
    - Follow existing tab management patterns

17. **Debug Logging**

    - Use debug logger (not console.log)
    - Follow existing logging patterns
    - Include module/function context
    - Log state changes, errors, user actions

18. **Error Handling**

    - Validate song IDs before assignment
    - Handle missing songs gracefully (follow hotkeys/holding tank pattern)
    - Handle file I/O errors
    - Handle invalid state data
    - Follow existing error handling patterns from hotkeys/holding tank modules
    - **Missing song files**: Show error indicator on button, allow user to remove or reassign
    - **Corrupted .mxb files**: Validate JSON structure, show error message, allow user to choose backup or start fresh
    - **Database validation**: Skip deleted songs on restore (like hotkeys/holding tank do)

19. **Search Panel Integration**

    - Reuse existing search module (`src/renderer/modules/search/`)
    - Maintain independent search state (doesn't affect traditional view)
    - Use same search controls and functionality
    - Compact display optimized for soundboard panel width

20. **Visual Feedback Patterns**

    - **Playing state**: Highlight button with accent color, optional pulse/animation (follow common soundboard patterns)
    - **Selected state**: Border or background change (follow Bootstrap patterns)
    - **Hover state**: Subtle elevation or color change
    - **Empty button**: Subtle placeholder styling, "Drop song here" text
    - Use existing CSS variables from `colors.css` for consistency

21. **Context Menu Options** (TBD during implementation)

    - Options to consider:
      - Play Now
      - Remove from Soundboard
      - Edit Song
      - Assign to Hotkey (F1-F12)
      - Add to Holding Tank
      - Clear Button
    - Follow existing context menu pattern from `dom-initialization.js`

### Key Patterns to Follow

- **State Lock**: Never save during `window.isRestoringProfileState`
- **DOM Extraction**: Extract state from DOM, not from module state
- **Database Validation**: Always validate songs exist before restoring
- **Module Pattern**: Follow singleton + named exports pattern
- **Event Delegation**: Use event delegation for dynamic grid buttons
- **Profile State**: Integrate with profile-state module for auto-save/restore
- **File Format**: Use JSON (structured data) for soundboard files (`.mxb` extension) - different from line-based formats used by hotkeys (`.mrv`) and holding tank (`.hld`)

