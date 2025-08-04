/**
 * Categories Module Browser Test
 * 
 * This file tests the categories module functionality in the browser environment.
 * It can be included in an HTML page to test the module without the full Electron environment.
 */

// Mock the required dependencies for browser testing
if (typeof window !== 'undefined') {
  // Mock jQuery if not available
  if (typeof $ === 'undefined') {
    window.$ = function(selector) {
      return {
        remove: function() { console.log('Mock: remove() called on', selector); },
        append: function(html) { console.log('Mock: append() called on', selector, 'with', html); },
        find: function() { return this; },
        hide: function() { console.log('Mock: hide() called on', selector); },
        show: function() { console.log('Mock: show() called on', selector); },
        select: function() { console.log('Mock: select() called on', selector); },
        val: function(value) { 
          if (value !== undefined) {
            console.log('Mock: val() set on', selector, 'to', value);
          }
          return 'mock-value';
        },
        attr: function(name, value) {
          if (value !== undefined) {
            console.log('Mock: attr() set on', selector, name, 'to', value);
          }
          return 'mock-attr';
        },
        removeAttr: function(name) { console.log('Mock: removeAttr() called on', selector, name); },
        each: function(callback) { console.log('Mock: each() called on', selector); },
        modal: function() { console.log('Mock: modal() called on', selector); },
        length: 1
      };
    };
  }

  // Mock electronAPI
  if (typeof window.electronAPI === 'undefined') {
    window.electronAPI = {
      database: {
        getCategories: function() {
          return Promise.resolve({
            success: true,
            data: [
              { code: 'ROCK', description: 'Rock Music' },
              { code: 'JAZZ', description: 'Jazz Music' },
              { code: 'CLASS', description: 'Classical Music' }
            ]
          });
        },
        query: function(sql, params) {
          return Promise.resolve({
            success: true,
            data: [{ code: 'TEST', description: 'Test Category' }]
          });
        },
        execute: function(sql, params) {
          return Promise.resolve({
            success: true,
            changes: 1
          });
        }
      }
    };
  }

  // Mock global categories object
  if (typeof window.categories === 'undefined') {
    window.categories = {};
  }

  // Mock customConfirm function
  if (typeof window.customConfirm === 'undefined') {
    window.customConfirm = function(message, callback) {
      console.log('Mock: customConfirm called with:', message);
      if (callback) callback();
    };
  }

  // Mock db object for legacy fallback
  if (typeof window.db === 'undefined') {
    window.db = {
      prepare: function(sql) {
        return {
          iterate: function() {
            return [
              { code: 'ROCK', description: 'Rock Music' },
              { code: 'JAZZ', description: 'Jazz Music' },
              { code: 'CLASS', description: 'Classical Music' }
            ];
          },
          get: function(code) {
            return { code: code, description: 'Test Category' };
          },
          run: function() {
            return { changes: 1 };
          }
        };
      }
    };
  }
}

// Test function to run all category module tests
function testCategoriesModule() {
  console.log('🧪 Testing Categories Module...');
  
  try {
    // Test module loading
    console.log('📦 Testing module loading...');
    const categoriesModule = require('./renderer/modules/categories');
    
    if (categoriesModule && categoriesModule.categories) {
      console.log('✅ Module loaded successfully');
    } else {
      console.log('❌ Module failed to load');
      return;
    }

    // Test module initialization
    console.log('🚀 Testing module initialization...');
    categoriesModule.categories.init().then(() => {
      console.log('✅ Module initialized successfully');
      
      // Test all functions
      testCategoryOperations(categoriesModule);
      testCategoryUI(categoriesModule);
      testCategoryData(categoriesModule);
      
    }).catch(error => {
      console.error('❌ Module initialization failed:', error);
    });

  } catch (error) {
    console.error('❌ Module test failed:', error);
  }
}

// Test category operations
function testCategoryOperations(module) {
  console.log('🔧 Testing category operations...');
  
  const operations = [
    'getCategories',
    'getCategoryByCode', 
    'editCategory',
    'updateCategory',
    'deleteCategory',
    'addNewCategory'
  ];
  
  operations.forEach(operation => {
    if (typeof module[operation] === 'function') {
      console.log(`✅ ${operation} function exists`);
    } else {
      console.log(`❌ ${operation} function missing`);
    }
  });
  
  // Test specific operations
  testGetCategories(module);
  testAddNewCategory(module);
}

