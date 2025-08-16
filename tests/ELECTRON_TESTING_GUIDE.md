# Testing Electron Apps with Playwright

## 🚀 **Modern Electron App Testing with Playwright**

**Playwright has first-class Electron support!** Tests automatically launch your Electron app and test the real UI.

## ✅ **Correct Testing Workflow (NEW!)**

### **Tests Launch Your App Automatically**
```bash
# Just run tests - no need to start the app manually!
yarn test                    # All tests
yarn test:smoke             # Just smoke tests
yarn test:ui                # Interactive test runner
yarn test:headed            # See browser during tests
```

## 🔧 **How It Works Now**

- ✅ **Tests launch the Electron app** automatically using `_electron.launch()`
- ✅ **No manual app startup** required
- ✅ **Real app testing** with actual UI interactions
- ✅ **Automatic cleanup** when tests complete

## 📋 **Updated Test Commands**

```bash
# 🆕 NEW: Tests launch the app automatically
yarn test                    # Run all tests
yarn test:smoke             # Run smoke tests
yarn test:ui                # Interactive test runner
yarn playwright test --headed  # See browser during tests
yarn playwright test --debug   # Debug mode

# 🆕 NEW: No need to run 'yarn start' first!
```

## 🎯 **Test Configuration (UPDATED!)**

### **Current (Electron App Style - ✅ Correct)**
```javascript
// Playwright automatically launches your Electron app
import { _electron as electron, test, expect } from '@playwright/test';

test.beforeAll(async () => {
  app = await electron.launch({
    args: ['.'],
    env: { NODE_ENV: 'test', APP_TEST_MODE: '1' }
  });
  page = await app.firstWindow();
});
```

### **Old Approach (❌ No longer used)**
```javascript
// This was the old manual approach
// webServer: { command: 'yarn start' }
// await page.waitForSelector('#holding_tank', { timeout: 30000 });
```

## 🔍 **How Tests Now Work**

1. **🆕 Automatic App Launch**: Playwright launches your Electron app
2. **🆕 Real App Testing**: Tests interact with the actual application
3. **🆕 Automatic Cleanup**: App closes automatically when tests complete
4. **✅ UI Interaction**: Tests click buttons, verify elements, test functionality
5. **✅ Validation**: Tests verify expected behavior and state

## 🚀 **Quick Start Guide (UPDATED!)**

### **Step 1: Install Playwright**
```bash
yarn test:install
```

### **Step 2: Run Tests**
```bash
# Tests launch your app automatically!
yarn test:smoke
```

### **Step 3: Watch Tests Run**
- Tests automatically open your Mx. Voice app
- You'll see Playwright interacting with your app
- App closes automatically when tests complete

## 🧪 **Test Development Workflow (UPDATED!)**

### **1. Development Cycle**
```bash
# 🆕 NEW: No need to keep app running!
yarn test:smoke             # Run smoke tests
yarn test:ui                # Interactive mode
yarn test:headed            # See browser during tests
```

### **2. Writing Tests**
```javascript
import { _electron as electron, test, expect } from '@playwright/test';

test.describe('Feature Tests', () => {
  let app, page;

  test.beforeAll(async () => {
    // 🆕 NEW: App launches automatically
    app = await electron.launch({ args: ['.'] });
    page = await app.firstWindow();
  });

  test.afterAll(async () => {
    // 🆕 NEW: App closes automatically
    await app.close();
  });

  test('should work', async () => {
    // Test your app's UI
    await expect(page.locator('button')).toBeVisible();
  });
});
```

## 🎉 **Benefits of New Approach**

- ✅ **Simpler workflow** - No manual app startup
- ✅ **More reliable** - Tests control app lifecycle
- ✅ **Faster development** - No waiting for app to load
- ✅ **Better isolation** - Each test gets fresh app instance
- ✅ **CI/CD ready** - Works in automated environments

## 🚨 **Important Notes**

- **Tests launch the app** - No need to run `yarn start`
- **App closes automatically** - After each test suite
- **Real app testing** - Tests interact with actual UI
- **Fast execution** - No waiting for app startup

## 📚 **Resources**

- **Playwright Electron Docs**: [Playwright Electron Testing](https://playwright.dev/docs/api/class-electron)
- **Testing Best Practices**: [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- **CI Integration**: [Playwright CI](https://playwright.dev/docs/ci)

Your Electron app testing is now modern, simple, and powerful! 🚀
