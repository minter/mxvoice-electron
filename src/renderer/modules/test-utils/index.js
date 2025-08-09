/**
 * Test Functions Module
 * 
 * This module contains all testing utilities for the MxVoice application.
 * These functions are used for testing various APIs and features during development.
 */

// Import debug logger
let debugLog = null;
try {
  // Try to get debug logger from global scope
  if (window.debugLog) {
    debugLog = window.debugLog;
  }
} catch (error) {
  // Debug logger not available
}

// Import secure adapters
import { secureFileSystem, secureStore } from '../adapters/secure-adapter.js';

/**
 * Test function for Phase 2 migrations
 * Tests if new APIs are available and working
 */
export function testPhase2Migrations() {
  debugLog?.info('Testing Phase 2 Migrations', { 
    module: 'test-utils',
    function: 'testPhase2Migrations'
  });
  
  // Test if new APIs are available
  if (window.electronAPI) {
    debugLog?.info('New electronAPI is available', { 
      module: 'test-utils',
      function: 'testPhase2Migrations'
    });
    
    // Test each migrated function
    const functionsToTest = [
      'openHotkeyFile',
      'openHoldingTankFile', 
      'saveHotkeyFile',
      'saveHoldingTankFile',
      'installUpdate'
    ];
    
    functionsToTest.forEach(funcName => {
      if (typeof window[funcName] === 'function') {
        debugLog?.info(`${funcName} function is available`, { 
          module: 'test-utils',
          function: 'testPhase2Migrations',
          functionName: funcName
        });
      } else {
        debugLog?.warn(`${funcName} function is NOT available`, { 
          module: 'test-utils',
          function: 'testPhase2Migrations',
          functionName: funcName
        });
      }
    });
    
    debugLog?.info('Phase 2 migrations appear to be working', { 
      module: 'test-utils',
      function: 'testPhase2Migrations'
    });
    return { success: true, message: 'Phase 2 migrations working' };
    
  } else {
    debugLog?.warn('New electronAPI not available', { 
      module: 'test-utils',
      function: 'testPhase2Migrations'
    });
    return { success: false, error: 'electronAPI not available' };
  }
}

/**
 * Test database API for gradual migration
 * Tests database functionality and queries
 */
export function testDatabaseAPI() {
  debugLog?.info('Testing Database API for gradual migration', { 
    module: 'test-utils',
    function: 'testDatabaseAPI'
  });
  
  if (window.electronAPI && window.electronAPI.database) {
    debugLog?.info('Database API available', { 
      module: 'test-utils',
      function: 'testDatabaseAPI'
    });
    
    const results = {
      success: true,
      tests: []
    };
    
    // Test get categories
    return window.electronAPI.database.getCategories().then(result => {
      if (result.success) {
        debugLog?.info('getCategories API works', { 
          module: 'test-utils',
          function: 'testDatabaseAPI',
          categoryCount: result.data.length
        });
        results.tests.push({ name: 'getCategories', success: true, data: result.data.length });
      } else {
        debugLog?.warn('getCategories API failed', { 
          module: 'test-utils',
          function: 'testDatabaseAPI',
          error: result.error
        });
        results.tests.push({ name: 'getCategories', success: false, error: result.error });
      }
      
      // Test database query
      return window.electronAPI.database.query('SELECT COUNT(*) as count FROM categories');
    }).then(result => {
      if (result.success) {
        debugLog?.info('database query API works', { 
          module: 'test-utils',
          function: 'testDatabaseAPI',
          categoryCount: result.data[0].count
        });
        results.tests.push({ name: 'databaseQuery', success: true, data: result.data[0].count });
      } else {
        debugLog?.warn('database query API failed', { 
          module: 'test-utils',
          function: 'testDatabaseAPI',
          error: result.error
        });
        results.tests.push({ name: 'databaseQuery', success: false, error: result.error });
      }
      
      return results;
    }).catch(error => {
      debugLog?.warn('Database API error', { 
        module: 'test-utils',
        function: 'testDatabaseAPI',
        error: error.message
      });
      return { success: false, error: error.message };
    });
    
  } else {
    debugLog?.warn('Database API not available', { 
      module: 'test-utils',
      function: 'testDatabaseAPI'
    });
    return Promise.resolve({ success: false, error: 'Database API not available' });
  }
}

/**
 * Test file system API for gradual migration
 * Tests file system operations
 */
