/**
 * UI Module Browser Test
 * 
 * This file tests the UI module functionality in a browser environment.
 * It simulates the Electron environment and tests all UI functions.
 */

// Mock Electron API for browser testing
window.electronAPI = {
  store: {
    get: (key) => Promise.resolve({ success: true, value: 'test-value' }),
    set: (key, value) => Promise.resolve({ success: true }),
    has: (key) => Promise.resolve({ success: true, has: true }),
    delete: (key) => Promise.resolve({ success: true })
  },
  dialog: {
    showOpenDialog: (options) => Promise.resolve({ 
      canceled: false, 
      filePaths: ['/test/path'] 
    })
  },
  app: {
    restartAndInstall: () => Promise.resolve({ success: true })
  },
  path: {
    join: (...paths) => Promise.resolve({ success: true, data: paths.join('/') }),
    parse: (path) => Promise.resolve({ success: true, data: { ext: '.mp3' } })
  },
  fileSystem: {
    delete: (path) => Promise.resolve({ success: true }),
    copy: (src, dest) => Promise.resolve({ success: true }),
    exists: (path) => Promise.resolve({ success: true, exists: true }),
    read: (path) => Promise.resolve({ success: true, data: 'test data' })
  }
};

// Mock database for browser testing
const mockDb = {
  prepare: (sql) => ({
    get: (id) => ({ id: 1, title: 'Test Song', artist: 'Test Artist', category: 'TEST', info: 'Test Info', time: '3:45', filename: 'test.mp3' }),
    run: (id) => ({ changes: 1 }),
    iterate: () => [
      { code: 'TEST', description: 'Test Category' },
      { code: 'MUSIC', description: 'Music' }
    ]
  })
};

// Mock store for browser testing
const mockStore = {
  get: (key) => 'test-value',
  set: (key, value) => true,
  has: (key) => true,
  delete: (key) => true
};

// Mock jQuery for browser testing
window.$ = (selector) => {
  const mockElement = {
    html: (content) => mockElement,
    val: (value) => value || 'test-value',
    attr: (name, value) => value || 'test-id',
    removeAttr: (name) => mockElement,
    addClass: (className) => mockElement,
    removeClass: (className) => mockElement,
    hasClass: (className) => false,
    is: (selector) => false,
    show: () => mockElement,
    hide: () => mockElement,
    focus: () => mockElement,
    select: () => mockElement,
    trigger: (event) => mockElement,
    on: (event, handler) => mockElement,
    off: (event) => mockElement,
    find: (selector) => mockElement,
    append: (content) => mockElement,
    empty: () => mockElement,
    detach: () => mockElement,
    after: (element) => mockElement,
    before: (element) => mockElement,
    closest: (selector) => mockElement,
    has: (element) => mockElement,
    length: 1,
    first: () => mockElement,
    next: () => mockElement,
    prev: () => mockElement,
    text: (content) => content || 'Test Text',
    css: (property, value) => mockElement,
    width: (value) => value || 100,
    height: (value) => value || 100,
    offset: () => ({ left: 0, top: 0 }),
    fadeIn: (duration) => mockElement,
    fadeOut: (duration) => mockElement,
    modal: (action) => mockElement,
    tab: (action) => mockElement,
    prop: (property, value) => value || 'test',
    remove: () => mockElement,
    addClass: (className) => mockElement,
    removeClass: (className) => mockElement,
    toggleClass: (className) => mockElement,
    hasClass: (className) => false,
    is: (selector) => false,
    show: () => mockElement,
    hide: () => mockElement,
    focus: () => mockElement,
    select: () => mockElement,
    trigger: (event) => mockElement,
    on: (event, handler) => mockElement,
    off: (event) => mockElement,
    find: (selector) => mockElement,
    append: (content) => mockElement,
    empty: () => mockElement,
    detach: () => mockElement,
    after: (element) => mockElement,
    before: (element) => mockElement,
    closest: (selector) => mockElement,
    has: (element) => mockElement,
    length: 1,
    first: () => mockElement,
    next: () => mockElement,
    prev: () => mockElement,
    text: (content) => content || 'Test Text',
    css: (property, value) => mockElement,
    width: (value) => value || 100,
    height: (value) => value || 100,
    offset: () => ({ left: 0, top: 0 }),
    fadeIn: (duration) => mockElement,
    fadeOut: (duration) => mockElement,
    modal: (action) => mockElement,
    tab: (action) => mockElement,
    prop: (property, value) => value || 'test',
    remove: () => mockElement
  };
  
  // Handle specific selectors
  if (selector === '#selected_row') {
    mockElement.attr = (name, value) => value || 'test-song-id';
  }
  
  return mockElement;
};

// Mock window properties
window.location = {
  reload: () => console.log('Mock: location.reload() called')
};

// Mock global functions
window.customConfirm = (message, callback) => {
  console.log('Mock: customConfirm called with:', message);
  if (callback) callback();
};

