# Soundboard Module

Provides soundboard view functionality with a grid of buttons for quick song playback.

## Purpose

The Soundboard module provides:
- Dynamic grid layout with responsive button sizing (no scrolling, fills available space)
- Drag & drop song assignment to buttons from search results or between buttons
- Multiple tabs (5) for organizing different soundboard pages
- File import/export for soundboard configurations (`.mxb` format)
- State persistence per user profile (including search panel state)
- Keyboard navigation support with arrow keys
- Collapsible search panel with animated toggle (magnifying glass + chevron icon)
- Playback controls always visible at bottom

## Exports

### Default Export
- `soundboard` - Singleton instance of SoundboardModule class

### Named Exports
- `soundboard` - Same singleton instance

## Module Structure

```
soundboard/
├── index.js                    # Main module singleton
├── soundboard-grid.js          # Grid layout and button management
├── soundboard-data.js          # Data operations (save/load/assignments)
├── soundboard-ui.js            # UI operations (tabs, drag-drop)
├── soundboard-events.js        # Event handlers (click, keyboard)
├── soundboard-search-panel.js  # Search panel component
└── README.md
```

## Usage

```javascript
import soundboard from './modules/soundboard/index.js';

// Play song from button
await soundboard.playSongFromButton(songId, buttonElement);

// Switch tabs
soundboard.switchToSoundboardTab(2);

// Save state
await soundboard.saveSoundboardToStore();
```

## Initialization

The module is initialized during app bootstrap. Dependencies are injected via `reinitializeSoundboard()`:

```javascript
await soundboard.reinitializeSoundboard({
  electronAPI: window.secureElectronAPI,
  db: dbInstance,
  store: storeInstance,
  debugLog: debugLog
});
```

## Integration

- **Profile State**: Soundboard state is saved/restored via profile-state module
- **Audio Module**: Uses audio module for song playback
- **Search Module**: Reuses search module for finding songs
- **View Manager**: Coordinates with view-manager for view switching

## File Format

Soundboard files use `.mxb` extension with JSON structure. Each file stores a single page (matching the hotkeys/holding tank pattern):

```json
{
  "version": "1.0.0",
  "created": "2025-01-02T...",
  "page": {
    "pageNumber": 1,
    "tabName": "Act 1",
    "buttons": {
      "0-0": "songId123",
      "0-1": "songId456",
      "1-2": "songId789"
    }
  },
  "metadata": {
    "description": "Optional board description",
    "lastModified": "2025-01-02T..."
  }
}
```

**Note**: Files store only the active tab when saved, not all 5 tabs.

## Grid Layout

- Dynamic grid that fills available vertical space without scrolling
- Responsive columns (3-6 based on window size):
  - **≥1400px**: 6 columns
  - **1200-1400px**: 5 columns  
  - **900-1200px**: 4 columns
  - **<900px**: 3 columns
- Buttons scale to fit available space while maintaining proper gaps (12px)
- Height constrained to `calc(100vh - 140px)` to keep playback controls visible
- Button positions stored as "row-col" keys (e.g., "0-0", "1-2")
- Grid uses flexbox + CSS Grid for responsive, no-scroll layout

## Search Panel

- **Location**: Right side of soundboard view (350px when open)
- **Toggle**: Click the magnifying glass icon in the toolbar
  - Icon shows chevron indicating current state:
    - 🔍 → = Panel open (click to hide)
    - 🔍 ← = Panel closed (click to show)
- **Features**:
  - Category filtering
  - Omni-search and advanced search
  - Drag songs from results to soundboard buttons
  - State persisted per profile
- **Animation**: Smooth 0.3s transition when toggling
- **Button area**: Automatically expands when panel collapses

## Keyboard Navigation

- **Arrow keys**: Navigate between buttons (grid-aware with wrapping)
- **Tab**: Move focus between buttons (standard tab order)
- **Enter/Space**: Play selected button's song
- **Escape**: Stop currently playing audio and clear selection
  - Works globally in soundboard view
  - Plain ESC = immediate stop
  - Shift+ESC = fade out (if configured)
- **Delete/Backspace**: Remove song from selected button
  - Automatically stops playback if that song is currently playing

## Button Interactions

- **Single Click**: Select button and play song
- **Drag**: Move songs between buttons (when button has a song assigned)
- **Drop Target**: Buttons highlight when hovering with dragged song
- **Visual Feedback**: 
  - Active/selected buttons have blue border
  - Playing buttons have animated pulse effect
  - Empty buttons show "Drop song here" placeholder

