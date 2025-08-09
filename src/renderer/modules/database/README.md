# Database Module

The Database Module provides comprehensive database functionality for the MxVoice Electron application. It handles data population, store persistence, UI operations, and core database CRUD operations.

## Module Structure

```
src/renderer/modules/database/
├── index.js              # Main module interface and coordination
├── data-population.js    # UI data population functions
├── store-operations.js   # Store persistence functions
├── ui-operations.js      # UI scaling and adjustments
├── database-operations.js # Core database CRUD operations
└── README.md            # This documentation
```

## Function Categories

### 1. Data Population Functions (`data-population.js`)

Functions that populate UI elements with data from the database:

- **`populateCategorySelect()`** - Populates category dropdown with database categories
- **`setLabelFromSongId(song_id, element)`** - Sets label for UI element from song ID
- **`addToHoldingTank(song_id, element)`** - Adds song to holding tank UI
- **`populateHotkeys(fkeys, title)`** - Populates hotkeys with song data
- **`populateHoldingTank(songIds)`** - Populates holding tank with song IDs
- **`populateCategoriesModal()`** - Populates categories management modal

### 2. Store Operations (`store-operations.js`)

Functions that handle data persistence to the electron store:

- **`saveHoldingTankToStore()`** - Saves holding tank HTML to store
- **`saveHotkeysToStore()`** - Saves hotkeys HTML to store

### 3. UI Operations (`ui-operations.js`)

Functions that handle UI scaling and adjustments:

- **`scaleScrollable()`** - Scales scrollable elements based on window size

### 4. Database Operations (`database-operations.js`)

Core database CRUD operations for songs and categories:

#### Category Management
- **`editCategory(code, description)`** - Updates category description
- **`deleteCategory(code, description)`** - Deletes category and moves songs to "Uncategorized"
- **`addNewCategory(description)`** - Creates new category with auto-generated code

#### Song Management
- **`saveEditedSong(songData)`** - Updates existing song information
- **`saveNewSong(songData)`** - Creates new song record
- **`deleteSong(songId)`** - Removes song from database
- **`getSongById(songId)`** - Retrieves song information by ID

#### Bulk Operations
- **`addSongsByPath(pathArray, category)`** - Processes multiple audio files and adds to database

#### Query Operations
- **`executeQuery(sql, params)`** - Executes custom SQL queries
- **`executeStatement(sql, params)`** - Executes custom SQL statements (INSERT, UPDATE, DELETE)

## Usage

### Basic Module Usage

```javascript
import databaseModule from './renderer/modules/database/index.js';

// Initialize the module
databaseModule.database.init();

// Get all available functions
const functions = databaseModule.database.getAllDatabaseFunctions();

// Test all functions
const testResults = databaseModule.database.test();
```

### Category Operations

```javascript
// Add a new category
databaseModule.addNewCategory('Rock Music')
  .then(result => console.log('Category added:', result))
  .catch(error => console.error('Error:', error));

// Edit a category
databaseModule.editCategory('ROCK', 'Rock & Roll')
  .then(result => console.log('Category updated:', result))
  .catch(error => console.error('Error:', error));

// Delete a category
databaseModule.deleteCategory('ROCK', 'Rock Music')
  .then(result => console.log('Category deleted:', result))
  .catch(error => console.error('Error:', error));
```

### Song Operations

```javascript
// Save a new song
const songData = {
  title: 'My Song',
  artist: 'My Artist',
  category: 'ROCK',
  info: 'Additional info',
  filename: 'mysong.mp3',
  duration: '03:30'
};

databaseModule.saveNewSong(songData)
  .then(result => console.log('Song saved:', result))
  .catch(error => console.error('Error:', error));

// Get song by ID
databaseModule.getSongById('123')
  .then(result => console.log('Song:', result.data[0]))
  .catch(error => console.error('Error:', error));

// Delete a song
databaseModule.deleteSong('123')
  .then(result => console.log('Song deleted:', result))
  .catch(error => console.error('Error:', error));
```

### UI Population

```javascript
// Populate category select dropdown
databaseModule.populateCategorySelect();

// Add song to holding tank
databaseModule.addToHoldingTank('123', $('#holding-tank'));

// Populate hotkeys
databaseModule.populateHotkeys({f1: '123', f2: '456'}, 'My Hotkeys');
```

### Custom Queries

```javascript
// Execute a custom query
databaseModule.executeQuery('SELECT * FROM mrvoice WHERE category = ?', ['ROCK'])
  .then(result => console.log('Results:', result.data))
  .catch(error => console.error('Error:', error));

// Execute a custom statement
databaseModule.executeStatement('UPDATE mrvoice SET title = ? WHERE id = ?', ['New Title', '123'])
  .then(result => console.log('Updated:', result.changes))
  .catch(error => console.error('Error:', error));
```

## API Compatibility

The module provides both modern Electron API and legacy database access:

### Modern API (Preferred)
Uses `window.electronAPI.database` for all operations:
- `window.electronAPI.database.query(sql, params)`
- `window.electronAPI.database.execute(sql, params)`
- `window.electronAPI.database.getCategories()`

### Legacy API (Fallback)
Uses direct SQLite database access:
- `db.prepare(sql).all(params)`
- `db.prepare(sql).run(params)`
- `db.prepare(sql).get(params)`

## Error Handling

All functions return Promises and include comprehensive error handling:

```javascript
databaseModule.addNewCategory('Test Category')
  .then(result => {
    console.log('✅ Success:', result);
  })
  .catch(error => {
    console.error('❌ Error:', error.message);
  });
```

## Testing

The module includes comprehensive testing capabilities:

```javascript
// Test all functions
const testResults = databaseModule.database.test();
console.log('Test Results:', testResults);

// Get module information
const info = databaseModule.database.getInfo();
console.log('Module Info:', info);
```

## Dependencies

- **jQuery**: For DOM manipulation and UI interactions
- **Electron API**: For main process communication
- **SQLite**: For database operations (via main process)
- **electron-store**: For data persistence

## Migration Notes

This module is part of the gradual migration from the monolithic `renderer.js` file. It maintains backward compatibility while providing a cleaner, more modular structure.

### Functions Migrated from renderer.js:
- `populateCategorySelect()` (line 278)
- `setLabelFromSongId()` (line 630)
- `addToHoldingTank()` (line 762)
- `populateHotkeys()` (line 146)
- `populateHoldingTank()` (line 165)
- `populateCategoriesModal()` (line 1852)
- `saveHoldingTankToStore()` (line 114)
- `saveHotkeysToStore()` (line 122)
- `scale_scrollable()` (line 1440)
- `editCategory()` (line 1872)
- `deleteCategory()` (line 1885)
- `addNewCategory()` (line 1938)
- `saveEditedSong()` (line 1464)
- `saveNewSong()` (line 1483)
- `deleteSong()` (line 1340)
- `addSongsByPath()` (line 1695)

## Future Enhancements

- [ ] Add bulk import/export functionality
- [ ] Add database backup/restore operations
- [ ] Add database optimization functions
- [ ] Add database statistics and reporting
- [ ] Add database migration utilities 