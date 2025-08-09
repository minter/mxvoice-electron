# Test Functions Module

## Overview

The Test Functions Module contains all testing utilities for the MxVoice application. These functions are used for testing various APIs and features during development and migration phases.

## Functions

### `testPhase2Migrations()`
Tests if new APIs are available and working for Phase 2 migrations.

**Returns:** `Object` - Result of the test

### `testDatabaseAPI()`
Tests database functionality and queries for gradual migration.

**Returns:** `Promise<Object>` - Result of the test with detailed test results

### `testFileSystemAPI()`
Tests file system operations for gradual migration.

**Returns:** `Promise<Object>` - Result of the test with detailed test results

### `testStoreAPI()`
Tests store operations (get, set, has, delete) for gradual migration.

**Returns:** `Promise<Object>` - Result of the test with detailed test results

### `testAudioAPI()`
Tests audio functionality (play, pause, stop, volume) for gradual migration.

**Returns:** `Promise<Object>` - Result of the test with detailed test results

### `testSecurityFeatures()`
Tests that security features are working correctly (Week 5).

**Returns:** `Promise<Object>` - Result of the test with detailed test results

### `runAllTests()`
Executes all test functions and returns comprehensive results.

**Returns:** `Promise<Object>` - Comprehensive test results with summary

## Usage

```javascript
import testUtils from './modules/test-utils/index.js';

// Run individual tests
const phase2Result = await testUtils.testPhase2Migrations();
const dbResult = await testUtils.testDatabaseAPI();

// Run all tests
const allResults = await testUtils.runAllTests();
console.log(`Tests: ${allResults.passed} passed, ${allResults.failed} failed`);
```

## Test Categories

### Phase 2 Migrations
- Tests availability of new electronAPI
- Tests migrated functions (openHotkeyFile, openHoldingTankFile, etc.)

### Database API
- Tests getCategories functionality
- Tests database query operations
- Validates database connectivity

### File System API
- Tests file existence checks
- Tests file read operations
- Tests path joining functionality

### Store API
- Tests store get/set operations
- Tests store has/delete operations
- Validates persistent storage functionality

### Audio API
- Tests audio volume control
- Tests audio play/pause/stop operations
- Validates audio file handling

### Security Features
- Tests contextBridge API availability
- Tests Node.js access blocking
- Validates security implementation

## Dependencies

- `window.electronAPI` for API testing
- Various Electron APIs (database, fileSystem, store, audio)
- Console logging for test output

## Integration

This module is integrated with the main renderer.js file and provides comprehensive testing capabilities for the application's various APIs and features. 