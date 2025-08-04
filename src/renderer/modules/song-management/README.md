# Song Management Module

## Overview

The Song Management module handles all song-related CRUD operations in the application, including creating, editing, deleting songs, and bulk import operations.

## Functions

### Song CRUD Operations (`song-crud.js`)

- **`saveEditedSong(event)`** - Saves edited song information to database
- **`saveNewSong(event)`** - Creates new song with file copying and category handling
- **`editSelectedSong()`** - Opens edit modal for selected song
- **`deleteSelectedSong()`** - Determines appropriate delete action based on context

### Song Removal Operations (`song-removal.js`)

- **`deleteSong()`** - Deletes song from database and removes associated file
- **`removeFromHoldingTank()`** - Removes song from holding tank collection
- **`removeFromHotkey()`** - Removes song from hotkey slot

### Bulk Operations (`bulk-operations.js`)

- **`showBulkAddModal(directory)`** - Shows bulk import modal with category selection
- **`addSongsByPath(pathArray, category)`** - Processes multiple songs from file paths
- **`saveBulkUpload(event)`** - Handles bulk upload from directory with recursive file scanning

## Features

- **Database Integration** - Direct SQLite database operations
- **File System Operations** - File copying, deletion, and path management
- **Metadata Extraction** - Uses music-metadata library for song information
- **Category Management** - Automatic category creation and collision handling
- **UI Integration** - Modal management and form handling
- **Error Handling** - Comprehensive error handling with console logging
- **Confirmation Dialogs** - User confirmation for destructive operations

## Dependencies

- `db` - SQLite database instance
- `window.electronAPI` - Modern Electron API
- `jQuery` - DOM manipulation and modal management
- `mm` - Music metadata library
- `path` - Node.js path module
- `uuidv4` - UUID generation
- `customConfirm` - Custom confirmation dialog
- `searchData` - Search functionality
- `populateCategorySelect` - Category population
- `populateCategoriesModal` - Category modal population
- `saveHoldingTankToStore` - Store operations
- `saveHotkeysToStore` - Store operations

## Usage

```javascript
import { saveEditedSong, deleteSong, showBulkAddModal } from './modules/song-management/index.js';

// Edit a song
saveEditedSong(event);

// Delete a song
deleteSong();

// Show bulk import modal
showBulkAddModal('/path/to/music');
```

## Architecture

The module is organized into three files:
- `song-crud.js` - Core CRUD operations (Create, Read, Update)
- `song-removal.js` - Deletion and removal operations
- `bulk-operations.js` - Bulk import and processing operations

All files are imported and re-exported through the main `index.js` file for easy module loading.

## File Operations

The module handles various file operations:
- **File Copying** - Copies audio files to music directory
- **File Deletion** - Removes audio files when songs are deleted
- **Path Management** - Handles file paths and directory operations
- **Metadata Extraction** - Extracts song metadata from audio files

## Database Operations

The module performs several database operations:
- **INSERT** - Adding new songs and categories
- **UPDATE** - Modifying existing song information
- **DELETE** - Removing songs from database
- **SELECT** - Querying song and category information

## UI Integration

The module integrates with the application UI:
- **Modal Management** - Opening and closing song edit modals
- **Form Handling** - Populating and processing form data
- **Table Updates** - Updating search results and UI elements
- **Confirmation Dialogs** - User confirmation for important operations 