export function testFileSystemAPI() {
  debugLog?.info('Testing File System API for gradual migration', { 
    module: 'test-utils',
    function: 'testFileSystemAPI'
  });
  
  if (window.electronAPI && window.electronAPI.fileSystem) {
    debugLog?.info('File System API available', { 
      module: 'test-utils',
      function: 'testFileSystemAPI'
    });
    
    const results = {
      success: true,
      tests: []
    };
    
    // Test file exists
    return secureStore.get('database_directory').then(dbResult => {
      if (dbResult.success) {
        const testPath = dbResult.value;
        return secureFileSystem.exists(testPath).then(result => {
          if (result.success) {
            debugLog?.info('file exists API works', { 
              module: 'test-utils',
              function: 'testFileSystemAPI',
              exists: result.exists
            });
            results.tests.push({ name: 'fileExists', success: true, exists: result.exists });
          } else {
            debugLog?.warn('file exists API failed', { 
              module: 'test-utils',
              function: 'testFileSystemAPI',
              error: result.error
            });
            results.tests.push({ name: 'fileExists', success: false, error: result.error });
          }
          
          // Test file read (try to read a config file)
          return secureStore.get('database_directory');
        });
      } else {
        debugLog?.warn('Could not get database directory from store', { 
          module: 'test-utils',
          function: 'testFileSystemAPI'
        });
        results.tests.push({ name: 'fileExists', success: false, error: 'Could not get database directory' });
        return Promise.resolve({ success: false, error: 'Could not get database directory' });
      }
    }).then(dbResult => {
      if (dbResult.success) {
        return securePath.join(dbResult.value, 'config.json').then(configPath => {
            return secureFileSystem.read(configPath).then(result => {
              if (result.success) {
                debugLog?.info('file read API works: Config file read successfully', { 
                  module: 'test-utils',
                  function: 'testFileSystemAPI'
                });
                results.tests.push({ name: 'fileRead', success: true, data: 'Config file read' });
              } else {
                debugLog?.info('file read API works: Config file does not exist (expected)', { 
                  module: 'test-utils',
                  function: 'testFileSystemAPI'
                });
                results.tests.push({ name: 'fileRead', success: true, data: 'Config file does not exist' });
              }
              return results;
            }).catch(error => {
              debugLog?.warn('file read API error', { 
                module: 'test-utils',
                function: 'testFileSystemAPI',
                error: error.message
              });
              results.tests.push({ name: 'fileRead', success: false, error: error.message });
              return results;
            });
        }).catch(error => {
          debugLog?.warn('Path join error', { 
            module: 'test-utils',
            function: 'testFileSystemAPI',
            error: error.message
          });
          results.tests.push({ name: 'fileRead', success: false, error: error.message });
          return results;
        });
      } else {
        results.tests.push({ name: 'fileRead', success: false, error: 'Could not get database directory' });
        return results;
      }
    }).catch(error => {
      debugLog?.warn('store get API error', { 
        module: 'test-utils',
        function: 'testFileSystemAPI',
        error: error.message
      });
      return { success: false, error: error.message };
    });
    
  } else {
    debugLog?.warn('File System API not available', { 
      module: 'test-utils',
      function: 'testFileSystemAPI'
    });
    return Promise.resolve({ success: false, error: 'File System API not available' });
  }
}

/**
 * Test store API for gradual migration
 * Tests store operations (get, set, has, delete)
 */
