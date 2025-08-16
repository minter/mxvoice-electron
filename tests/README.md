# Testing Framework for Mx. Voice

This directory contains the comprehensive testing framework for the Mx. Voice Electron application using Playwright.

## Overview

The testing framework provides:
- **Idempotent tests** that can be run multiple times with the same results
- **Isolated test environment** with separate database, store, and file systems
- **Comprehensive UI testing** for all user interactions
- **Test data management** with consistent, known test data sets

## Directory Structure

```
tests/
├── config/                 # Test configuration and environment settings
├── e2e/                   # End-to-end test specifications
├── fixtures/              # Test data, songs, and configuration files
├── setup/                 # Global setup and teardown scripts
├── utils/                 # Test utility classes and helpers
└── README.md             # This file
```

## Key Components

### Test Environment Setup (`setup/test-environment-setup.js`)
- Coordinates all test managers
- Provides unified interface for test data access
- Handles setup, reset, and cleanup operations

### Test Database Manager (`utils/test-database-manager.js`)
- Creates in-memory SQLite databases for testing
- Populates with consistent test data
- Provides database query and management utilities

### Test Store Manager (`utils/test-store-manager.js`)
- Manages isolated configuration stores
- Sets test-specific application settings
- Ensures test configuration isolation

### Test Song Manager (`utils/test-song-manager.js`)
- Creates test audio files for testing
- Manages test song metadata and file operations
- Provides utilities for song-related test scenarios

## Test Data

The framework includes predefined test data:

### Categories
- TEST_JAZZ, TEST_ROCK, TEST_CLASSICAL, TEST_BLUES, TEST_ELECTRONIC

### Songs
- 5 test songs with realistic metadata
- Generated test MP3 files (minimal, fast-loading)

### Configuration
- Test-specific app settings
- Isolated database and file paths
- Disabled auto-updates and dev tools for testing

## Running Tests

### ⚠️ Important: Electron App Testing

**Electron apps work differently from web apps for testing.** You must start your app manually before running tests.

### Correct Testing Workflow

1. **Start your app manually** (in one terminal):
   ```bash
   yarn start
   # Wait for the Mx. Voice app to fully load
   ```

2. **Run tests against the running app** (in another terminal):
   ```bash
   yarn test
   ```

### Basic Test Commands
```bash
# Run all tests (app must be running first)
yarn test

# Run tests with UI mode (interactive)
yarn test:ui

# Run tests in headed mode (see browser)
yarn test:headed

# Run tests in debug mode
yarn test:debug

# Show test report
yarn test:report
```

### Test Environment Management
```bash
# Install Playwright browsers
yarn test:install

# Validate test environment setup
yarn test:validate

# Run specific test file (app must be running first)
yarn playwright test tests/e2e/holding-tank-basic.spec.js

# Run tests for specific browser
yarn playwright test --project=chromium
```

## Writing Tests

### Basic Test Structure
```javascript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  let testEnv;

  test.beforeEach(async ({ page }) => {
    // Access test environment
    testEnv = global.testEnvironment;
    
    // Reset to known state
    await testEnv.reset();
    
    // Navigate to app
    await page.goto('/');
  });

  test('should do something', async ({ page }) => {
    // Test implementation
    await expect(page.locator('#element')).toBeVisible();
  });
});
```

### Test Environment Access
```javascript
// Access test database
const db = testEnv.getTestDatabase();

// Access test store
const store = testEnv.getTestStore();

// Access test song paths
const songPaths = testEnv.getTestSongPaths();

// Add custom test data
await testEnv.addTestSongToDatabase({
  title: 'Custom Song',
  artist: 'Custom Artist',
  category: 'TEST_CUSTOM',
  filename: 'custom-song.mp3',
  time: '3:00',
  info: 'Custom test song'
});
```

### Database Operations
```javascript
// Query test database
const songs = await testEnv.dbManager.query(
  'SELECT * FROM mrvoice WHERE category = ?', 
  ['TEST_JAZZ']
);

// Get database statistics
const stats = await testEnv.getDatabaseStats();
console.log(`Database has ${stats.songs} songs`);
```

## Test Isolation

Each test runs with:
- **Fresh database state** - reset to known test data
- **Isolated configuration** - test-specific app settings
- **Clean file system** - separate test directories
- **Independent state** - no interference between tests

## Best Practices

1. **Always reset state** in `beforeEach` using `testEnv.reset()`
2. **Use test environment utilities** instead of direct database/store access
3. **Keep tests independent** - don't rely on state from other tests
4. **Use descriptive test names** that explain the expected behavior
5. **Handle async operations properly** with proper awaits and timeouts
6. **Clean up resources** in test teardown if needed

## Debugging Tests

### UI Mode
```bash
yarn test:ui
```
Interactive test runner with step-by-step execution and debugging tools.

### Debug Mode
```bash
yarn test:debug
```
Runs tests with debugging enabled, allowing breakpoint inspection.

### Console Logging
Tests include comprehensive logging:
- ✅ Success operations
- ❌ Error conditions
- 📊 Data statistics
- 🔄 State changes

### Screenshots and Videos
- Screenshots on test failure
- Video recording on test failure
- Trace files for debugging

## CI/CD Integration

The framework is designed for CI/CD environments:
- **Environment detection** via `process.env.CI`
- **Reduced retries** in CI (2 vs unlimited in development)
- **Single worker** in CI for stability
- **Automatic cleanup** in global teardown

## Troubleshooting

### Common Issues

1. **Tests hang or don't start**
   - **Make sure your app is running** with `yarn start` before running tests
   - Electron apps don't work with Playwright's webServer configuration
   - Tests must connect to an already-running application

2. **Test environment not initialized**
   - Check global setup is running
   - Verify Playwright configuration

3. **Database connection failures**
   - Ensure SQLite runtime is initialized
   - Check test database path configuration

4. **File system errors**
   - Verify test directories exist
   - Check file permissions

5. **UI element not found**
   - Increase timeout values (use 30+ seconds for app loading)
   - Check element selectors
   - Verify app is fully loaded and visible
   - Use `--headed` flag to see what's happening during tests

### Debug Commands
```bash
# Validate test environment
yarn playwright test --grep "should have test data loaded"

# Run with verbose logging
DEBUG=pw:api yarn test

# Check test environment setup
node tests/setup/test-environment-setup.js
```

## Electron App Testing

### How It Works
- **No automatic app startup**: You must start your app with `yarn start` before running tests
- **Element waiting**: Tests wait for UI elements instead of navigating to URLs
- **Direct interaction**: Playwright connects to your running app and interacts with the UI
- **State management**: Tests verify app behavior and state changes

### Writing Tests for Electron Apps
```javascript
test('should handle user interaction', async ({ page }) => {
  // Wait for app to be ready (no page.goto needed)
  await page.waitForSelector('#holding_tank', { timeout: 30000 });
  
  // Interact with the app
  await page.click('#playlist_mode_btn');
  
  // Verify the interaction worked
  await expect(page.locator('#playlist_mode_btn')).toHaveClass(/active/);
});
```

### Testing Workflow
1. **Start app**: `yarn start` (in one terminal)
2. **Run tests**: `yarn test` (in another terminal)
3. **Watch tests**: Use `--headed` flag to see browser interactions
4. **Debug tests**: Use `--ui` flag for interactive debugging

## Contributing

When adding new tests:
1. Follow the existing test structure
2. Use the test environment utilities
3. Ensure tests are idempotent
4. Add appropriate error handling
5. Update this README if adding new features
6. **Remember**: Tests wait for elements, don't use `page.goto()`
