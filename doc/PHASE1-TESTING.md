# Phase 1 Testing Guide

## Quick Start Testing

### Step 1: Start the App
```bash
yarn start
```

### Step 2: Open Developer Tools
- **Mac**: Press `Cmd + Option + I`
- **Windows**: Press `Ctrl + Shift + I`

### Step 3: Load Test Script
Copy and paste the entire contents of `test-phase1.js` into the console, then press Enter.

### Step 4: Run Tests
In the console, run:
```javascript
window.testPhase1.runAllTests()
```

## Expected Results

### ✅ Success Indicators
- All tests show ✅ (green checkmarks)
- Both old and new APIs are available
- Database and store functionality works
- Existing app functions are available
- DOM elements exist

### ❌ Failure Indicators
- Any test shows ❌ (red X)
- Missing APIs or functions
- Database/store errors
- Missing DOM elements

## Manual Testing Steps

### 1. Test Old API Still Works
```javascript
// Test old hotkey file opening
openHotkeyFile()

// Test old hotkey file saving
saveHotkeyFile()

// Test old holding tank operations
openHoldingTankFile()
saveHoldingTankFile()
```

### 2. Test New API Works
```javascript
// Test new API calls
window.electronAPI.getAppPath().then(result => {
  console.log('App path:', result)
})

// Test UI operations
window.electronAPI.increaseFontSize()
window.electronAPI.decreaseFontSize()
window.electronAPI.toggleWaveform()
```

### 3. Test Database Access
```javascript
// Test database query
const stmt = db.prepare("SELECT COUNT(*) as count FROM categories")
const result = stmt.get()
console.log('Categories count:', result)

// Test store access
const width = store.get('browser_width')
console.log('Browser width:', width)
```

### 4. Test App Functionality
```javascript
// Test search functionality
searchData()

// Test category population
populateCategorySelect()

// Test existing functions
console.log('Available functions:', Object.keys(window).filter(key => typeof window[key] === 'function'))
```

## Troubleshooting

### If New API is Not Available
- Check that `global.electronAPI` is set in preload.js
- Verify the preload script is loading correctly
- Check for JavaScript errors in console

### If Old API is Not Available
- Check that `global.ipcRenderer` is set in preload.js
- Verify all existing globals are exposed
- Check for JavaScript errors in console

### If Database/Store Not Working
- Check that `global.db` and `global.store` are set
- Verify database file exists and is accessible
- Check for file permission issues

### If App Functions Missing
- Check that renderer.js is loading correctly
- Verify all required functions are defined
- Check for JavaScript errors in console

## Next Steps After Testing

### If All Tests Pass ✅
- Phase 1 is complete and working correctly
- You can proceed to Phase 2 (function migration)
- Both old and new APIs are available for use

### If Any Tests Fail ❌
- Identify which specific functionality is broken
- Check the console for error messages
- Review the preload.js and index.js files
- Fix issues before proceeding to Phase 2

## Phase 1 Success Criteria

- [ ] App starts without errors
- [ ] Both old and new APIs are available
- [ ] Database and store functionality works
- [ ] Existing app functions are available
- [ ] DOM elements exist and are accessible
- [ ] No regressions in existing functionality
- [ ] New APIs return promises and work as expected

Once all criteria are met, Phase 1 is complete and you can safely proceed to Phase 2! 