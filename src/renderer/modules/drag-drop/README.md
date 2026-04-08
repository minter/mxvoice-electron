# Drag & Drop Module

Handles drag and drop functionality for songs and columns in the application.

## Structure

```
src/renderer/modules/drag-drop/
├── drag-drop-functions.js  # songDrag, hotkeyDrop, holdingTankDrop
├── event-handlers.js       # Event setup and column reordering
├── file-drop-handler.js    # OS file drop (Finder/Explorer) import
├── index.js               # Module exports
└── README.md              # This file
```

## Features

### OS File Drop Import
- **File drop from Finder/Explorer**: Drag audio files from the OS onto the app window to import
- **Visual drop overlay**: Full-window overlay appears when files are dragged over the app
- **Audio filtering**: Only supported audio formats are accepted (mp3, wav, ogg, flac, m4a, etc.)
- **Smart routing**: Files are routed to the appropriate import flow based on count (single add, multi-song import, or bulk add)
- **Debounced drag events**: Prevents overlay flicker when moving between child elements

### Song Drag & Drop
- **songDrag(event)**: Initiates drag for songs with song ID data
- **hotkeyDrop(event)**: Handles dropping songs into hotkey containers
- **holdingTankDrop(event)**: Handles dropping songs into holding tank

### Column Drag & Drop (Improved)
- **Column Reordering**: Drag entire columns to reorder them left-to-right
- **Visual Drop Zones**: Clear indicators between columns showing where to drop
- **Enhanced Feedback**: Visual feedback during drag operations
- **Smart Positioning**: Drop on columns to replace, drop between columns to insert

## Usage

### Song Operations
```javascript
// Drag a song from search results
<span draggable="true" ondragstart="songDrag(event)">Song Title</span>

// Drop into hotkeys or holding tank (handled automatically)
```

### Column Operations
```javascript
// Only column headers are draggable for pane reordering
// Drag any column header to reorder panes
// Drop zones appear between columns for precise positioning
// Song drag and drop continues to work normally in column content areas
```

## Visual Feedback

- **Dragging**: Column becomes semi-transparent with slight rotation
- **Drop Target**: Column shows dashed border when valid drop target
- **Drop Zones**: Thin bars between columns that highlight on hover/drag
- **Animation**: Jello animation when drop completes
- **Headers Only**: Only column headers show grab cursor and hover effects for pane reordering

## Technical Details

- Uses `application/x-moz-node` data transfer for column identification
- Automatically recreates drop zones after reordering
- Saves column order to secure store
- Handles both column replacement and insertion modes
- Maintains existing song drag and drop functionality