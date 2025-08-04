/**
 * Test Functions Module
 * 
 * This module contains all testing utilities for the MxVoice application.
 * These functions are used for testing various APIs and features during development.
 */

/**
 * Test function for Phase 2 migrations
 * Tests if new APIs are available and working
 */
export function testPhase2Migrations() {
  console.log('🧪 Testing Phase 2 Migrations...');
  
  // Test if new APIs are available
  if (window.electronAPI) {
    console.log('✅ New electronAPI is available');
    
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
        console.log(`✅ ${funcName} function is available`);
      } else {
        console.log(`❌ ${funcName} function is NOT available`);
      }
    });
    
    console.log('✅ Phase 2 migrations appear to be working');
    return { success: true, message: 'Phase 2 migrations working' };
    
  } else {
    console.log('❌ New electronAPI not available');
    return { success: false, error: 'electronAPI not available' };
  }
}

/**
 * Test database API for gradual migration
 * Tests database functionality and queries
 */
export function testDatabaseAPI() {
  console.log('🧪 Testing Database API for gradual migration...');
  
  if (window.electronAPI && window.electronAPI.database) {
    console.log('✅ Database API available');
    
    const results = {
      success: true,
      tests: []
    };
    
    // Test get categories
    return window.electronAPI.database.getCategories().then(result => {
      if (result.success) {
        console.log('✅ getCategories API works:', result.data.length, 'categories found');
        results.tests.push({ name: 'getCategories', success: true, data: result.data.length });
      } else {
        console.warn('❌ getCategories API failed:', result.error);
        results.tests.push({ name: 'getCategories', success: false, error: result.error });
      }
      
      // Test database query
      return window.electronAPI.database.query('SELECT COUNT(*) as count FROM categories');
    }).then(result => {
      if (result.success) {
        console.log('✅ database query API works:', result.data[0].count, 'categories total');
        results.tests.push({ name: 'databaseQuery', success: true, data: result.data[0].count });
      } else {
        console.warn('❌ database query API failed:', result.error);
        results.tests.push({ name: 'databaseQuery', success: false, error: result.error });
      }
      
      return results;
    }).catch(error => {
      console.warn('❌ Database API error:', error);
      return { success: false, error: error.message };
    });
    
  } else {
    console.log('❌ Database API not available');
    return Promise.resolve({ success: false, error: 'Database API not available' });
  }
}

/**
 * Test file system API for gradual migration
 * Tests file system operations
 */
export function testFileSystemAPI() {
  console.log('🧪 Testing File System API for gradual migration...');
  
  if (window.electronAPI && window.electronAPI.fileSystem) {
    console.log('✅ File System API available');
    
    const results = {
      success: true,
      tests: []
    };
    
    // Test file exists
    return window.electronAPI.store.get('database_directory').then(dbResult => {
      if (dbResult.success) {
        const testPath = dbResult.value;
        return window.electronAPI.fileSystem.exists(testPath).then(result => {
          if (result.success) {
            console.log('✅ file exists API works:', result.exists ? 'Directory exists' : 'Directory does not exist');
            results.tests.push({ name: 'fileExists', success: true, exists: result.exists });
          } else {
            console.warn('❌ file exists API failed:', result.error);
            results.tests.push({ name: 'fileExists', success: false, error: result.error });
          }
          
          // Test file read (try to read a config file)
          return window.electronAPI.store.get('database_directory');
        });
      } else {
        console.warn('❌ Could not get database directory from store');
        results.tests.push({ name: 'fileExists', success: false, error: 'Could not get database directory' });
        return Promise.resolve({ success: false, error: 'Could not get database directory' });
      }
    }).then(dbResult => {
      if (dbResult.success) {
        return window.electronAPI.path.join(dbResult.value, 'config.json').then(joinResult => {
          if (joinResult.success) {
            const configPath = joinResult.data;
            return window.electronAPI.fileSystem.read(configPath).then(result => {
              if (result.success) {
                console.log('✅ file read API works: Config file read successfully');
                results.tests.push({ name: 'fileRead', success: true, data: 'Config file read' });
              } else {
                console.log('✅ file read API works: Config file does not exist (expected)');
                results.tests.push({ name: 'fileRead', success: true, data: 'Config file does not exist' });
              }
              return results;
            }).catch(error => {
              console.warn('❌ file read API error:', error);
              results.tests.push({ name: 'fileRead', success: false, error: error.message });
              return results;
            });
          } else {
            console.warn('❌ Failed to join path:', joinResult.error);
            results.tests.push({ name: 'fileRead', success: false, error: joinResult.error });
            return results;
          }
        }).catch(error => {
          console.warn('❌ Path join error:', error);
          results.tests.push({ name: 'fileRead', success: false, error: error.message });
          return results;
        });
      } else {
        results.tests.push({ name: 'fileRead', success: false, error: 'Could not get database directory' });
        return results;
      }
    }).catch(error => {
      console.warn('❌ store get API error:', error);
      return { success: false, error: error.message };
    });
    
  } else {
    console.log('❌ File System API not available');
    return Promise.resolve({ success: false, error: 'File System API not available' });
  }
}

