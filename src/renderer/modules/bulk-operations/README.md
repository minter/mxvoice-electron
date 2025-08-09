# Bulk Operations Module

## Overview

The Bulk Operations Module handles bulk import of songs from directories and processing multiple files. It provides functionality for importing large numbers of audio files at once with category assignment and metadata extraction.

## Functions

### Core Functions

- **`showBulkAddModal(directory)`** - Shows the bulk add modal with directory and category selection
- **`addSongsByPath(pathArray, category)`** - Processes songs from a path array and adds them to the database
- **`saveBulkUpload(event)`** - Handles bulk upload of songs from a directory

### Event Handlers

- **`setupBulkEventHandlers()`** - Sets up all bulk operations event handlers

## Features

- **Directory Recursion** - Recursively walks through directories to find audio files
- **Metadata Extraction** - Extracts title, artist, and duration from audio files
- **File Copying** - Copies audio files to the music directory with unique names
- **Category Assignment** - Allows assignment of songs to categories during bulk import
- **New Category Creation** - Supports creating new categories during bulk import
- **UI Integration** - Integrates with the bulk add modal and form handling

## Supported Audio Formats

- MP3 (.mp3)
- MP4 (.mp4)
- M4A (.m4a)
- WAV (.wav)
- OGG (.ogg)

## Usage

```javascript
// Initialize the bulk operations module
import { initializeBulkOperations } from './bulk-operations/index.js';
initializeBulkOperations();

// Show bulk add modal
import { showBulkAddModal } from './bulk-operations/index.js';
showBulkAddModal('/path/to/directory');

// Process songs from paths
import { addSongsByPath } from './bulk-operations/index.js';
addSongsByPath(['/path/to/song1.mp3', '/path/to/song2.mp3'], 'ROCK');

// Handle bulk upload form submission
import { saveBulkUpload } from './bulk-operations/index.js';
saveBulkUpload(event);
```

## Dependencies

- Database module for song and category storage
- File system API for directory operations
- Audio metadata parsing library
- jQuery for UI manipulation 