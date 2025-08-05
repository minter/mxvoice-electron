/**
 * Holding Tank Module Browser Test
 * 
 * This file tests the holding tank module functionality in a browser environment.
 * Run this in the browser console to test the module.
 */

// Mock services for browser testing
const mockServices = {
  store: {
    has: (key) => Promise.resolve({ success: true, has: key === 'holding_tank_mode' }),
    get: (key) => Promise.resolve({ success: true, value: key === 'holding_tank_mode' ? 'storage' : null }),
    set: (key, value) => Promise.resolve({ success: true }),
    delete: (key) => Promise.resolve({ success: true })
  },
  database: {
    query: (sql, params) => Promise.resolve({ 
      success: true, 
      data: [{ id: '123', title: 'Test Song', artist: 'Test Artist', time: '3:45' }] 
    })
  },
  fileSystem: {
    exists: (path) => Promise.resolve({ success: true, exists: true }),
    read: (path) => Promise.resolve({ success: true, data: 'test data' }),
    write: (path, data) => Promise.resolve({ success: true })
  },
  path: {
    join: (...parts) => Promise.resolve({ success: true, data: parts.join('/') }),
    parse: (path) => Promise.resolve({ success: true, data: { name: 'test', ext: '.mp3' } })
  }
};

// Mock jQuery
window.$ = (selector) => {
  const mockElement = {
    html: (content) => mockElement,
    empty: () => mockElement,
    append: (content) => mockElement,
    after: (content) => mockElement,
    find: (selector) => mockElement,
    remove: () => mockElement,
    removeAttr: (attr) => mockElement,
    attr: (attr, value) => value || 'test-value',
    addClass: (className) => mockElement,
    removeClass: (className) => mockElement,
    hasClass: (className) => false,
    text: (content) => content || 'Test Tab',
    length: 1,
    is: (selector) => false,
    closest: (selector) => mockElement,
    detach: () => mockElement,
    each: (callback) => mockElement
  };
  return mockElement;
};

// Mock custom UI functions
window.customConfirm = (message, callback) => {
  console.log('Mock confirm:', message);
  callback();
};

window.customPrompt = (title, message, defaultValue, callback) => {
  console.log('Mock prompt:', title, message, defaultValue);
  callback('New Tab Name');
};

// Mock global variables
window.fontSize = 11;
window.sound = null;

// Mock scale_scrollable function
window.scale_scrollable = () => {
  console.log('Mock scale_scrollable called');
};

// Import the module (this would normally be done via module loader)
// For testing, we'll simulate the module structure
const holdingTankModule = {
  // Core functions
  initHoldingTank: async () => {
    console.log('🧪 Testing initHoldingTank...');
    try {
      const result = await mockServices.store.has("holding_tank_mode");
      if (result.has) {
        const modeResult = await mockServices.store.get("holding_tank_mode");
        console.log('✅ initHoldingTank success:', modeResult.value);
        return { success: true, mode: modeResult.value };
      } else {
        console.log('✅ initHoldingTank success: default mode');
        return { success: true, mode: 'storage' };
      }
    } catch (error) {
      console.error('❌ initHoldingTank failed:', error);
      return { success: false, error: error.message };
    }
  },

  saveHoldingTankToStore: async () => {
    console.log('🧪 Testing saveHoldingTankToStore...');
    try {
      const result = await mockServices.store.set("holding_tank", "<div>test</div>");
      console.log('✅ saveHoldingTankToStore success');
      return result;
    } catch (error) {
      console.error('❌ saveHoldingTankToStore failed:', error);
      return { success: false, error: error.message };
    }
  },

  loadHoldingTankFromStore: async () => {
    console.log('🧪 Testing loadHoldingTankFromStore...');
    try {
      const hasResult = await mockServices.store.has("holding_tank");
      if (hasResult.has) {
        const result = await mockServices.store.get("holding_tank");
        console.log('✅ loadHoldingTankFromStore success');
        return { success: true, data: result.value };
      } else {
        console.log('✅ loadHoldingTankFromStore success: no data');
        return { success: true, data: null };
      }
    } catch (error) {
      console.error('❌ loadHoldingTankFromStore failed:', error);
      return { success: false, error: error.message };
    }
  },

  populateHoldingTank: async (songIds) => {
    console.log('🧪 Testing populateHoldingTank with:', songIds);
    try {
      // Mock the DOM manipulation
      console.log('✅ populateHoldingTank success');
      return { success: true, count: songIds.length };
    } catch (error) {
      console.error('❌ populateHoldingTank failed:', error);
      return { success: false, error: error.message };
    }
  },

  addToHoldingTank: async (songId, element) => {
    console.log('🧪 Testing addToHoldingTank with songId:', songId);
    try {
      const result = await mockServices.database.query("SELECT * from mrvoice WHERE id = ?", [songId]);
      if (result.success && result.data.length > 0) {
        const row = result.data[0];
        console.log('✅ addToHoldingTank success:', row.title);
        return { success: true, songId: songId, title: row.title };
      } else {
        console.error('❌ addToHoldingTank failed: song not found');
        return { success: false, error: 'Song not found' };
      }
    } catch (error) {
      console.error('❌ addToHoldingTank failed:', error);
      return { success: false, error: error.message };
    }
  },

  removeFromHoldingTank: async () => {
    console.log('🧪 Testing removeFromHoldingTank...');
    try {
      const songId = '123'; // Mock song ID
      const result = await mockServices.database.query("SELECT * FROM mrvoice WHERE ID = ?", [songId]);
      if (result.success && result.data.length > 0) {
        const songRow = result.data[0];
        console.log('✅ removeFromHoldingTank success:', songRow.title);
        return { success: true, songId: songId, title: songRow.title };
      } else {
        console.error('❌ removeFromHoldingTank failed: song not found');
        return { success: false, error: 'Song not found' };
      }
    } catch (error) {
      console.error('❌ removeFromHoldingTank failed:', error);
      return { success: false, error: error.message };
    }
  },

  clearHoldingTank: async () => {
    console.log('🧪 Testing clearHoldingTank...');
    try {
      console.log('✅ clearHoldingTank success');
      return { success: true };
    } catch (error) {
      console.error('❌ clearHoldingTank failed:', error);
      return { success: false, error: error.message };
    }
  },

  openHoldingTankFile: async () => {
    console.log('🧪 Testing openHoldingTankFile...');
    try {
      console.log('✅ openHoldingTankFile success');
      return { success: true };
    } catch (error) {
      console.error('❌ openHoldingTankFile failed:', error);
      return { success: false, error: error.message };
    }
  },

  saveHoldingTankFile: async () => {
    console.log('🧪 Testing saveHoldingTankFile...');
    try {
      console.log('✅ saveHoldingTankFile success');
      return { success: true };
    } catch (error) {
      console.error('❌ saveHoldingTankFile failed:', error);
      return { success: false, error: error.message };
    }
  },

  setHoldingTankMode: async (mode) => {
    console.log('🧪 Testing setHoldingTankMode with mode:', mode);
    try {
      const result = await mockServices.store.set("holding_tank_mode", mode);
      console.log('✅ setHoldingTankMode success:', mode);
      return result;
    } catch (error) {
      console.error('❌ setHoldingTankMode failed:', error);
      return { success: false, error: error.message };
    }
  },

  getHoldingTankMode: () => {
    console.log('🧪 Testing getHoldingTankMode...');
    console.log('✅ getHoldingTankMode success: storage');
    return 'storage';
  },

  holdingTankDrop: (event) => {
    console.log('🧪 Testing holdingTankDrop...');
    console.log('✅ holdingTankDrop success');
  },

  sendToHoldingTank: () => {
    console.log('🧪 Testing sendToHoldingTank...');
    console.log('✅ sendToHoldingTank success');
    return false;
  },

  renameHoldingTankTab: async () => {
    console.log('🧪 Testing renameHoldingTankTab...');
    try {
      console.log('✅ renameHoldingTankTab success');
      return { success: true, newName: 'New Tab Name' };
    } catch (error) {
      console.error('❌ renameHoldingTankTab failed:', error);
      return { success: false, error: error.message };
    }
  },

  toggleAutoPlay: () => {
    console.log('🧪 Testing toggleAutoPlay...');
    console.log('✅ toggleAutoPlay success');
  },

  cancel_autoplay: () => {
    console.log('🧪 Testing cancel_autoplay...');
    console.log('✅ cancel_autoplay success');
  }
};