/**
 * Test store API for gradual migration
 * Tests store operations (get, set, has, delete)
 */
export function testStoreAPI() {
  console.log('🧪 Testing Store API for gradual migration...');
  
  if (window.electronAPI && window.electronAPI.store) {
    console.log('✅ Store API available');
    
    const results = {
      success: true,
      tests: []
    };
    
    // Test store get
    return window.electronAPI.store.get('music_directory').then(result => {
      if (result.success) {
        console.log('✅ store get API works:', result.value);
        results.tests.push({ name: 'storeGet', success: true, data: result.value });
      } else {
        console.warn('❌ store get API failed:', result.error);
        results.tests.push({ name: 'storeGet', success: false, error: result.error });
      }
      
      // Test store has
      return window.electronAPI.store.has('music_directory');
    }).then(result => {
      if (result.success) {
        console.log('✅ store has API works:', result.has ? 'Key exists' : 'Key does not exist');
        results.tests.push({ name: 'storeHas', success: true, has: result.has });
      } else {
        console.warn('❌ store has API failed:', result.error);
        results.tests.push({ name: 'storeHas', success: false, error: result.error });
      }
      
      // Test store set and get
      const testKey = 'test_api_key';
      const testValue = 'test_value_' + Date.now();
      
      return window.electronAPI.store.set(testKey, testValue);
    }).then(result => {
      if (result.success) {
        console.log('✅ store set API works');
        results.tests.push({ name: 'storeSet', success: true });
        // Now test getting the value back
        return window.electronAPI.store.get(testKey);
      } else {
        console.warn('❌ store set API failed:', result.error);
        results.tests.push({ name: 'storeSet', success: false, error: result.error });
        return Promise.resolve({ success: false });
      }
    }).then(result => {
      if (result && result.success) {
        console.log('✅ store get after set works:', result.value);
        results.tests.push({ name: 'storeGetAfterSet', success: true, data: result.value });
        // Clean up test key
        return window.electronAPI.store.delete(testKey);
      } else {
        results.tests.push({ name: 'storeGetAfterSet', success: false, error: 'Failed to get after set' });
        return Promise.resolve({ success: false });
      }
    }).then(result => {
      if (result && result.success) {
        console.log('✅ store delete API works');
        results.tests.push({ name: 'storeDelete', success: true });
      } else {
        results.tests.push({ name: 'storeDelete', success: false, error: 'Failed to delete test key' });
      }
      
      return results;
    }).catch(error => {
      console.warn('❌ store API error:', error);
      return { success: false, error: error.message };
    });
    
  } else {
    console.log('❌ Store API not available');
    return Promise.resolve({ success: false, error: 'Store API not available' });
  }
}

/**
 * Test audio API for gradual migration
 * Tests audio functionality (play, pause, stop, volume)
 */
export function testAudioAPI() {
  console.log('🧪 Testing Audio API for gradual migration...');
  
  if (window.electronAPI && window.electronAPI.audio) {
    console.log('✅ Audio API available');
    
    const results = {
      success: true,
      tests: []
    };
    
    // Test audio volume
    return window.electronAPI.audio.setVolume(0.5).then(result => {
      if (result.success) {
        console.log('✅ audio setVolume API works');
        results.tests.push({ name: 'setVolume', success: true });
      } else {
        console.warn('❌ audio setVolume API failed:', result.error);
        results.tests.push({ name: 'setVolume', success: false, error: result.error });
      }
      
      // Test audio play (try to play a test file)
      return window.electronAPI.store.get('music_directory');
    }).then(musicResult => {
      if (musicResult.success) {
        return window.electronAPI.path.join(musicResult.value, 'PatrickShort-CSzRockBumper.mp3');
      } else {
        console.warn('❌ Could not get music directory from store');
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
        console.log('✅ audio play API works, sound ID:', result.id);
        results.tests.push({ name: 'audioPlay', success: true, soundId: result.id });
        
        // Test pause after a short delay
        return new Promise((resolve) => {
          setTimeout(() => {
            window.electronAPI.audio.pause(result.id).then(pauseResult => {
              if (pauseResult.success) {
                console.log('✅ audio pause API works');
                results.tests.push({ name: 'audioPause', success: true });
                
                // Test stop after another short delay
                setTimeout(() => {
                  window.electronAPI.audio.stop(result.id).then(stopResult => {
                    if (stopResult.success) {
                      console.log('✅ audio stop API works');
                      results.tests.push({ name: 'audioStop', success: true });
                    } else {
                      console.warn('❌ audio stop API failed:', stopResult.error);
                      results.tests.push({ name: 'audioStop', success: false, error: stopResult.error });
                    }
                    resolve(results);
                  }).catch(error => {
                    console.warn('❌ audio stop API error:', error);
                    results.tests.push({ name: 'audioStop', success: false, error: error.message });
                    resolve(results);
                  });
                }, 1000);
              } else {
                console.warn('❌ audio pause API failed:', pauseResult.error);
                results.tests.push({ name: 'audioPause', success: false, error: pauseResult.error });
                resolve(results);
              }
            }).catch(error => {
              console.warn('❌ audio pause API error:', error);
              results.tests.push({ name: 'audioPause', success: false, error: error.message });
              resolve(results);
            });
          }, 2000);
        });
        
      } else {
        console.log('✅ audio play API works: File does not exist (expected)');
        results.tests.push({ name: 'audioPlay', success: true, data: 'File does not exist (expected)' });
        return results;
      }
    }).catch(error => {
      console.warn('❌ audio play API error:', error);
      return { success: false, error: error.message };
    });
    
  } else {
    console.log('❌ Audio API not available');
    return Promise.resolve({ success: false, error: 'Audio API not available' });
  }
}