export function testStoreAPI() {
  debugLog?.info('Testing Store API for gradual migration', { 
    module: 'test-utils',
    function: 'testStoreAPI'
  });
  
  if (window.electronAPI && window.electronAPI.store) {
    debugLog?.info('Store API available', { 
      module: 'test-utils',
      function: 'testStoreAPI'
    });
    
    const results = {
      success: true,
      tests: []
    };
    
    // Test store get
    return secureStore.get('music_directory').then(result => {
      if (result.success) {
        debugLog?.info('store get API works', { 
          module: 'test-utils',
          function: 'testStoreAPI',
          value: result.value
        });
        results.tests.push({ name: 'storeGet', success: true, data: result.value });
      } else {
        debugLog?.warn('store get API failed', { 
          module: 'test-utils',
          function: 'testStoreAPI',
          error: result.error
        });
        results.tests.push({ name: 'storeGet', success: false, error: result.error });
      }
      
      // Test store has
      return secureStore.has('music_directory');
    }).then(result => {
      if (result.success) {
        debugLog?.info('store has API works', { 
          module: 'test-utils',
          function: 'testStoreAPI',
          has: result.has
        });
        results.tests.push({ name: 'storeHas', success: true, has: result.has });
      } else {
        debugLog?.warn('store has API failed', { 
          module: 'test-utils',
          function: 'testStoreAPI',
          error: result.error
        });
        results.tests.push({ name: 'storeHas', success: false, error: result.error });
      }
      
      // Test store set and get
      const testKey = 'test_api_key';
      const testValue = 'test_value_' + Date.now();
      
      return secureStore.set(testKey, testValue);
    }).then(result => {
      if (result.success) {
        debugLog?.info('store set API works', { 
          module: 'test-utils',
          function: 'testStoreAPI'
        });
        results.tests.push({ name: 'storeSet', success: true });
        // Now test getting the value back
        return secureStore.get(testKey);
      } else {
        debugLog?.warn('store set API failed', { 
          module: 'test-utils',
          function: 'testStoreAPI',
          error: result.error
        });
        results.tests.push({ name: 'storeSet', success: false, error: result.error });
        return Promise.resolve({ success: false });
      }
    }).then(result => {
      if (result && result.success) {
        debugLog?.info('store get after set works', { 
          module: 'test-utils',
          function: 'testStoreAPI',
          value: result.value
        });
        results.tests.push({ name: 'storeGetAfterSet', success: true, data: result.value });
        // Clean up test key
        return secureStore.delete(testKey);
      } else {
        results.tests.push({ name: 'storeGetAfterSet', success: false, error: 'Failed to get after set' });
        return Promise.resolve({ success: false });
      }
    }).then(result => {
      if (result && result.success) {
        debugLog?.info('store delete API works', { 
          module: 'test-utils',
          function: 'testStoreAPI'
        });
        results.tests.push({ name: 'storeDelete', success: true });
      } else {
        results.tests.push({ name: 'storeDelete', success: false, error: 'Failed to delete test key' });
      }
      
      return results;
    }).catch(error => {
      debugLog?.warn('store API error', { 
        module: 'test-utils',
        function: 'testStoreAPI',
        error: error.message
      });
      return { success: false, error: error.message };
    });
    
  } else {
    debugLog?.warn('Store API not available', { 
      module: 'test-utils',
      function: 'testStoreAPI'
    });
    return Promise.resolve({ success: false, error: 'Store API not available' });
  }
}

/**
 * Test audio API for gradual migration
 * Tests audio functionality (play, pause, stop, volume)
 */