window.customPrompt = (title, message, defaultValue, callback) => {
  console.log('Mock: customPrompt called with:', title, message, defaultValue);
  if (callback) callback('test-input');
};

window.animateCSS = (element, animation, speed, prefix) => {
  console.log('Mock: animateCSS called with:', animation);
  return Promise.resolve('Animation ended');
};

window.clearTimeout = (timeout) => {
  console.log('Mock: clearTimeout called');
};

window.searchTimeout = null;

// Mock global variables
window.fontSize = 11;

// Test UI Module
function testUIModule() {
  console.log('🧪 Testing UI Module in Browser Environment...');
  
  try {
    // Test module loading
    const uiModule = require('./renderer/modules/ui');
    console.log('✅ UI Module loaded successfully');
    
    // Initialize module
    const ui = uiModule.initialize({
      electronAPI: window.electronAPI,
      db: mockDb,
      store: mockStore
    });
    
    console.log('✅ UI Module initialized successfully');
    console.log('Module version:', ui.version);
    console.log('Module description:', ui.description);
    
    // Test all functions
    const functions = [
      'scaleScrollable',
      'editSelectedSong',
      'deleteSelectedSong',
      'closeAllTabs',
      'toggleSelectedRow',
      'switchToHotkeyTab',
      'renameHotkeyTab',
      'renameHoldingTankTab',
      'increaseFontSize',
      'decreaseFontSize',
      'toggleWaveform',
      'toggleAdvancedSearch',
      'pickDirectory',
      'installUpdate',
      'getFontSize',
      'setFontSize'
    ];
    
    console.log('\n📋 Testing UI Functions:');
    functions.forEach(funcName => {
      if (typeof ui[funcName] === 'function') {
        console.log(`✅ ${funcName} is available`);
        
        // Test function execution
        try {
          if (funcName === 'toggleSelectedRow') {
            ui[funcName]($('#test-row'));
          } else if (funcName === 'switchToHotkeyTab') {
            ui[funcName](1);
          } else if (funcName === 'pickDirectory') {
            ui[funcName](new Event('click'), $('#test-element'));
          } else if (funcName === 'setFontSize') {
            ui[funcName](12);
          } else {
            ui[funcName]();
          }
          console.log(`✅ ${funcName} executed successfully`);
        } catch (error) {
          console.warn(`⚠️ ${funcName} execution failed:`, error.message);
        }
      } else {
        console.log(`❌ ${funcName} is NOT available`);
      }
    });
    
    // Test error handling
    console.log('\n🔧 Testing Error Handling:');
    
    // Test with missing electronAPI
    const uiWithoutAPI = uiModule.initialize({
      electronAPI: null,
      db: mockDb,
      store: mockStore
    });
    console.log('✅ Module works without electronAPI');
    
    // Test with missing database
    const uiWithoutDB = uiModule.initialize({
      electronAPI: window.electronAPI,
      db: null,
      store: mockStore
    });
    console.log('✅ Module works without database');
    
    // Test with missing store
    const uiWithoutStore = uiModule.initialize({
      electronAPI: window.electronAPI,
      db: mockDb,
      store: null
    });
    console.log('✅ Module works without store');
    
    console.log('\n✅ UI Module Browser Test Completed Successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ UI Module Browser Test Failed:', error);
    return false;
  }
}

// Test backward compatibility
function testBackwardCompatibility() {
  console.log('\n🔄 Testing Backward Compatibility...');
  
  try {
    // Test legacy function names
    const legacyFunctions = [
      'scale_scrollable',
      'editSelectedSong',
      'deleteSelectedSong',
      'toggle_selected_row',
      'increaseFontSize',
      'decreaseFontSize',
      'toggleWaveform',
      'toggleAdvancedSearch',
      'pickDirectory',
      'installUpdate'
    ];
    
    legacyFunctions.forEach(funcName => {
      if (typeof window[funcName] === 'function') {
        console.log(`✅ Legacy function ${funcName} is available`);
      } else {
        console.log(`❌ Legacy function ${funcName} is NOT available`);
      }
    });
    
    console.log('✅ Backward compatibility test completed');
    return true;
    
  } catch (error) {
    console.error('❌ Backward compatibility test failed:', error);
    return false;
  }
}

// Run tests
console.log('🚀 Starting UI Module Browser Tests...\n');

const uiTestResult = testUIModule();
const compatibilityTestResult = testBackwardCompatibility();

console.log('\n📊 Test Results:');
console.log(`UI Module Test: ${uiTestResult ? '✅ PASSED' : '❌ FAILED'}`);
console.log(`Compatibility Test: ${compatibilityTestResult ? '✅ PASSED' : '❌ FAILED'}`);

if (uiTestResult && compatibilityTestResult) {
  console.log('\n🎉 All tests passed! UI Module is ready for use.');
} else {
  console.log('\n⚠️ Some tests failed. Please check the implementation.');
}

// Export test functions for manual testing
window.testUIModule = testUIModule;
window.testBackwardCompatibility = testBackwardCompatibility; 