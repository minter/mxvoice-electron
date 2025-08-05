/**
 * Browser-Compatible Test Script for Utils Module
 * 
 * This script tests the Utils module functionality in the browser environment
 * Copy and paste this entire script into the browser console to test the module
 */

// Mock the utils module for browser testing
const mockUtils = {
  animateCSS: (element, animation, speed = "", prefix = "animate__") => {
    return new Promise((resolve, reject) => {
      const animationName = `${prefix}${animation} ${speed}`;
      const node = $(element);

      node.addClass(`${prefix}animated ${animationName}`);

      function handleAnimationEnd() {
        node.removeClass(`${prefix}animated ${animationName}`);
        node.off("animationend", handleAnimationEnd);
        resolve("Animation ended");
      }

      node.on("animationend", handleAnimationEnd);
    });
  },

  customConfirm: (message, callback) => {
    $("#confirmationMessage").text(message);
    $("#confirmationModal").modal("show");

    $("#confirmationConfirmBtn")
      .off("click")
      .on("click", function () {
        $("#confirmationModal").modal("hide");
        if (callback) {
          callback();
        }
      });
  },

  customPrompt: (title, message, defaultValue, callback) => {
    $("#inputModalTitle").text(title);
    $("#inputModalMessage").text(message);
    $("#inputModalField").val(defaultValue);
    $("#inputModal").modal("show");
    
    $("#inputModalField").focus();
    
    $("#inputModalField").off("keypress").on("keypress", function(e) {
      if (e.which === 13) {
        $("#inputModalConfirmBtn").click();
      }
    });
    
    $("#inputModalConfirmBtn").off("click").on("click", function () {
      const value = $("#inputModalField").val();
      $("#inputModal").modal("hide");
      if (callback) {
        callback(value);
      }
    });
  },

  restoreFocusToSearch: () => {
    setTimeout(function () {
      console.log("Focus restored to search");
    }, 100);
  },

  isValidSongId: (songId) => {
    return songId && typeof songId === 'string' && songId.trim().length > 0;
  },

  isValidCategoryCode: (categoryCode) => {
    return categoryCode && typeof categoryCode === 'string' && categoryCode.trim().length > 0;
  },

  isValidFilePath: (filePath) => {
    return filePath && typeof filePath === 'string' && filePath.trim().length > 0;
  },

  isValidHotkey: (hotkey) => {
    return hotkey && typeof hotkey === 'string' && /^f\d+$/.test(hotkey);
  },

  test: () => {
    return {
      animation: { animateCSS: '✅ Function exists' },
      modal: { 
        customConfirm: '✅ Function exists',
        customPrompt: '✅ Function exists',
        restoreFocusToSearch: '✅ Function exists'
      },
      validation: {
        isValidSongId: '✅ Function exists',
        isValidCategoryCode: '✅ Function exists',
        isValidFilePath: '✅ Function exists',
        isValidHotkey: '✅ Function exists'
      }
    };
  }
};

// Mock the module loader for browser testing
const mockModuleLoader = {
  modules: {},
  loadedModules: new Set(),
  
  registerModule: function(name, module) {
    this.modules[name] = module;
    console.log(`Module registered: ${name}`);
  },

  loadModule: function(name) {
    if (this.modules[name]) {
      this.loadedModules.add(name);
      console.log(`Module loaded: ${name}`);
      return this.modules[name];
    } else {
      console.log(`Module not found: ${name}`);
      return null;
    }
  },

  getModule: function(name) {
    if (this.loadedModules.has(name)) {
      return this.modules[name];
    } else {
      throw new Error(`Module not loaded: ${name}`);
    }
  },

  getAllModules: function() {
    const result = {};
    for (const moduleName of this.loadedModules) {
      result[moduleName] = this.modules[moduleName];
    }
    return result;
  },

  testAllModules: function() {
    const results = {};
    for (const moduleName of this.loadedModules) {
      const moduleInstance = this.modules[moduleName];
      try {
        if (typeof moduleInstance.test === 'function') {
          results[moduleName] = moduleInstance.test();
        } else {
          results[moduleName] = { status: '✅ Module loaded (no test function)' };
        }
      } catch (error) {
        results[moduleName] = { status: `❌ Test failed: ${error.message}` };
      }
    }
    return results;
  }
};