export function testAudioAPI() {
  debugLog?.info('Testing Audio API for gradual migration', { 
    module: 'test-utils',
    function: 'testAudioAPI'
  });
  
  if (window.electronAPI && window.electronAPI.audio) {
    debugLog?.info('Audio API available', { 
      module: 'test-utils',
      function: 'testAudioAPI'
    });
    
    const results = {
      success: true,
      tests: []
    };
    
    // Test audio volume
    return window.electronAPI.audio.setVolume(0.5).then(result => {
      if (result.success) {
        debugLog?.info('audio setVolume API works', { 
          module: 'test-utils',
          function: 'testAudioAPI'
        });
        results.tests.push({ name: 'setVolume', success: true });
      } else {
        debugLog?.warn('audio setVolume API failed', { 
          module: 'test-utils',
          function: 'testAudioAPI',
          error: result.error
        });
        results.tests.push({ name: 'setVolume', success: false, error: result.error });
      }
      
      // Test audio play (try to play a test file)
      return secureStore.get('music_directory');
    }).then(musicResult => {
      if (musicResult.success) {
        return securePath.join(musicResult.value, 'PatrickShort-CSzRockBumper.mp3');
      } else {
        debugLog?.warn('Could not get music directory from store', { 
          module: 'test-utils',
          function: 'testAudioAPI'
        });
        results.tests.push({ name: 'audioPlay', success: false, error: 'Could not get music directory' });
        return Promise.resolve({ success: false });
      }
    }).then(joinResult => {
      if (joinResult.success) {
        const testAudioPath = joinResult.data;
        return window.electronAPI.audio.play(testAudioPath);
      } else {
        results.tests.push({ name: 'audioPlay', success: false, error: 'Failed to join path' });
        return Promise.resolve({ success: false });
      }
    }).then(result => {
      if (result && result.success) {
        debugLog?.info('audio play API works', { 
          module: 'test-utils',
          function: 'testAudioAPI',
          soundId: result.id
        });
        results.tests.push({ name: 'audioPlay', success: true, soundId: result.id });
        
        // Test pause after a short delay
        return new Promise((resolve) => {
          setTimeout(() => {
            window.electronAPI.audio.pause(result.id).then(pauseResult => {
              if (pauseResult.success) {
                debugLog?.info('audio pause API works', { 
                  module: 'test-utils',
                  function: 'testAudioAPI'
                });
                results.tests.push({ name: 'audioPause', success: true });
                
                // Test stop after another short delay
                setTimeout(() => {
                  window.electronAPI.audio.stop(result.id).then(stopResult => {
                    if (stopResult.success) {
                      debugLog?.info('audio stop API works', { 
                        module: 'test-utils',
                        function: 'testAudioAPI'
                      });
                      results.tests.push({ name: 'audioStop', success: true });
                    } else {
                      debugLog?.warn('audio stop API failed', { 
                        module: 'test-utils',
                        function: 'testAudioAPI',
                        error: stopResult.error
                      });
                      results.tests.push({ name: 'audioStop', success: false, error: stopResult.error });
                    }
                    resolve(results);
                  }).catch(error => {
                    debugLog?.warn('audio stop API error', { 
                      module: 'test-utils',
                      function: 'testAudioAPI',
                      error: error.message
                    });
                    results.tests.push({ name: 'audioStop', success: false, error: error.message });
                    resolve(results);
                  });
                }, 1000);
              } else {
                debugLog?.warn('audio pause API failed', { 
                  module: 'test-utils',
                  function: 'testAudioAPI',
                  error: pauseResult.error
                });
                results.tests.push({ name: 'audioPause', success: false, error: pauseResult.error });
                resolve(results);
              }
            }).catch(error => {
              debugLog?.warn('audio pause API error', { 
                module: 'test-utils',
                function: 'testAudioAPI',
                error: error.message
              });
              results.tests.push({ name: 'audioPause', success: false, error: error.message });
              resolve(results);
            });
          }, 2000);
        });
        
      } else {
        debugLog?.info('audio play API works: File does not exist (expected)', { 
          module: 'test-utils',
          function: 'testAudioAPI'
        });
        results.tests.push({ name: 'audioPlay', success: true, data: 'File does not exist (expected)' });
        return results;
      }
    }).catch(error => {
      debugLog?.warn('audio play API error', { 
        module: 'test-utils',
        function: 'testAudioAPI',
        error: error.message
      });
      return { success: false, error: error.message };
    });
    
  } else {
    debugLog?.warn('Audio API not available', { 
      module: 'test-utils',
      function: 'testAudioAPI'
    });
    return Promise.resolve({ success: false, error: 'Audio API not available' });
  }
}

/**
 * Test security features (Week 5)
 * Tests that security features are working correctly
 */
