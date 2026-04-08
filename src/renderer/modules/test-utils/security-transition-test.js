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
} catch (_error) {
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

      debugLog.info('🔒 Testing Security Transition - Phase 3: Context Isolation...', { 
      module: 'test-utils', 
      function: 'testContextIsolation' 
    });

  // Test 1: Context Isolation Status
  try {
    // In context isolation mode, we should NOT have direct access to Node.js modules
    const hasDirectNodeAccess = !!(window.require || window.process || window.global);
    
    if (!hasDirectNodeAccess) {
      debugLog.info('✅ Context isolation is properly enabled - no direct Node.js access', { 
        module: 'test-utils', 
        function: 'testContextIsolation' 
      });
      results.passed++;
      results.tests.push({ name: 'contextIsolationEnabled', success: true });
    } else {
      debugLog.error('❌ Context isolation not properly enabled - direct Node.js access detected', { 
        module: 'test-utils', 
        function: 'testContextIsolation' 
      });
      results.failed++;
      results.tests.push({ name: 'contextIsolationEnabled', success: false, error: 'Direct Node.js access detected' });
      results.recommendations.push('Ensure contextIsolation: true in main process');
    }
      } catch (error) {
      debugLog.error('❌ Context isolation test failed', { 
        module: 'test-utils', 
        function: 'testContextIsolation',
        error: error.message 
      });
    results.failed++;
    results.tests.push({ name: 'contextIsolationEnabled', success: false, error: error.message });
  }

  // Test 2: Secure API Availability
  try {
    if (window.secureElectronAPI) {
      debugLog.info('✅ Secure Electron API available', { 
      module: 'test-utils', 
      function: 'testSecureAPI' 
    });
      results.passed++;
      results.tests.push({ name: 'secureAPIAvailable', success: true });
      
      // Test individual API modules
      const apiModules = ['database', 'fileSystem', 'path', 'store', 'audio'];
      apiModules.forEach(module => {
        if (window.secureElectronAPI[module]) {
          debugLog.info(`✅ ${module} API module available`, { 
          module: 'test-utils', 
          function: 'testSecureAPI',
          apiModule: module 
        });
          results.passed++;
          results.tests.push({ name: `${module}APIAvailable`, success: true });
        } else {
          debugLog.error(`❌ ${module} API module missing`, { 
          module: 'test-utils', 
          function: 'testSecureAPI',
          apiModule: module 
        });
          results.failed++;
          results.tests.push({ name: `${module}APIAvailable`, success: false, error: `${module} module not found` });
        }
      });
    } else {
      debugLog.error('❌ Secure Electron API not available', { 
        module: 'test-utils', 
        function: 'testSecureAPI' 
      });
      results.failed++;
      results.tests.push({ name: 'secureAPIAvailable', success: false, error: 'secureElectronAPI not found' });
      results.recommendations.push('Check preload script and contextBridge setup');
    }
      } catch (error) {
      debugLog.error('❌ Secure API test failed', { 
        module: 'test-utils', 
        function: 'testSecureAPI',
        error: error.message 
      });
    results.failed++;
    results.tests.push({ name: 'secureAPIAvailable', success: false, error: error.message });
  }

  // Test 3: Legacy API Cleanup
  try {
    const legacyAPIs = ['db', 'store', 'path', 'fs', 'homedir'];
    const legacyAPIsFound = legacyAPIs.filter(api => window[api]);
    
    if (legacyAPIsFound.length === 0) {
      debugLog.info('✅ All legacy APIs properly removed', { 
      module: 'test-utils', 
      function: 'testLegacyAPICleanup' 
    });
      results.passed++;
      results.tests.push({ name: 'legacyAPIsRemoved', success: true });
    } else {
              debugLog.warn(`⚠️ Legacy APIs still present: ${legacyAPIsFound.join(', ')}`, { 
          module: 'test-utils', 
          function: 'testLegacyAPICleanup',
          legacyAPIs: legacyAPIsFound 
        });
      results.warnings.push(`Legacy APIs found: ${legacyAPIsFound.join(', ')}`);
      results.tests.push({ name: 'legacyAPIsRemoved', success: false, error: `Legacy APIs: ${legacyAPIsFound.join(', ')}` });
      results.recommendations.push('Remove all legacy API assignments from preload script');
    }
      } catch (error) {
      debugLog.error('❌ Legacy API cleanup test failed', { 
        module: 'test-utils', 
        function: 'testLegacyAPICleanup',
        error: error.message 
      });
    results.failed++;
    results.tests.push({ name: 'legacyAPIsRemoved', success: false, error: error.message });
  }

  // Test 4: Modern API Fallback
  try {
    if (window.electronAPI) {
      debugLog.info('✅ Modern Electron API available as fallback', { 
        module: 'test-utils', 
        function: 'testModernAPIFallback' 
      });
      results.passed++;
      results.tests.push({ name: 'modernAPIFallback', success: true });
    } else {
      debugLog.warn('⚠️ Modern Electron API not available', { 
        module: 'test-utils', 
        function: 'testModernAPIFallback' 
      });
      results.warnings.push('Modern API fallback not available');
      results.tests.push({ name: 'modernAPIFallback', success: false, error: 'electronAPI not found' });
    }
  } catch (error) {
    debugLog.error('❌ Modern API fallback test failed', { 
      module: 'test-utils', 
      function: 'testModernAPIFallback',
      error: error.message 
    });
    results.failed++;
    results.tests.push({ name: 'modernAPIFallback', success: false, error: error.message });
  }

  // Test 5: IPC Communication
  try {
    if (window.secureElectronAPI?.database?.query) {
      debugLog.info('✅ IPC communication test - database.query available', { 
        module: 'test-utils', 
        function: 'testIPCCommunication' 
      });
      results.passed++;
      results.tests.push({ name: 'ipcCommunication', success: true });
    } else {
      debugLog.error('❌ IPC communication test failed - database.query not available', { 
        module: 'test-utils', 
        function: 'testIPCCommunication' 
      });
      results.failed++;
      results.tests.push({ name: 'ipcCommunication', success: false, error: 'database.query not available' });
      results.recommendations.push('Check IPC handler registration in main process');
    }
  } catch (error) {
    debugLog.error('❌ IPC communication test failed', { 
      module: 'test-utils', 
      function: 'testIPCCommunication',
      error: error.message 
    });
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
          debugLog.info(`✅ ${securityTest.name} - properly secured`, { 
            module: 'test-utils', 
            function: 'testSecurityFeatures',
            testName: securityTest.name 
          });
          results.passed++;
          results.tests.push({ name: securityTest.name, success: true });
        } else {
          debugLog.error(`❌ ${securityTest.name} - security vulnerability detected`, { 
            module: 'test-utils', 
            function: 'testSecurityFeatures',
            testName: securityTest.name 
          });
          results.failed++;
          results.tests.push({ name: securityTest.name, success: false, error: 'Security vulnerability detected' });
        }
      } catch (_error) {
        debugLog.info(`✅ ${securityTest.name} - properly secured (error thrown)`, { 
          module: 'test-utils', 
          function: 'testSecurityFeatures',
          testName: securityTest.name 
        });
        results.passed++;
        results.tests.push({ name: securityTest.name, success: true });
      }
    });
  } catch (error) {
    debugLog.error('❌ Security features test failed', { 
      module: 'test-utils', 
      function: 'testSecurityFeatures',
      error: error.message 
    });
    results.failed++;
    results.tests.push({ name: 'securityFeatures', success: false, error: error.message });
  }

  // Generate summary and recommendations
  const totalTests = results.passed + results.failed;
  const successRate = totalTests > 0 ? Math.round((results.passed / totalTests) * 100) : 0;
  
  debugLog.info(`📊 Security Transition Test Results: ${results.passed}/${totalTests} passed (${successRate}%)`, { 
    module: 'test-utils', 
    function: 'generateSummary',
    passed: results.passed,
    total: totalTests,
    successRate: successRate 
  });
  
  if (results.failed > 0) {
    debugLog.error('❌ Some tests failed. Please review the recommendations below', { 
      module: 'test-utils', 
      function: 'generateSummary',
      failedCount: results.failed,
      recommendations: results.recommendations 
    });
    results.recommendations.forEach(rec => debugLog.error(`   • ${rec}`, { 
      module: 'test-utils', 
      function: 'generateSummary' 
    }));
  }
  
  if (results.warnings.length > 0) {
    debugLog.warn('⚠️ Warnings detected', { 
      module: 'test-utils', 
      function: 'generateSummary',
      warningCount: results.warnings.length,
      warnings: results.warnings 
    });
    results.warnings.forEach(warning => debugLog.warn(`   • ${warning}`, { 
      module: 'test-utils', 
      function: 'generateSummary' 
    }));
  }

  if (results.passed === totalTests && totalTests > 0) {
    debugLog.info('🎉 All security transition tests passed! Context isolation is properly enabled.', { 
      module: 'test-utils', 
      function: 'generateSummary',
      passed: results.passed,
      total: totalTests 
    });
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

  debugLog.info(`🧪 Testing ${apiName} API functionality...`, { 
    module: 'test-utils', 
    function: 'testSpecificAPI',
    apiName: apiName 
  });

  try {
    if (!window.secureElectronAPI || !window.secureElectronAPI[apiName]) {
      throw new Error(`${apiName} API not available`);
    }

    const api = window.secureElectronAPI[apiName];
    const methods = Object.getOwnPropertyNames(api).filter(name => typeof api[name] === 'function');

    methods.forEach(method => {
      try {
        if (typeof api[method] === 'function') {
          debugLog.info(`✅ ${apiName}.${method} method available`, { 
            module: 'test-utils', 
            function: 'testSpecificAPI',
            apiName: apiName,
            method: method 
          });
          results.passed++;
          results.tests.push({ name: `${apiName}.${method}`, success: true });
        } else {
          debugLog.error(`❌ ${apiName}.${method} is not a function`, { 
            module: 'test-utils', 
            function: 'testSpecificAPI',
            apiName: apiName,
            method: method 
          });
          results.failed++;
          results.tests.push({ name: `${apiName}.${method}`, success: false, error: 'Not a function' });
        }
      } catch (error) {
        debugLog.error(`❌ ${apiName}.${method} test failed`, { 
          module: 'test-utils', 
          function: 'testSpecificAPI',
          apiName: apiName,
          method: method,
          error: error.message 
        });
        results.failed++;
        results.tests.push({ name: `${apiName}.${method}`, success: false, error: error.message });
      }
    });

  } catch (error) {
    debugLog.error(`❌ ${apiName} API test failed`, { 
      module: 'test-utils', 
      function: 'testSpecificAPI',
      apiName: apiName,
      error: error.message 
    });
    results.errors.push(error.message);
  }

  debugLog.info(`📊 ${apiName} API Test Results: ${results.passed} passed, ${results.failed} failed`, { 
    module: 'test-utils', 
    function: 'testSpecificAPI',
    apiName: apiName,
    passed: results.passed,
    failed: results.failed 
  });
  return results;
}

// Export test functions
export default {
  testSecurityTransition,
  testSpecificAPI
};
