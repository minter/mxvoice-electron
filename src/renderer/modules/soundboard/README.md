# Soundboard Module

Provides soundboard view functionality with a grid of buttons for quick song playback.

## Purpose

The Soundboard module provides:
- Dynamic grid layout with responsive button sizing
- Drag & drop song assignment to buttons
- Multiple tabs (5) for organizing different soundboard pages
- File import/export for soundboard configurations (`.mxb` format)
- State persistence per user profile
- Keyboard navigation support
- Collapsible search panel for finding and assigning songs

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

Soundboard files use `.mxb` extension with JSON structure:

```json
{
  "version": "1.0.0",
  "created": "2025-01-XX...",
  "pages": [
    {
      "pageNumber": 1,
      "tabName": "Act 1",
      "buttons": {
        "0-0": "songId123",
        "0-1": "songId456"
      }
    }
  ],
  "metadata": {
    "description": "Optional board description",
    "lastModified": "..."
  }
}
```

## Grid Layout

- Dynamic grid that fills available space
- Responsive columns (4-6 based on window size)
- Minimum button size: 120x80px (touch-friendly)
- Button positions stored as "row-col" keys

## Keyboard Navigation

- **Arrow keys**: Navigate between buttons
- **Tab**: Move focus between buttons
- **Enter/Space**: Play selected button
- **Escape**: Clear selection
- **Delete/Backspace**: Remove song from selected button

