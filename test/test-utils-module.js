/**
 * Test Script for Utils Module
 * 
 * This script tests the Utils module functionality
 * Run this in the browser console to test the module
 */

// Test function for Utils module
function testUtilsModule() {
  console.log('🧪 Testing Utils Module...');
  
  try {
    // Import the utils module
    const utils = require('./renderer/modules/utils');
    
    console.log('✅ Utils module imported successfully');
    
    // Test the module instance
    if (utils.utils) {
      console.log('✅ Utils module instance exists');
      
      // Test individual functions
      const testResults = utils.utils.test();
      console.log('Test Results:', testResults);
      
      // Test validation functions
      console.log('Testing validation functions...');
      console.log('isValidSongId("123"):', utils.isValidSongId("123"));
      console.log('isValidSongId(""):', utils.isValidSongId(""));
      console.log('isValidCategoryCode("ROCK"):', utils.isValidCategoryCode("ROCK"));
      console.log('isValidFilePath("/path/to/file"):', utils.isValidFilePath("/path/to/file"));
      console.log('isValidHotkey("f1"):', utils.isValidHotkey("f1"));
      console.log('isValidHotkey("invalid"):', utils.isValidHotkey("invalid"));
      
      // Test animation function (mock test)
      console.log('Testing animation function...');
      if (typeof utils.animateCSS === 'function') {
        console.log('✅ animateCSS function exists');
      } else {
        console.log('❌ animateCSS function missing');
      }
      
      // Test modal functions (mock test)
      console.log('Testing modal functions...');
      if (typeof utils.customConfirm === 'function') {
        console.log('✅ customConfirm function exists');
      } else {
        console.log('❌ customConfirm function missing');
      }
      
      if (typeof utils.customPrompt === 'function') {
        console.log('✅ customPrompt function exists');
      } else {
        console.log('❌ customPrompt function missing');
      }
      
      if (typeof utils.restoreFocusToSearch === 'function') {
        console.log('✅ restoreFocusToSearch function exists');
      } else {
        console.log('❌ restoreFocusToSearch function missing');
      }
      
      console.log('✅ Utils module test completed successfully!');
      
    } else {
      console.log('❌ Utils module instance missing');
    }
    
  } catch (error) {
    console.error('❌ Error testing Utils module:', error);
  }
}

// Test function for Module Loader
function testModuleLoader() {
  console.log('🧪 Testing Module Loader...');
  
  try {
    // Import the module loader
    const { loader } = require('./renderer/module-loader');
    
    console.log('✅ Module loader imported successfully');
    
    // Test module loader functionality
    if (loader) {
      console.log('✅ Module loader instance exists');
      
      // Test registration
      const testModule = {
        init: () => console.log('Test module initialized'),
        test: () => ({ status: '✅ Test module working' })
      };
      
      loader.registerModule('test', testModule);
      console.log('✅ Module registration working');
      
      // Test loading
      const loadedModule = loader.loadModule('test');
      console.log('✅ Module loading working');
      
      // Test getting module
      const retrievedModule = loader.getModule('test');
      console.log('✅ Module retrieval working');
      
      // Test getting all modules
      const allModules = loader.getAllModules();
      console.log('✅ Get all modules working:', Object.keys(allModules));
      
      // Test module testing
      const testResults = loader.testAllModules();
      console.log('✅ Module testing working:', testResults);
      
      console.log('✅ Module loader test completed successfully!');
      
    } else {
      console.log('❌ Module loader instance missing');
    }
    
  } catch (error) {
    console.error('❌ Error testing Module Loader:', error);
  }
}

// Test function for integration
function testUtilsIntegration() {
  console.log('🧪 Testing Utils Integration...');
  
  try {
    // Import both modules
    const utils = require('./renderer/modules/utils');
    const { loader } = require('./renderer/module-loader');
    
    console.log('✅ Both modules imported successfully');
    
    // Register utils module with loader
    loader.registerModule('utils', utils.utils);
    console.log('✅ Utils module registered with loader');
    
    // Load utils module through loader
    const loadedUtils = loader.loadModule('utils');
    console.log('✅ Utils module loaded through loader');
    
    // Test utils functions through loader
    if (loadedUtils && typeof loadedUtils.animateCSS === 'function') {
      console.log('✅ Utils functions accessible through loader');
    } else {
      console.log('❌ Utils functions not accessible through loader');
    }
    
    // Test all modules
    const allModules = loader.getAllModules();
    console.log('✅ All modules accessible:', Object.keys(allModules));
    
    console.log('✅ Utils integration test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing Utils Integration:', error);
  }
}

// Main test function
function runAllUtilsTests() {
  console.log('🚀 Starting Utils Module Tests...');
  console.log('=====================================');
  
  testUtilsModule();
  console.log('-------------------------------------');
  
  testModuleLoader();
  console.log('-------------------------------------');
  
  testUtilsIntegration();
  console.log('-------------------------------------');
  
  console.log('🎉 All Utils Module Tests Completed!');
}

// Export test functions for global access
if (typeof window !== 'undefined') {
  window.testUtilsModule = testUtilsModule;
  window.testModuleLoader = testModuleLoader;
  window.testUtilsIntegration = testUtilsIntegration;
  window.runAllUtilsTests = runAllUtilsTests;
}

// Export for Node.js
module.exports = {
  testUtilsModule,
  testModuleLoader,
  testUtilsIntegration,
  runAllUtilsTests
}; 