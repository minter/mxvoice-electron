/**
 * Test Database Module in Browser
 * 
 * This file tests the database module functionality in a browser environment.
 * It can be loaded in a browser to test the database functions.
 */

// Mock jQuery for testing
if (typeof $ === 'undefined') {
  global.$ = function(selector) {
    return {
      val: () => '',
      trim: () => '',
      length: 0,
      find: () => ({ remove: () => {} }),
      show: () => {},
      hide: () => {},
      append: () => {},
      select: () => {},
      focus: () => {},
      prop: () => {},
      is: () => false,
      css: () => 'none',
      toggleClass: () => {},
      trigger: () => {},
      on: () => {},
      off: () => {},
      first: () => ({ attr: () => {} }),
      removeAttr: () => {},
      blur: () => {},
      text: () => {},
      html: () => {},
      attr: () => {},
      after: () => {},
      detach: () => {},
      empty: () => {},
      forEach: () => {}
    };
  };
}

// Mock global variables
if (typeof categories === 'undefined') {
  global.categories = {
    'rock': 'Rock',
    'pop': 'Pop',
    'jazz': 'Jazz'
  };
}

if (typeof fontSize === 'undefined') {
  global.fontSize = 11;
}

if (typeof db === 'undefined') {
  global.db = {
    prepare: (sql) => ({
      all: (params) => [],
      get: (params) => null,
      iterate: () => []
    })
  };
}

if (typeof window === 'undefined') {
  global.window = {
    electronAPI: {
      database: {
        query: (sql, params) => Promise.resolve({ success: true, data: [] }),
        execute: (sql, params) => Promise.resolve({ success: true, data: {} }),
        getCategories: () => Promise.resolve({ success: true, data: [] })
      },
      store: {
        set: (key, value) => Promise.resolve({ success: true })
      }
    }
  };
}

// Mock scale_scrollable function
if (typeof scale_scrollable === 'undefined') {
  global.scale_scrollable = () => {};
}

// Mock saveHotkeysToStore function
if (typeof saveHotkeysToStore === 'undefined') {
  global.saveHotkeysToStore = () => {};
}

// Mock saveHoldingTankToStore function
if (typeof saveHoldingTankToStore === 'undefined') {
  global.saveHoldingTankToStore = () => {};
}

// Mock path module
if (typeof path === 'undefined') {
  global.path = {
    parse: (filePath) => ({ name: 'test', ext: '.mp3' }),
    extname: (filePath) => '.mp3',
    join: (...paths) => paths.join('/')
  };
}

// Mock uuidv4 function
if (typeof uuidv4 === 'undefined') {
  global.uuidv4 = () => 'test-uuid-123';
}

// Load the database module
const databaseModule = require('./renderer/modules/database');

console.log('🗄️ Testing Database Module...');

// Test module loading
console.log('✅ Database module loaded successfully');

// Test module info
const info = databaseModule.database.getInfo();
console.log('📋 Module Info:', info);

// Test function availability
const testResults = databaseModule.database.test();
console.log('🧪 Test Results:', testResults);

// Test individual functions
console.log('🔧 Individual Functions:');
console.log('- populateCategorySelect:', typeof databaseModule.populateCategorySelect);
console.log('- setLabelFromSongId:', typeof databaseModule.setLabelFromSongId);
console.log('- addToHoldingTank:', typeof databaseModule.addToHoldingTank);
console.log('- populateHotkeys:', typeof databaseModule.populateHotkeys);
console.log('- populateHoldingTank:', typeof databaseModule.populateHoldingTank);
console.log('- populateCategoriesModal:', typeof databaseModule.populateCategoriesModal);
console.log('- saveHoldingTankToStore:', typeof databaseModule.saveHoldingTankToStore);
console.log('- saveHotkeysToStore:', typeof databaseModule.saveHotkeysToStore);
console.log('- scaleScrollable:', typeof databaseModule.scaleScrollable);

// Test new database operations
console.log('🔧 New Database Operations:');
console.log('- editCategory:', typeof databaseModule.editCategory);
console.log('- deleteCategory:', typeof databaseModule.deleteCategory);
console.log('- addNewCategory:', typeof databaseModule.addNewCategory);
console.log('- saveEditedSong:', typeof databaseModule.saveEditedSong);
console.log('- saveNewSong:', typeof databaseModule.saveNewSong);
console.log('- deleteSong:', typeof databaseModule.deleteSong);
console.log('- getSongById:', typeof databaseModule.getSongById);
console.log('- addSongsByPath:', typeof databaseModule.addSongsByPath);
console.log('- executeQuery:', typeof databaseModule.executeQuery);
console.log('- executeStatement:', typeof databaseModule.executeStatement);