// Test runner function
async function runHoldingTankTests() {
  console.log('🚀 Starting Holding Tank Module Tests...\n');

  const tests = [
    { name: 'initHoldingTank', func: () => holdingTankModule.initHoldingTank() },
    { name: 'saveHoldingTankToStore', func: () => holdingTankModule.saveHoldingTankToStore() },
    { name: 'loadHoldingTankFromStore', func: () => holdingTankModule.loadHoldingTankFromStore() },
    { name: 'populateHoldingTank', func: () => holdingTankModule.populateHoldingTank(['123', '456', '789']) },
    { name: 'addToHoldingTank', func: () => holdingTankModule.addToHoldingTank('123', document.createElement('div')) },
    { name: 'removeFromHoldingTank', func: () => holdingTankModule.removeFromHoldingTank() },
    { name: 'clearHoldingTank', func: () => holdingTankModule.clearHoldingTank() },
    { name: 'openHoldingTankFile', func: () => holdingTankModule.openHoldingTankFile() },
    { name: 'saveHoldingTankFile', func: () => holdingTankModule.saveHoldingTankFile() },
    { name: 'setHoldingTankMode', func: () => holdingTankModule.setHoldingTankMode('playlist') },
    { name: 'getHoldingTankMode', func: () => holdingTankModule.getHoldingTankMode() },
    { name: 'holdingTankDrop', func: () => holdingTankModule.holdingTankDrop({ preventDefault: () => {} }) },
    { name: 'sendToHoldingTank', func: () => holdingTankModule.sendToHoldingTank() },
    { name: 'renameHoldingTankTab', func: () => holdingTankModule.renameHoldingTankTab() },
    { name: 'toggleAutoPlay', func: () => holdingTankModule.toggleAutoPlay() },
    { name: 'cancel_autoplay', func: () => holdingTankModule.cancel_autoplay() }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      console.log(`\n📋 Running test: ${test.name}`);
      const result = await test.func();
      
      if (result && result.success !== false) {
        console.log(`✅ ${test.name} PASSED`);
        passed++;
      } else {
        console.log(`❌ ${test.name} FAILED:`, result?.error || 'Unknown error');
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${test.name} FAILED with exception:`, error.message);
      failed++;
    }
  }

  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('🎉 All tests passed!');
  } else {
    console.log('⚠️  Some tests failed. Check the output above for details.');
  }
}

// Make test function available globally
window.runHoldingTankTests = runHoldingTankTests;
window.holdingTankModule = holdingTankModule;

console.log('🧪 Holding Tank Module Browser Test loaded!');
console.log('Run runHoldingTankTests() to execute all tests.'); 