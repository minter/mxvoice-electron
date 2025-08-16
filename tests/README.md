# Mx. Voice Testing Framework

This directory contains the testing framework for the Mx. Voice Electron application using **Playwright with first-class Electron support**.

## 🚀 **Quick Start**

### **1. Install Playwright Browsers**
```bash
yarn test:install
```

### **2. Run Tests**
```bash
# Run all tests
yarn test

# Run just smoke tests
yarn test:smoke

# Run with UI for debugging
yarn test:ui

# Run with visual output
yarn test:headed
```

### **3. View Results**
```bash
yarn test:report
```

## 🎯 **What We're Testing**

### **Electron App Features**
- ✅ **App Launch & Window Management** - App starts correctly and shows main window
- ✅ **UI Elements** - Holding tank, mode switching, tab navigation
- ✅ **Responsive Design** - Different viewport sizes
- ✅ **User Interactions** - Button clicks, mode changes, tab switching

### **Test Structure**
- **`smoke.spec.js`** - Core app functionality and UI interactions
- **Isolated Environment** - Each test runs with clean state
- **Real App Testing** - Tests launch the actual Electron app

## 🔧 **How It Works**

### **Playwright + Electron Integration**
```javascript
import { _electron as electron, test, expect } from '@playwright/test';

test.beforeAll(async () => {
  // Launch the actual Electron app
  app = await electron.launch({
    args: ['.'],
    env: { NODE_ENV: 'test', APP_TEST_MODE: '1' }
  });
  page = await app.firstWindow();
});
```

### **Key Benefits**
- **No Manual App Startup** - Tests launch the app automatically
- **Real App Testing** - Tests interact with the actual application
- **Fast & Reliable** - Playwright's optimized Electron support
- **Easy Debugging** - Built-in UI mode and debugging tools

## 📁 **File Structure**

```
tests/
├── e2e/
│   └── smoke.spec.js          # Main Electron app tests
├── setup/                     # Test environment setup
├── utils/                     # Test utilities
├── fixtures/                  # Test data and files
└── README.md                  # This file
```

## 🧪 **Running Tests**

### **Basic Test Run**
```bash
yarn test
```

### **Debug Mode**
```bash
# Interactive UI mode
yarn test:ui

# Visual mode (see browser)
yarn test:headed

# Debug mode (step through)
yarn test:debug
```

### **Specific Tests**
```bash
# Run just smoke tests
yarn test:smoke

# Run specific test file
yarn playwright test tests/e2e/smoke.spec.js
```

## 🔍 **Test Development**

### **Adding New Tests**
1. **Create test file** in `tests/e2e/`
2. **Use Electron API** - `_electron as electron`
3. **Launch app** in `beforeAll`
4. **Test UI interactions** with Playwright selectors
5. **Clean up** in `afterAll`

### **Example Test Structure**
```javascript
test.describe('Feature Name', () => {
  let app, page;

  test.beforeAll(async () => {
    app = await electron.launch({ args: ['.'] });
    page = await app.firstWindow();
  });

  test.afterAll(async () => {
    await app.close();
  });

  test('should do something', async () => {
    await expect(page.locator('#element')).toBeVisible();
  });
});
```

## 🚨 **Troubleshooting**

### **Common Issues**
- **App won't launch** - Check `main` field in package.json
- **Tests hang** - Increase timeout in playwright.config.js
- **UI elements not found** - Use `page.waitForSelector()` with proper timeouts

### **Debug Commands**
```bash
# See what's happening
yarn test:headed

# Interactive debugging
yarn test:ui

# Step-by-step debugging
yarn test:debug
```

## 📚 **Resources**

- **Playwright Electron Docs**: [Playwright Electron Testing](https://playwright.dev/docs/api/class-electron)
- **Testing Best Practices**: [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- **CI Integration**: [Playwright CI](https://playwright.dev/docs/ci)

## 🎉 **Success!**

This testing framework provides:
- **Real Electron app testing** with Playwright
- **Fast, reliable test execution**
- **Easy debugging and development**
- **CI/CD ready** configuration

Your Mx. Voice app is now properly testable! 🚀