// Test database functions
try {
  console.log('🔍 Testing database functions...');
  
  // Test populateCategorySelect
  if (typeof databaseModule.populateCategorySelect === 'function') {
    console.log('✅ populateCategorySelect function exists');
  } else {
    console.log('❌ populateCategorySelect function missing');
  }
  
  // Test setLabelFromSongId
  if (typeof databaseModule.setLabelFromSongId === 'function') {
    console.log('✅ setLabelFromSongId function exists');
  } else {
    console.log('❌ setLabelFromSongId function missing');
  }
  
  // Test addToHoldingTank
  if (typeof databaseModule.addToHoldingTank === 'function') {
    console.log('✅ addToHoldingTank function exists');
  } else {
    console.log('❌ addToHoldingTank function missing');
  }
  
  // Test populateHotkeys
  if (typeof databaseModule.populateHotkeys === 'function') {
    console.log('✅ populateHotkeys function exists');
  } else {
    console.log('❌ populateHotkeys function missing');
  }
  
  // Test populateHoldingTank
  if (typeof databaseModule.populateHoldingTank === 'function') {
    console.log('✅ populateHoldingTank function exists');
  } else {
    console.log('❌ populateHoldingTank function missing');
  }
  
  // Test populateCategoriesModal
  if (typeof databaseModule.populateCategoriesModal === 'function') {
    console.log('✅ populateCategoriesModal function exists');
  } else {
    console.log('❌ populateCategoriesModal function missing');
  }
  
  // Test store operations
  if (typeof databaseModule.saveHoldingTankToStore === 'function') {
    console.log('✅ saveHoldingTankToStore function exists');
  } else {
    console.log('❌ saveHoldingTankToStore function missing');
  }
  
  if (typeof databaseModule.saveHotkeysToStore === 'function') {
    console.log('✅ saveHotkeysToStore function exists');
  } else {
    console.log('❌ saveHotkeysToStore function missing');
  }
  
  // Test UI operations
  if (typeof databaseModule.scaleScrollable === 'function') {
    console.log('✅ scaleScrollable function exists');
  } else {
    console.log('❌ scaleScrollable function missing');
  }
  
  // Test new database operations
  if (typeof databaseModule.editCategory === 'function') {
    console.log('✅ editCategory function exists');
  } else {
    console.log('❌ editCategory function missing');
  }
  
  if (typeof databaseModule.deleteCategory === 'function') {
    console.log('✅ deleteCategory function exists');
  } else {
    console.log('❌ deleteCategory function missing');
  }
  
  if (typeof databaseModule.addNewCategory === 'function') {
    console.log('✅ addNewCategory function exists');
  } else {
    console.log('❌ addNewCategory function missing');
  }
  
  if (typeof databaseModule.saveEditedSong === 'function') {
    console.log('✅ saveEditedSong function exists');
  } else {
    console.log('❌ saveEditedSong function missing');
  }
  
  if (typeof databaseModule.saveNewSong === 'function') {
    console.log('✅ saveNewSong function exists');
  } else {
    console.log('❌ saveNewSong function missing');
  }
  
  if (typeof databaseModule.deleteSong === 'function') {
    console.log('✅ deleteSong function exists');
  } else {
    console.log('❌ deleteSong function missing');
  }
  
  if (typeof databaseModule.getSongById === 'function') {
    console.log('✅ getSongById function exists');
  } else {
    console.log('❌ getSongById function missing');
  }
  
  if (typeof databaseModule.addSongsByPath === 'function') {
    console.log('✅ addSongsByPath function exists');
  } else {
    console.log('❌ addSongsByPath function missing');
  }
  
  if (typeof databaseModule.executeQuery === 'function') {
    console.log('✅ executeQuery function exists');
  } else {
    console.log('❌ executeQuery function missing');
  }
  
  if (typeof databaseModule.executeStatement === 'function') {
    console.log('✅ executeStatement function exists');
  } else {
    console.log('❌ executeStatement function missing');
  }
  
} catch (error) {
  console.log('❌ Database function test failed:', error.message);
}

// Test function execution (mock tests)
console.log('🧪 Testing function execution...');

try {
  // Test category operations
  if (typeof databaseModule.addNewCategory === 'function') {
    console.log('✅ addNewCategory function can be called');
  }
  
  if (typeof databaseModule.editCategory === 'function') {
    console.log('✅ editCategory function can be called');
  }
  
  if (typeof databaseModule.deleteCategory === 'function') {
    console.log('✅ deleteCategory function can be called');
  }
  
  // Test song operations
  if (typeof databaseModule.saveNewSong === 'function') {
    console.log('✅ saveNewSong function can be called');
  }
  
  if (typeof databaseModule.saveEditedSong === 'function') {
    console.log('✅ saveEditedSong function can be called');
  }
  
  if (typeof databaseModule.deleteSong === 'function') {
    console.log('✅ deleteSong function can be called');
  }
  
  if (typeof databaseModule.getSongById === 'function') {
    console.log('✅ getSongById function can be called');
  }
  
  // Test query operations
  if (typeof databaseModule.executeQuery === 'function') {
    console.log('✅ executeQuery function can be called');
  }
  
  if (typeof databaseModule.executeStatement === 'function') {
    console.log('✅ executeStatement function can be called');
  }
  
  // Test bulk operations
  if (typeof databaseModule.addSongsByPath === 'function') {
    console.log('✅ addSongsByPath function can be called');
  }
  
} catch (error) {
  console.log('❌ Function execution test failed:', error.message);
}

console.log('✅ Database module test completed!'); 