# Database Operations Testing Guide

This guide explains how to test the database operations we've implemented in the MxVoice Electron application.

## Testing Options

### 1. 🖥️ Browser Testing (Recommended for Quick Tests)

**File:** `src/test-database-operations-simple.html`

**How to use:**
1. Open the file in your browser
2. Click individual test buttons to test specific operations
3. Click "Run All Tests" to test everything at once
4. Watch the console output for results

**Features:**
- ✅ Interactive buttons for each operation
- ✅ Real-time console output
- ✅ Mock implementations for safe testing
- ✅ Visual feedback for all operations

### 2. 📊 Comprehensive Browser Testing

**File:** `src/test-database-module-page.html`

**How to use:**
1. Open the file in your browser
2. Click "Run All Tests" for comprehensive testing
3. Use individual test buttons for specific components
4. Check detailed console output

**Features:**
- ✅ Complete module testing
- ✅ Function existence validation
- ✅ API compatibility testing
- ✅ Detailed test results

### 3. 💻 Node.js Console Testing

**File:** `src/test-database-module-browser.js`

**How to run:**
```bash
node src/test-database-module-browser.js
```

**Features:**
- ✅ Fast execution
- ✅ Function existence checks
- ✅ Module loading validation
- ✅ Detailed test output

### 4. 🔧 Interactive Node.js Testing

**File:** `src/test-database-operations-interactive.js`

**How to run:**
```bash
node src/test-database-operations-interactive.js
```

**Features:**
- ✅ Individual operation testing
- ✅ Mock data testing
- ✅ Error handling validation
- ✅ Promise-based testing

### 5. ⚡ Electron Application Testing (Most Realistic)

**File:** `src/test-database-operations-electron.js`

**How to use:**
1. Include this file in your Electron renderer process
2. Call test functions from the browser console
3. Test with real database access

**Features:**
- ✅ Real database operations
- ✅ Actual Electron API testing
- ✅ Real error handling
- ✅ Production-like environment

## Quick Start Testing

### Option 1: Simple Browser Test (Fastest)
```bash
open src/test-database-operations-simple.html
```

### Option 2: Comprehensive Browser Test
```bash
open src/test-database-module-page.html
```

### Option 3: Node.js Console Test
```bash
node src/test-database-module-browser.js
```

## Testing in the Actual Application

To test the database operations in the real Electron application:

### 1. Add Test Script to Renderer
Add this to your renderer process:

```javascript
// Load the database module
const databaseModule = require('./renderer/modules/database');

// Test functions available globally
window.testDatabaseOperations = () => {
  console.log('🧪 Testing Database Operations...');
  
  // Test category operations
  databaseModule.addNewCategory('Test Category')
    .then(result => console.log('✅ Category added:', result))
    .catch(error => console.log('❌ Error:', error));
    
  // Test song operations
  const songData = {
    title: 'Test Song',
    artist: 'Test Artist',
    category: 'ROCK',
    info: 'Test song',
    filename: 'test.mp3',
    duration: '03:30'
  };
  
  databaseModule.saveNewSong(songData)
    .then(result => console.log('✅ Song saved:', result))
    .catch(error => console.log('❌ Error:', error));
};
```

### 2. Run Tests in Browser Console
1. Start your Electron application
2. Open Developer Tools (F12)
3. In the console, run:
```javascript
testDatabaseOperations();
```

## Test Categories

### 📂 Category Operations
- `addNewCategory(description)` - Creates new categories
- `editCategory(code, description)` - Updates category descriptions
- `deleteCategory(code, description)` - Deletes categories

### 🎵 Song Operations
- `saveNewSong(songData)` - Creates new song records
- `getSongById(songId)` - Retrieves song information
- `saveEditedSong(songData)` - Updates existing songs
- `deleteSong(songId)` - Removes songs from database

### 🔍 Query Operations
- `executeQuery(sql, params)` - Executes custom SQL queries
- `executeStatement(sql, params)` - Executes SQL statements

### 📊 Data Population
- `populateCategorySelect()` - Populates category dropdowns
- `populateHotkeys(hotkeys, title)` - Populates hotkey UI
- `populateHoldingTank(songIds)` - Populates holding tank

### 💾 Store Operations
- `saveHoldingTankToStore()` - Saves holding tank to store
- `saveHotkeysToStore()` - Saves hotkeys to store

### 🎨 UI Operations
- `scaleScrollable()` - Scales scrollable elements

## Expected Test Results

### ✅ Successful Tests
- All functions should exist and be callable
- Promise-based operations should resolve successfully
- Mock operations should return expected results
- Error handling should work correctly

### ❌ Common Issues
- **"window is not defined"** - Running Node.js tests in browser environment
- **"$ is not defined"** - jQuery not available in Node.js
- **"path is not defined"** - Node.js path module not available in browser
- **Database connection errors** - Real database not available in test environment

## Testing Best Practices

### 1. Start with Browser Tests
- Use `test-database-operations-simple.html` for quick validation
- Verify all functions exist and are callable
- Check that Promise-based operations work

### 2. Test in Node.js Environment
- Use `test-database-module-browser.js` for comprehensive testing
- Validate module loading and function availability
- Check for any import/export issues

### 3. Test in Electron Environment
- Use the actual application for real database testing
- Test with real data and error conditions
- Validate API compatibility

### 4. Test Error Handling
- Try operations with invalid data
- Test database connection failures
- Verify error messages are helpful

## Debugging Tips

### Console Output
All tests provide detailed console output:
- ✅ Success indicators
- ❌ Error indicators
- 📊 Detailed result data
- 🔍 Function call tracking

### Common Debugging Commands
```javascript
// Check if module is loaded
console.log(typeof databaseModule);

// Check if specific function exists
console.log(typeof databaseModule.addNewCategory);

// Test function call
databaseModule.addNewCategory('Test').then(console.log).catch(console.error);
```

### Environment-Specific Issues

#### Browser Environment
- Mock implementations are used
- No real database access
- Safe for testing function signatures

#### Node.js Environment
- Limited DOM access
- No jQuery available
- Good for testing core logic

#### Electron Environment
- Full access to all APIs
- Real database operations
- Production-like testing

## Next Steps

After testing:

1. **Integration Testing** - Test the module in the actual application
2. **Performance Testing** - Test with large datasets
3. **Error Testing** - Test with invalid data and edge cases
4. **UI Integration** - Connect to actual UI components
5. **Documentation Updates** - Update docs based on test results

## Support

If you encounter issues:

1. Check the console output for error messages
2. Verify the module is loaded correctly
3. Test in the appropriate environment
4. Check the function signatures match expectations
5. Review the error handling implementation

The database operations are now ready for testing and integration into your MxVoice application! 