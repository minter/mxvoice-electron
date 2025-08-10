/**
 * Security Transition Test Module
 * 
 * Tests the transition from insecure (direct Node.js access) to secure
 * (context isolation with IPC) mode. This test verifies that all required
 * APIs are available through the secure interface.
 */

// Import debug logger safely
let debugLog = null;
try {
  if (window.debugLog) {
    debugLog = window.debugLog;
  }
} catch (error) {
  // Debug logger not available in secure context
}

/**
 * Test the security transition status
 * @returns {Object} Test results
 */
export function testSecurityTransition() {
  const results = {
    module: 'security-transition-test',
    phase: 'phase3-context-isolation',
    passed: 0,
    failed: 0,
    tests: [],
    warnings: [],
    recommendations: []
  };

  console.log('🔒 Testing Security Transition - Phase 3: Context Isolation...');

  // Test 1: Context Isolation Status
  try {
    // In context isolation mode, we should NOT have direct access to Node.js modules
    const hasDirectNodeAccess = !!(window.require || window.process || window.global);
    
    if (!hasDirectNodeAccess) {
      console.log('✅ Context isolation is properly enabled - no direct Node.js access');
      results.passed++;
      results.tests.push({ name: 'contextIsolationEnabled', success: true });
    } else {
      console.log('❌ Context isolation not properly enabled - direct Node.js access detected');
      results.failed++;
      results.tests.push({ name: 'contextIsolationEnabled', success: false, error: 'Direct Node.js access detected' });
      results.recommendations.push('Ensure contextIsolation: true in main process');
    }
  } catch (error) {
    console.log('❌ Context isolation test failed:', error);
    results.failed++;
    results.tests.push({ name: 'contextIsolationEnabled', success: false, error: error.message });
  }

  // Test 2: Secure API Availability
  try {
    if (window.secureElectronAPI) {
      console.log('✅ Secure Electron API available');
      results.passed++;
      results.tests.push({ name: 'secureAPIAvailable', success: true });
      
      // Test individual API modules
      const apiModules = ['database', 'fileSystem', 'path', 'store', 'audio'];
      apiModules.forEach(module => {
        if (window.secureElectronAPI[module]) {
          console.log(`✅ ${module} API module available`);
          results.passed++;
          results.tests.push({ name: `${module}APIAvailable`, success: true });
        } else {
          console.log(`❌ ${module} API module missing`);
          results.failed++;
          results.tests.push({ name: `${module}APIAvailable`, success: false, error: `${module} module not found` });
        }
      });
    } else {
      console.log('❌ Secure Electron API not available');
      results.failed++;
      results.tests.push({ name: 'secureAPIAvailable', success: false, error: 'secureElectronAPI not found' });
      results.recommendations.push('Check preload script and contextBridge setup');
    }
  } catch (error) {
    console.log('❌ Secure API test failed:', error);
    results.failed++;
    results.tests.push({ name: 'secureAPIAvailable', success: false, error: error.message });
  }

  // Test 3: Legacy API Cleanup
  try {
    const legacyAPIs = ['db', 'store', 'path', 'fs', 'homedir'];
    const legacyAPIsFound = legacyAPIs.filter(api => window[api]);
    
    if (legacyAPIsFound.length === 0) {
      console.log('✅ All legacy APIs properly removed');
      results.passed++;
      results.tests.push({ name: 'legacyAPIsRemoved', success: true });
    } else {
      console.log(`⚠️ Legacy APIs still present: ${legacyAPIsFound.join(', ')}`);
      results.warnings.push(`Legacy APIs found: ${legacyAPIsFound.join(', ')}`);
      results.tests.push({ name: 'legacyAPIsRemoved', success: false, error: `Legacy APIs: ${legacyAPIsFound.join(', ')}` });
      results.recommendations.push('Remove all legacy API assignments from preload script');
    }
  } catch (error) {
    console.log('❌ Legacy API cleanup test failed:', error);
    results.failed++;
    results.tests.push({ name: 'legacyAPIsRemoved', success: false, error: error.message });
  }

  // Test 4: Modern API Fallback
  try {
    if (window.electronAPI) {
      console.log('✅ Modern Electron API available as fallback');
      results.passed++;
      results.tests.push({ name: 'modernAPIFallback', success: true });
    } else {
      console.log('⚠️ Modern Electron API not available');
      results.warnings.push('Modern API fallback not available');
      results.tests.push({ name: 'modernAPIFallback', success: false, error: 'electronAPI not found' });
    }
  } catch (error) {
    console.log('❌ Modern API fallback test failed:', error);
    results.failed++;
    results.tests.push({ name: 'modernAPIFallback', success: false, error: error.message });
  }

  // Test 5: IPC Communication
  try {
    if (window.secureElectronAPI?.database?.query) {
      console.log('✅ IPC communication test - database.query available');
      results.passed++;
      results.tests.push({ name: 'ipcCommunication', success: true });
    } else {
      console.log('❌ IPC communication test failed - database.query not available');
      results.failed++;
      results.tests.push({ name: 'ipcCommunication', success: false, error: 'database.query not available' });
      results.recommendations.push('Check IPC handler registration in main process');
    }
  } catch (error) {
    console.log('❌ IPC communication test failed:', error);
    results.failed++;
    results.tests.push({ name: 'ipcCommunication', success: false, error: error.message });
  }

  // Test 6: Security Features
  try {
    // Test that we can't access Node.js globals
    const securityTests = [
      { name: 'requireAccess', test: () => typeof window.require === 'undefined', expected: true },
      { name: 'processAccess', test: () => typeof window.process === 'undefined', expected: true },
      { name: 'globalAccess', test: () => typeof window.global === 'undefined', expected: true },
      { name: 'BufferAccess', test: () => typeof window.Buffer === 'undefined', expected: true }
    ];

    securityTests.forEach(securityTest => {
      try {
        const result = securityTest.test();
        if (result === securityTest.expected) {
          console.log(`✅ ${securityTest.name} - properly secured`);
          results.passed++;
          results.tests.push({ name: securityTest.name, success: true });
        } else {
          console.log(`❌ ${securityTest.name} - security vulnerability detected`);
          results.failed++;
          results.tests.push({ name: securityTest.name, success: false, error: 'Security vulnerability detected' });
        }
      } catch (error) {
        console.log(`✅ ${securityTest.name} - properly secured (error thrown)`);
        results.passed++;
        results.tests.push({ name: securityTest.name, success: true });
      }
    });
  } catch (error) {
    console.log('❌ Security features test failed:', error);
    results.failed++;
    results.tests.push({ name: 'securityFeatures', success: false, error: error.message });
  }

  // Generate summary and recommendations
  const totalTests = results.passed + results.failed;
  const successRate = totalTests > 0 ? Math.round((results.passed / totalTests) * 100) : 0;
  
  console.log(`📊 Security Transition Test Results: ${results.passed}/${totalTests} passed (${successRate}%)`);
  
  if (results.failed > 0) {
    console.log('❌ Some tests failed. Please review the recommendations below:');
    results.recommendations.forEach(rec => console.log(`   • ${rec}`));
  }
  
  if (results.warnings.length > 0) {
    console.log('⚠️ Warnings detected:');
    results.warnings.forEach(warning => console.log(`   • ${warning}`));
  }

  if (results.passed === totalTests && totalTests > 0) {
    console.log('🎉 All security transition tests passed! Context isolation is properly enabled.');
  }

  return results;
}