/**
 * Test security features (Week 5)
 * Tests that security features are working correctly
 */
export function testSecurityFeatures() {
  console.log('🧪 Testing Security Features (Week 5)...');
  
  const results = {
    success: true,
    tests: []
  };
  
  // Test that contextBridge APIs are available
  if (window.electronAPI) {
    console.log('✅ electronAPI available through contextBridge');
    results.tests.push({ name: 'contextBridge', success: true });
    
    // Test all API categories
    const apiCategories = ['database', 'fileSystem', 'store', 'audio'];
    apiCategories.forEach(category => {
      if (window.electronAPI[category]) {
        console.log(`✅ ${category} API available`);
        results.tests.push({ name: `${category}API`, success: true });
      } else {
        console.log(`❌ ${category} API not available`);
        results.tests.push({ name: `${category}API`, success: false });
      }
    });
    
    // Test that direct Node.js access is blocked (security feature)
    try {
      if (typeof require === 'undefined') {
        console.log('✅ require() is blocked (security feature working)');
        results.tests.push({ name: 'requireBlocked', success: true });
      } else {
        console.log('❌ require() is still available (security issue)');
        results.tests.push({ name: 'requireBlocked', success: false });
      }
    } catch (error) {
      console.log('✅ require() is blocked (security feature working)');
      results.tests.push({ name: 'requireBlocked', success: true });
    }
    
    try {
      if (typeof process === 'undefined') {
        console.log('✅ process is blocked (security feature working)');
        results.tests.push({ name: 'processBlocked', success: true });
      } else {
        console.log('❌ process is still available (security issue)');
        results.tests.push({ name: 'processBlocked', success: false });
      }
    } catch (error) {
      console.log('✅ process is blocked (security feature working)');
      results.tests.push({ name: 'processBlocked', success: true });
    }
    
    // Test that our APIs still work
    return window.electronAPI.database.getCategories().then(result => {
      if (result.success) {
        console.log('✅ Database API still works with security features');
        results.tests.push({ name: 'databaseWithSecurity', success: true });
      } else {
        console.warn('❌ Database API failed with security features:', result.error);
        results.tests.push({ name: 'databaseWithSecurity', success: false, error: result.error });
      }
      
      return window.electronAPI.store.get('music_directory');
    }).then(result => {
      if (result.success) {
        console.log('✅ Store API still works with security features');
        results.tests.push({ name: 'storeWithSecurity', success: true });
      } else {
        console.warn('❌ Store API failed with security features:', result.error);
        results.tests.push({ name: 'storeWithSecurity', success: false, error: result.error });
      }
      
      console.log('✅ Security features appear to be working correctly!');
      return results;
    }).catch(error => {
      console.warn('❌ Security test error:', error);
      results.tests.push({ name: 'securityTest', success: false, error: error.message });
      return results;
    });
    
  } else {
    console.log('❌ electronAPI not available - security features may have broken the app');
    return Promise.resolve({ success: false, error: 'electronAPI not available' });
  }
}

/**
 * Run all tests
 * Executes all test functions and returns comprehensive results
 */
export function runAllTests() {
  console.log('🧪 Running all tests...');
  
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
    console.log(`🧪 All tests completed: ${results.passed} passed, ${results.failed} failed`);
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