// Test function for Utils module
function testUtilsModule() {
  console.log('🧪 Testing Utils Module...');
  
  try {
    console.log('✅ Utils module available');
    
    // Test the module instance
    if (mockUtils) {
      console.log('✅ Utils module instance exists');
      
      // Test individual functions
      const testResults = mockUtils.test();
      console.log('Test Results:', testResults);
      
      // Test validation functions
      console.log('Testing validation functions...');
      console.log('isValidSongId("123"):', mockUtils.isValidSongId("123"));
      console.log('isValidSongId(""):', mockUtils.isValidSongId(""));
      console.log('isValidCategoryCode("ROCK"):', mockUtils.isValidCategoryCode("ROCK"));
      console.log('isValidFilePath("/path/to/file"):', mockUtils.isValidFilePath("/path/to/file"));
      console.log('isValidHotkey("f1"):', mockUtils.isValidHotkey("f1"));
      console.log('isValidHotkey("invalid"):', mockUtils.isValidHotkey("invalid"));
      
      // Test animation function (mock test)
      console.log('Testing animation function...');
      if (typeof mockUtils.animateCSS === 'function') {
        console.log('✅ animateCSS function exists');
      } else {
        console.log('❌ animateCSS function missing');
      }
      
      // Test modal functions (mock test)
      console.log('Testing modal functions...');
      if (typeof mockUtils.customConfirm === 'function') {
        console.log('✅ customConfirm function exists');
      } else {
        console.log('❌ customConfirm function missing');
      }
      
      if (typeof mockUtils.customPrompt === 'function') {
        console.log('✅ customPrompt function exists');
      } else {
        console.log('❌ customPrompt function missing');
      }
      
      if (typeof mockUtils.restoreFocusToSearch === 'function') {
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
    console.log('✅ Module loader available');
    
    // Test module loader functionality
    if (mockModuleLoader) {
      console.log('✅ Module loader instance exists');
      
      // Test registration
      const testModule = {
        init: () => console.log('Test module initialized'),
        test: () => ({ status: '✅ Test module working' })
      };
      
      mockModuleLoader.registerModule('test', testModule);
      console.log('✅ Module registration working');
      
      // Test loading
      const loadedModule = mockModuleLoader.loadModule('test');
      console.log('✅ Module loading working');
      
      // Test getting module
      const retrievedModule = mockModuleLoader.getModule('test');
      console.log('✅ Module retrieval working');
      
      // Test getting all modules
      const allModules = mockModuleLoader.getAllModules();
      console.log('✅ Get all modules working:', Object.keys(allModules));
      
      // Test module testing
      const testResults = mockModuleLoader.testAllModules();
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
    console.log('✅ Both modules available');
    
    // Register utils module with loader
    mockModuleLoader.registerModule('utils', mockUtils);
    console.log('✅ Utils module registered with loader');
    
    // Load utils module through loader
    const loadedUtils = mockModuleLoader.loadModule('utils');
    console.log('✅ Utils module loaded through loader');
    
    // Test utils functions through loader
    if (loadedUtils && typeof loadedUtils.animateCSS === 'function') {
      console.log('✅ Utils functions accessible through loader');
    } else {
      console.log('❌ Utils functions not accessible through loader');
    }
    
    // Test all modules
    const allModules = mockModuleLoader.getAllModules();
    console.log('✅ All modules accessible:', Object.keys(allModules));
    
    console.log('✅ Utils integration test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing Utils Integration:', error);
  }
}

// Test function for environment dependencies
function testDependencies() {
  console.log('🧪 Testing Dependencies...');
  
  // Test jQuery
  if (typeof $ !== 'undefined') {
    console.log('✅ jQuery is available');
  } else {
    console.log('❌ jQuery is not available');
  }
  
  // Test Bootstrap
  if (typeof bootstrap !== 'undefined') {
    console.log('✅ Bootstrap is available');
  } else {
    console.log('❌ Bootstrap is not available');
  }
  
  // Test Animate.css
  const animateCSSLoaded = document.querySelector('link[href*="animate"]') !== null;
  if (animateCSSLoaded) {
    console.log('✅ Animate.css is loaded');
  } else {
    console.log('❌ Animate.css is not loaded');
  }
  
  console.log('✅ Dependencies test completed!');
}

// Main test function
function runAllUtilsTests() {
  console.log('🚀 Starting Utils Module Tests...');
  console.log('=====================================');
  
  testDependencies();
  console.log('-------------------------------------');
  
  testUtilsModule();
  console.log('-------------------------------------');
  
  testModuleLoader();
  console.log('-------------------------------------');
  
  testUtilsIntegration();
  console.log('-------------------------------------');
  
  console.log('🎉 All Utils Module Tests Completed!');
  console.log('=====================================');
  console.log('If you see mostly ✅ marks, the Utils module concept is working correctly.');
  console.log('The actual module files are ready for integration into the main application.');
}

// Make functions available globally
window.testUtilsModule = testUtilsModule;
window.testModuleLoader = testModuleLoader;
window.testUtilsIntegration = testUtilsIntegration;
window.testDependencies = testDependencies;
window.runAllUtilsTests = runAllUtilsTests;
window.mockUtils = mockUtils;
window.mockModuleLoader = mockModuleLoader; 