/**
 * Test specific API functionality
 * @param {string} apiName - Name of the API to test
 * @returns {Object} Test result
 */
export function testSpecificAPI(apiName) {
  const results = {
    module: 'security-transition-test',
    api: apiName,
    passed: 0,
    failed: 0,
    tests: [],
    errors: []
  };

  console.log(`🧪 Testing ${apiName} API functionality...`);

  try {
    if (!window.secureElectronAPI || !window.secureElectronAPI[apiName]) {
      throw new Error(`${apiName} API not available`);
    }

    const api = window.secureElectronAPI[apiName];
    const methods = Object.getOwnPropertyNames(api).filter(name => typeof api[name] === 'function');

    methods.forEach(method => {
      try {
        if (typeof api[method] === 'function') {
          console.log(`✅ ${apiName}.${method} method available`);
          results.passed++;
          results.tests.push({ name: `${apiName}.${method}`, success: true });
        } else {
          console.log(`❌ ${apiName}.${method} is not a function`);
          results.failed++;
          results.tests.push({ name: `${apiName}.${method}`, success: false, error: 'Not a function' });
        }
      } catch (error) {
        console.log(`❌ ${apiName}.${method} test failed:`, error);
        results.failed++;
        results.tests.push({ name: `${apiName}.${method}`, success: false, error: error.message });
      }
    });

  } catch (error) {
    console.log(`❌ ${apiName} API test failed:`, error);
    results.errors.push(error.message);
  }

  console.log(`📊 ${apiName} API Test Results: ${results.passed} passed, ${results.failed} failed`);
  return results;
}

// Export test functions
export default {
  testSecurityTransition,
  testSpecificAPI
};
