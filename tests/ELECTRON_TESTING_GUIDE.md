# Testing Electron Apps with Playwright

## 🚨 Important: How to Test Electron Apps

**Electron apps work differently from web apps for testing.** You cannot use Playwright's `webServer` configuration to automatically start Electron apps.

## ✅ Correct Testing Workflow

### 1. Start Your App Manually
```bash
# In one terminal, start your Mx. Voice app
yarn start
```

### 2. Run Tests Against Running App
```bash
# In another terminal, run your tests
yarn playwright test tests/e2e/holding-tank-basic.spec.js
```

## 🔧 Why This Approach?

- **Electron apps don't serve web content** on localhost like web apps do
- **Playwright needs to connect** to an already-running application
- **The app must be fully loaded** before tests can interact with it
- **Tests wait for UI elements** to appear rather than navigating to URLs

## 📋 Updated Test Commands

```bash
# 1. Start your app (in one terminal)
yarn start

# 2. Run tests (in another terminal)
yarn test                           # All tests
yarn playwright test --headed       # See browser during tests
yarn playwright test --ui           # Interactive test runner
yarn playwright test --debug        # Debug mode

# 3. Run specific tests
yarn playwright test tests/e2e/holding-tank-basic.spec.js
yarn playwright test tests/e2e/ui-interactions.spec.js
```

## 🎯 Test Configuration Changes

### Before (Web App Style - ❌ Wrong for Electron)
```javascript
// This doesn't work for Electron apps
webServer: {
  command: 'yarn start',
  url: 'http://localhost:3000'
}
```

### After (Electron App Style - ✅ Correct)
```javascript
// Remove webServer configuration
// Tests wait for UI elements instead of navigating
await page.waitForSelector('#holding_tank', { timeout: 30000 });
```

## 🔍 How Tests Now Work

1. **App Startup**: You manually start the app with `yarn start`
2. **Test Connection**: Playwright connects to the running app
3. **Element Waiting**: Tests wait for specific UI elements to appear
4. **Interaction**: Tests interact with the app's UI
5. **Validation**: Tests verify expected behavior and state

## 🚀 Quick Start Guide

### Step 1: Start Your App
```bash
# Terminal 1
yarn start
# Wait for the Mx. Voice app to fully load
```

### Step 2: Run a Test
```bash
# Terminal 2
yarn playwright test tests/e2e/holding-tank-basic.spec.js --headed
```

### Step 3: Watch Tests Run
- The `--headed` flag shows the browser window
- You'll see Playwright interacting with your app
- Tests will click buttons, verify elements, etc.

## 🧪 Test Development Workflow

### 1. Development Cycle
```bash
# Terminal 1: Keep app running
yarn start

# Terminal 2: Run tests as you develop
yarn playwright test --headed
yarn playwright test --ui          # Interactive mode
yarn playwright test --debug       # Debug mode
```

### 2. Writing New Tests
```javascript
test('should do something', async ({ page }) => {
  // Wait for app to be ready (no page.goto needed)
  await page.waitForSelector('#my-element', { timeout: 30000 });
  
  // Interact with the app
  await page.click('#my-button');
  
  // Verify results
  await expect(page.locator('#result')).toBeVisible();
});
```

## 🔧 Troubleshooting

### Problem: Tests Hang Waiting for Elements
**Solution**: Increase timeout and ensure app is fully loaded
```javascript
await page.waitForSelector('#holding_tank', { timeout: 30000 });
```

### Problem: App Not Responding to Tests
**Solution**: Make sure app is fully started before running tests
```bash
# Wait for app to be completely loaded
# Look for main UI elements to appear
# Then run tests
```

### Problem: Tests Can't Find Elements
**Solution**: Use the Playwright Inspector to debug selectors
```bash
yarn playwright test --ui
# This opens the interactive test runner
# You can inspect elements and debug selectors
```

## 📱 Testing Different App States

### App Startup Testing
```javascript
test('should load app successfully', async ({ page }) => {
  // Wait for main UI to appear
  await page.waitForSelector('#holding_tank', { timeout: 30000 });
  
  // Verify app loaded without errors
  await expect(page.locator('body')).not.toHaveText(/error/i);
  await expect(page.locator('#holding_tank')).toBeVisible();
});
```

### State Management Testing
```javascript
test('should maintain state across interactions', async ({ page }) => {
  // Wait for app to be ready
  await page.waitForSelector('#holding_tank', { timeout: 30000 });
  
  // Perform actions
  await page.click('#playlist_mode_btn');
  
  // Verify state changes
  await expect(page.locator('#playlist_mode_btn')).toHaveClass(/active/);
});
```

## 🎯 Best Practices for Electron Testing

1. **Always wait for elements** instead of using `page.goto()`
2. **Use generous timeouts** for app loading (30+ seconds)
3. **Test against running app** - don't try to start it automatically
4. **Use `--headed` flag** during development to see what's happening
5. **Use `--ui` flag** for interactive debugging and development
6. **Keep app running** in separate terminal during test development

## 🚀 Next Steps

1. **Start your app**: `yarn start`
2. **Run a simple test**: `yarn playwright test tests/e2e/holding-tank-basic.spec.js --headed`
3. **Explore interactive mode**: `yarn playwright test --ui`
4. **Write your own tests** following the established patterns

Happy testing! 🎵✨