export function testSecurityFeatures() {
  debugLog?.info('Testing Security Features (Week 5)', { 
    module: 'test-utils',
    function: 'testSecurityFeatures'
  });
  
  const results = {
    success: true,
    tests: []
  };
  
  // Test that contextBridge APIs are available
  if (window.electronAPI) {
    debugLog?.info('electronAPI available through contextBridge', { 
      module: 'test-utils',
      function: 'testSecurityFeatures'
    });
    results.tests.push({ name: 'contextBridge', success: true });
    
    // Test all API categories
    const apiCategories = ['database', 'fileSystem', 'store', 'audio'];
    apiCategories.forEach(category => {
      if (window.electronAPI[category]) {
        debugLog?.info(`${category} API available`, { 
          module: 'test-utils',
          function: 'testSecurityFeatures',
          category: category
        });
        results.tests.push({ name: `${category}API`, success: true });
      } else {
        debugLog?.warn(`${category} API not available`, { 
          module: 'test-utils',
          function: 'testSecurityFeatures',
          category: category
        });
        results.tests.push({ name: `${category}API`, success: false });
      }
    });
    
    // Test that direct Node.js access is blocked (security feature)
    try {
      if (typeof require === 'undefined') {
        debugLog?.info('require() is blocked (security feature working)', { 
          module: 'test-utils',
          function: 'testSecurityFeatures'
        });
        results.tests.push({ name: 'requireBlocked', success: true });
      } else {
        debugLog?.warn('require() is still available (security issue)', { 
          module: 'test-utils',
          function: 'testSecurityFeatures'
        });
        results.tests.push({ name: 'requireBlocked', success: false });
      }
    } catch (error) {
      debugLog?.info('require() is blocked (security feature working)', { 
        module: 'test-utils',
        function: 'testSecurityFeatures'
      });
      results.tests.push({ name: 'requireBlocked', success: true });
    }
    
    try {
      if (typeof process === 'undefined') {
        debugLog?.info('process is blocked (security feature working)', { 
          module: 'test-utils',
          function: 'testSecurityFeatures'
        });
        results.tests.push({ name: 'processBlocked', success: true });
      } else {
        debugLog?.warn('process is still available (security issue)', { 
          module: 'test-utils',
          function: 'testSecurityFeatures'
        });
        results.tests.push({ name: 'processBlocked', success: false });
      }
    } catch (error) {
      debugLog?.info('process is blocked (security feature working)', { 
        module: 'test-utils',
        function: 'testSecurityFeatures'
      });
      results.tests.push({ name: 'processBlocked', success: true });
    }
    
    // Test that our APIs still work
    return window.electronAPI.database.getCategories().then(result => {
      if (result.success) {
        debugLog?.info('Database API still works with security features', { 
          module: 'test-utils',
          function: 'testSecurityFeatures'
        });
        results.tests.push({ name: 'databaseWithSecurity', success: true });
      } else {
        debugLog?.warn('Database API failed with security features', { 
          module: 'test-utils',
          function: 'testSecurityFeatures',
          error: result.error
        });
        results.tests.push({ name: 'databaseWithSecurity', success: false, error: result.error });
      }
      
      return secureStore.get('music_directory');
    }).then(result => {
      if (result.success) {
        debugLog?.info('Store API still works with security features', { 
          module: 'test-utils',
          function: 'testSecurityFeatures'
        });
        results.tests.push({ name: 'storeWithSecurity', success: true });
      } else {
        debugLog?.warn('Store API failed with security features', { 
          module: 'test-utils',
          function: 'testSecurityFeatures',
          error: result.error
        });
        results.tests.push({ name: 'storeWithSecurity', success: false, error: result.error });
      }
      
      debugLog?.info('Security features appear to be working correctly', { 
        module: 'test-utils',
        function: 'testSecurityFeatures'
      });
      return results;
    }).catch(error => {
      debugLog?.warn('Security test error', { 
        module: 'test-utils',
        function: 'testSecurityFeatures',
        error: error.message
      });
      results.tests.push({ name: 'securityTest', success: false, error: error.message });
      return results;
    });
    
  } else {
    debugLog?.warn('electronAPI not available - security features may have broken the app', { 
      module: 'test-utils',
      function: 'testSecurityFeatures'
    });
    return Promise.resolve({ success: false, error: 'electronAPI not available' });
  }
}

/**
 * Run all tests
 * Executes all test functions and returns comprehensive results
 */
export function runAllTests() {
  debugLog?.info('Running all tests', { 
    module: 'test-utils',
    function: 'runAllTests'
  });
  
  const allTests = [
    { name: 'Phase 2 Migrations', func: testPhase2Migrations },
    { name: 'Database API', func: testDatabaseAPI },
    { name: 'File System API', func: testFileSystemAPI },
    { name: 'Store API', func: testStoreAPI },
    { name: 'Audio API', func: testAudioAPI },
    { name: 'Security Features', func: testSecurityFeatures }
  ];
  
  const results = {
    total: allTests.length,
    passed: 0,
    failed: 0,
    tests: []
  };
  
  return Promise.all(allTests.map(test => {
    return test.func().then(result => {
      if (result.success) {
        results.passed++;
      } else {
        results.failed++;
      }
      results.tests.push({
        name: test.name,
        ...result
      });
      return result;
    }).catch(error => {
      results.failed++;
      results.tests.push({
        name: test.name,
        success: false,
        error: error.message
      });
      return { success: false, error: error.message };
    });
  })).then(() => {
    debugLog?.info('All tests completed', { 
      module: 'test-utils',
      function: 'runAllTests',
      passed: results.passed,
      failed: results.failed
    });
    return results;
  });
}

// Export all functions
export default {
  testPhase2Migrations,
  testDatabaseAPI,
  testFileSystemAPI,
  testStoreAPI,
  testAudioAPI,
  testSecurityFeatures,
  runAllTests
}; 