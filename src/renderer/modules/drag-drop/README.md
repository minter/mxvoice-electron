# Drag & Drop Module

## Overview

The Drag & Drop Module handles all drag and drop functionality for moving songs between containers and rearranging UI elements. It provides a clean interface for managing drag and drop operations throughout the application.

## Functions

### Core Functions

- **`hotkeyDrop(event)`** - Handles dropping songs into hotkey containers
- **`holdingTankDrop(event)`** - Handles dropping songs into holding tank
- **`allowHotkeyDrop(event)`** - Allows dropping into hotkey containers
- **`songDrag(event)`** - Handles dragging songs
- **`columnDrag(event)`** - Handles dragging columns

### Module Functions

- **`initializeDragDrop()`** - Initializes the drag and drop module and sets up event handlers
- **`getDragDropFunctions()`** - Returns all drag and drop functions as an object

### Event Handlers

- **`setupDragDropEventHandlers()`** - Sets up all drag and drop event handlers

## Features

### Song Dragging
- **Song Drag Start** - Initiates drag operation for songs with song ID
- **Visual Feedback** - Provides visual feedback during drag operations
- **Data Transfer** - Transfers song ID data during drag operations

### Hotkey Drop Zones
- **Drop Target Highlighting** - Highlights drop targets during drag operations
- **Song Assignment** - Assigns songs to hotkey containers on drop
- **Label Updates** - Updates hotkey labels with song information

### Holding Tank Drop Zones
- **Drop Zone Highlighting** - Highlights holding tank as drop zone
- **Song Addition** - Adds songs to holding tank on drop
- **Visual Feedback** - Provides visual feedback for drop operations

### Column Dragging
- **Column Reordering** - Allows reordering of UI columns
- **Column Animation** - Provides animation feedback for column moves
- **Order Persistence** - Saves column order to persistent storage

## Event Handlers

### Hotkey Drop Handlers
- **Drop Event** - Handles dropping songs into hotkey containers
- **Drag Over Event** - Highlights drop targets and allows drops
- **Drag Leave Event** - Removes drop target highlighting

### Holding Tank Drop Handlers
- **Drop Event** - Handles dropping songs into holding tank
- **Drag Over Event** - Highlights holding tank as drop zone
- **Drag Leave Event** - Removes drop zone highlighting

### Column Drag Handlers
- **Drag Over Event** - Allows column dragging
- **Drop Event** - Handles column reordering and persistence

## Usage

```javascript
// Initialize the drag and drop module
import { initializeDragDrop } from './drag-drop/index.js';
initializeDragDrop();

// Use drag and drop functions directly
import { songDrag, hotkeyDrop } from './drag-drop/index.js';
songDrag(event);
hotkeyDrop(event);

// Get all drag and drop functions
import { getDragDropFunctions } from './drag-drop/index.js';
const dragDropFunctions = getDragDropFunctions();
```

## Dependencies

- jQuery for DOM manipulation and event handling
- Database module for song information retrieval
- Holding tank module for song addition
- Store API for column order persistence
- Animation utilities for visual feedback

## Supported Operations

### Song Operations
- Drag songs from search results
- Drop songs into hotkey containers
- Drop songs into holding tank
- Visual feedback during drag operations

### UI Operations
- Drag and reorder columns
- Persist column order changes
- Animate column movements
- Visual feedback for UI changes 