// Test category UI functions
function testCategoryUI(module) {
  console.log('🎨 Testing category UI functions...');
  
  const uiFunctions = [
    'populateCategorySelect',
    'populateCategoriesModal',
    'editCategoryUI',
    'openCategoriesModal',
    'saveCategories',
    'addNewCategoryUI',
    'deleteCategoryUI'
  ];
  
  uiFunctions.forEach(func => {
    if (typeof module[func] === 'function') {
      console.log(`✅ ${func} function exists`);
    } else {
      console.log(`❌ ${func} function missing`);
    }
  });
  
  // Test specific UI functions
  testPopulateCategorySelect(module);
}

// Test category data functions
function testCategoryData(module) {
  console.log('📊 Testing category data functions...');
  
  const dataFunctions = [
    'loadCategories',
    'refreshCategories',
    'validateCategoryCode',
    'generateCategoryCode',
    'getCategoryDescription',
    'getCategoryCodes',
    'getCategoryDescriptions',
    'categoryExists',
    'getCategoryCount',
    'getCategoriesAsArray',
    'getSortedCategories',
    'filterCategories'
  ];
  
  dataFunctions.forEach(func => {
    if (typeof module[func] === 'function') {
      console.log(`✅ ${func} function exists`);
    } else {
      console.log(`❌ ${func} function missing`);
    }
  });
  
  // Test specific data functions
  testLoadCategories(module);
  testValidateCategoryCode(module);
}

// Test getCategories operation
function testGetCategories(module) {
  console.log('📋 Testing getCategories...');
  
  module.getCategories().then(result => {
    if (result.success && result.data) {
      console.log('✅ getCategories works:', result.data.length, 'categories found');
    } else {
      console.log('❌ getCategories failed:', result.error);
    }
  }).catch(error => {
    console.log('❌ getCategories error:', error);
  });
}

// Test addNewCategory operation
function testAddNewCategory(module) {
  console.log('➕ Testing addNewCategory...');
  
  module.addNewCategory("Test Category").then(result => {
    if (result.success) {
      console.log('✅ addNewCategory works:', result.code, result.description);
    } else {
      console.log('❌ addNewCategory failed:', result.error);
    }
  }).catch(error => {
    console.log('❌ addNewCategory error:', error);
  });
}

// Test populateCategorySelect UI function
function testPopulateCategorySelect(module) {
  console.log('🎯 Testing populateCategorySelect...');
  
  module.populateCategorySelect().then(() => {
    console.log('✅ populateCategorySelect works');
  }).catch(error => {
    console.log('❌ populateCategorySelect error:', error);
  });
}

// Test loadCategories data function
function testLoadCategories(module) {
  console.log('📥 Testing loadCategories...');
  
  module.loadCategories().then(result => {
    if (result.success) {
      console.log('✅ loadCategories works:', Object.keys(result.data).length, 'categories loaded');
    } else {
      console.log('❌ loadCategories failed:', result.error);
    }
  }).catch(error => {
    console.log('❌ loadCategories error:', error);
  });
}

// Test validateCategoryCode data function
function testValidateCategoryCode(module) {
  console.log('✅ Testing validateCategoryCode...');
  
  module.validateCategoryCode("ROCK").then(isValid => {
    console.log('✅ validateCategoryCode works, ROCK is valid:', isValid);
  }).catch(error => {
    console.log('❌ validateCategoryCode error:', error);
  });
}

// Test module test function
function testModuleTest(module) {
  console.log('🧪 Testing module test function...');
  
  const testResults = module.categories.test();
  console.log('Test results:', testResults);
  
  const info = module.categories.getInfo();
  console.log('Module info:', info);
}

// Run tests when page loads
if (typeof window !== 'undefined') {
  window.addEventListener('load', function() {
    console.log('🚀 Starting Categories Module Tests...');
    setTimeout(testCategoriesModule, 1000); // Small delay to ensure everything is loaded
  });
}

// Export test function for Node.js
if (typeof module !== 'undefined') {
  module.exports = {
    testCategoriesModule,
    testCategoryOperations,
    testCategoryUI,
    testCategoryData
  };
}

console.log('📋 Categories Module Test File Loaded');
console.log('💡 Run testCategoriesModule() to start testing'); 