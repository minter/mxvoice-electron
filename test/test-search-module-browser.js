/**
 * Test Search Module in Browser
 * 
 * This file tests the search module functionality in a browser environment.
 * It can be loaded in a browser to test the search functions.
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
      text: () => {}
    };
  };
}

// Mock global variables
if (typeof fontSize === 'undefined') {
  global.fontSize = 11;
}

if (typeof categories === 'undefined') {
  global.categories = {
    'rock': 'Rock',
    'pop': 'Pop',
    'jazz': 'Jazz'
  };
}

if (typeof db === 'undefined') {
  global.db = {
    prepare: (sql) => ({
      all: (params) => []
    })
  };
}

if (typeof searchTimeout === 'undefined') {
  global.searchTimeout = null;
}

if (typeof clearTimeout === 'undefined') {
  global.clearTimeout = () => {};
}

if (typeof scale_scrollable === 'undefined') {
  global.scale_scrollable = () => {};
}

if (typeof animateCSS === 'undefined') {
  global.animateCSS = (element, animation) => Promise.resolve();
}

if (typeof window === 'undefined') {
  global.window = {
    electronAPI: {
      database: {
        query: (sql, params) => Promise.resolve({ success: true, data: [] })
      }
    }
  };
}

// Load the search module
const searchModule = require('./renderer/modules/search');

console.log('🔍 Testing Search Module...');

// Test module loading
console.log('✅ Search module loaded successfully');

// Test module info
const info = searchModule.search.getInfo();
console.log('📋 Module Info:', info);

// Test function availability
const testResults = searchModule.search.test();
console.log('🧪 Test Results:', testResults);

// Test individual functions
console.log('🔧 Individual Functions:');
console.log('- searchData:', typeof searchModule.searchData);
console.log('- performLiveSearch:', typeof searchModule.performLiveSearch);
console.log('- toggleAdvancedSearch:', typeof searchModule.toggleAdvancedSearch);
console.log('- clearSearchResults:', typeof searchModule.clearSearchResults);
console.log('- triggerLiveSearch:', typeof searchModule.triggerLiveSearch);
console.log('- buildSearchQuery:', typeof searchModule.buildSearchQuery);

// Test buildSearchQuery function
try {
  const queryResult = searchModule.buildSearchQuery('test', true);
  console.log('🔍 Query Result:', queryResult);
} catch (error) {
  console.log('❌ Query test failed:', error.message);
}

console.log('✅ Search module test completed!'); 