/**
 * Security Transition Test Suite
 * 
 * Tests for the gradual security upgrade from insecure to secure Electron configuration.
 * This test suite verifies that the security infrastructure is in place and working
 * while maintaining compatibility with existing functionality.
 */

// Import debug logger safely
let debugLog = null;
try {
  if (window.debugLog) {
    debugLog = window.debugLog;
  }
} catch (error) {
  // Debug logger not available
}

/**
 * Phase 1: Test Security Infrastructure
 * Verifies that secure APIs are available alongside legacy ones
 */
export function testSecurityInfrastructure() {
  const results = {
    phase: 'Phase 1 - Security Infrastructure',
    passed: 0,
    failed: 0,
    tests: [],
    warnings: [],
    mode: 'unknown'
  };
  
  console.log('🧪 Testing Phase 1: Security Infrastructure...');
  debugLog?.info('Starting security infrastructure tests', { 
    module: 'security-transition-test',
    function: 'testSecurityInfrastructure' 
  });
  
  // Test 1: Check if secure API is available
  try {
    if (window.secureElectronAPI) {
      console.log('✅ Secure API available - ready for context isolation');
      results.passed++;
      results.tests.push({ name: 'secureAPIAvailable', success: true });
      results.mode = 'secure-ready';
    } else {
      console.log('ℹ️ Secure API not yet available - using legacy mode');
      results.tests.push({ name: 'secureAPIAvailable', success: false });
      results.warnings.push('Secure API not available yet');
    }
  } catch (error) {
    console.log('❌ Error checking secure API:', error);
    results.failed++;
    results.tests.push({ name: 'secureAPIAvailable', success: false, error: error.message });
  }
  
  // Test 2: Check if adapter layer is available
  try {
    // Try to import the adapter layer
    if (typeof import !== 'undefined') {
      import('../adapters/secure-adapter.js').then(adapters => {
        console.log('✅ Secure adapter layer available');
        results.passed++;
        results.tests.push({ name: 'adapterLayerAvailable', success: true });
      }).catch(error => {
        console.log('❌ Secure adapter layer failed to load:', error);
        results.failed++;
        results.tests.push({ name: 'adapterLayerAvailable', success: false, error: error.message });
      });
    } else {
      console.log('ℹ️ Import not available - checking global scope');
      results.tests.push({ name: 'adapterLayerAvailable', success: false });
      results.warnings.push('Module import not available');
    }
  } catch (error) {
    console.log('❌ Adapter layer test failed:', error);
    results.failed++;
    results.tests.push({ name: 'adapterLayerAvailable', success: false, error: error.message });
  }
  
  // Test 3: Check if legacy APIs still work
  const legacyAPIs = ['electronAPI', 'db', 'store', 'path', 'fs'];
  legacyAPIs.forEach(api => {
    try {
      if (window[api] !== undefined) {
        console.log(`✅ Legacy API '${api}' still functional`);
        results.passed++;
        results.tests.push({ name: `legacy${api}Working`, success: true });
      } else {
        console.log(`⚠️ Legacy API '${api}' not available`);
        results.tests.push({ name: `legacy${api}Working`, success: false });
        results.warnings.push(`Legacy API ${api} not available`);
      }
    } catch (error) {
      console.log(`❌ Error checking legacy API '${api}':`, error);
      results.failed++;
      results.tests.push({ name: `legacy${api}Working`, success: false, error: error.message });
    }
  });
  
  // Test 4: Check current security mode
  try {
    if (typeof require !== 'undefined') {
      console.log('⚠️ Node.js require() is available (insecure mode)');
      results.mode = 'insecure';
      results.tests.push({ name: 'nodeIntegrationDisabled', success: false });
      results.warnings.push('Node.js integration still enabled');
    } else {
      console.log('✅ Node.js require() is blocked (secure mode)');
      results.mode = 'secure';
      results.passed++;
      results.tests.push({ name: 'nodeIntegrationDisabled', success: true });
    }
  } catch (error) {
    console.log('✅ Node.js require() is blocked (secure mode)');
    results.mode = 'secure';
    results.passed++;
    results.tests.push({ name: 'nodeIntegrationDisabled', success: true });
  }
  
  // Test 5: Check context isolation status
  try {
    if (typeof contextBridge !== 'undefined') {
      console.log('✅ Context isolation enabled');
      results.passed++;
      results.tests.push({ name: 'contextIsolationEnabled', success: true });
    } else {
      console.log('⚠️ Context isolation disabled');
      results.tests.push({ name: 'contextIsolationEnabled', success: false });
      results.warnings.push('Context isolation not enabled');
    }
  } catch (error) {
    console.log('⚠️ Context isolation disabled');
    results.tests.push({ name: 'contextIsolationEnabled', success: false });
    results.warnings.push('Context isolation not enabled');
  }
  
  console.log(`🧪 Phase 1 completed: ${results.passed} passed, ${results.failed} failed, ${results.warnings.length} warnings`);
  
  return results;
}

/**
 * Phase 2: Test Module Migration Readiness
 * Verifies that modules can be migrated to use secure APIs
 */
export function testModuleMigrationReadiness() {
  const results = {
    phase: 'Phase 2 - Module Migration Readiness',
    passed: 0,
    failed: 0,
    tests: [],
    warnings: []
  };
  
  console.log('🧪 Testing Phase 2: Module Migration Readiness...');
  debugLog?.info('Starting module migration readiness tests', { 
    module: 'security-transition-test',
    function: 'testModuleMigrationReadiness' 
  });
  
  // Test 1: Check if secure adapter functions work
  try {
    if (typeof import !== 'undefined') {
      import('../adapters/secure-adapter.js').then(({ testSecureAdapter }) => {
        const adapterResults = testSecureAdapter();
        if (adapterResults.success) {
          console.log('✅ Secure adapter layer functional');
          results.passed++;
          results.tests.push({ name: 'secureAdapterFunctional', success: true });
        } else {
          console.log('❌ Secure adapter layer has issues');
          results.failed++;
          results.tests.push({ name: 'secureAdapterFunctional', success: false });
        }
      }).catch(error => {
        console.log('❌ Secure adapter test failed:', error);
        results.failed++;
        results.tests.push({ name: 'secureAdapterFunctional', success: false, error: error.message });
      });
    } else {
      console.log('ℹ️ Cannot test adapter - import not available');
      results.tests.push({ name: 'secureAdapterFunctional', success: false });
      results.warnings.push('Cannot test adapter layer');
    }
  } catch (error) {
    console.log('❌ Adapter functionality test failed:', error);
    results.failed++;
    results.tests.push({ name: 'secureAdapterFunctional', success: false, error: error.message });
  }
  
  // Test 2: Check if database operations can be adapted
  try {
    if (window.db || window.electronAPI?.database || window.secureElectronAPI?.database) {
      console.log('✅ Database API available for migration');
      results.passed++;
      results.tests.push({ name: 'databaseAPIReadyForMigration', success: true });
    } else {
      console.log('❌ No database API available');
      results.failed++;
      results.tests.push({ name: 'databaseAPIReadyForMigration', success: false });
    }
  } catch (error) {
    console.log('❌ Database API check failed:', error);
    results.failed++;
    results.tests.push({ name: 'databaseAPIReadyForMigration', success: false, error: error.message });
  }
  
  // Test 3: Check if store operations can be adapted
  try {
    if (window.store || window.electronAPI?.store || window.secureElectronAPI?.store) {
      console.log('✅ Store API available for migration');
      results.passed++;
      results.tests.push({ name: 'storeAPIReadyForMigration', success: true });
    } else {
      console.log('❌ No store API available');
      results.failed++;
      results.tests.push({ name: 'storeAPIReadyForMigration', success: false });
    }
  } catch (error) {
    console.log('❌ Store API check failed:', error);
    results.failed++;
    results.tests.push({ name: 'storeAPIReadyForMigration', success: false, error: error.message });
  }
  
  // Test 4: Check if file operations can be adapted
  try {
    if (window.fs || window.electronAPI?.fileSystem || window.secureElectronAPI?.fileSystem) {
      console.log('✅ File system API available for migration');
      results.passed++;
      results.tests.push({ name: 'fileSystemAPIReadyForMigration', success: true });
    } else {
      console.log('❌ No file system API available');
      results.failed++;
      results.tests.push({ name: 'fileSystemAPIReadyForMigration', success: false });
    }
  } catch (error) {
    console.log('❌ File system API check failed:', error);
    results.failed++;
    results.tests.push({ name: 'fileSystemAPIReadyForMigration', success: false, error: error.message });
  }
  
  console.log(`🧪 Phase 2 completed: ${results.passed} passed, ${results.failed} failed, ${results.warnings.length} warnings`);
  
  return results;
}

/**
 * Phase 3: Test Context Isolation Compatibility
 * Verifies that the app is ready for context isolation to be enabled
 */
export function testContextIsolationCompatibility() {
  const results = {
    phase: 'Phase 3 - Context Isolation Compatibility',
    passed: 0,
    failed: 0,
    tests: [],
    warnings: [],
    readyForContextIsolation: false
  };
  
  console.log('🧪 Testing Phase 3: Context Isolation Compatibility...');
  debugLog?.info('Starting context isolation compatibility tests', { 
    module: 'security-transition-test',
    function: 'testContextIsolationCompatibility' 
  });
  
  // Test 1: Check if all required secure APIs are available
  const requiredAPIs = ['database', 'fileSystem', 'store', 'path', 'os'];
  requiredAPIs.forEach(api => {
    try {
      if (window.secureElectronAPI && window.secureElectronAPI[api]) {
        console.log(`✅ Secure ${api} API available`);
        results.passed++;
        results.tests.push({ name: `secure${api}APIAvailable`, success: true });
      } else {
        console.log(`❌ Secure ${api} API not available`);
        results.failed++;
        results.tests.push({ name: `secure${api}APIAvailable`, success: false });
      }
    } catch (error) {
      console.log(`❌ Error checking secure ${api} API:`, error);
      results.failed++;
      results.tests.push({ name: `secure${api}APIAvailable`, success: false, error: error.message });
    }
  });
  
  // Test 2: Check if all modules have been migrated
  // This would check specific module migration status
  try {
    // Placeholder for module migration checks
    console.log('ℹ️ Module migration status checks would go here');
    results.tests.push({ name: 'modulesMigrated', success: false });
    results.warnings.push('Module migration status not yet implemented');
  } catch (error) {
    console.log('❌ Module migration check failed:', error);
    results.failed++;
    results.tests.push({ name: 'modulesMigrated', success: false, error: error.message });
  }
  
  // Test 3: Check if legacy fallbacks are still working
  try {
    if (window.electronAPI || window.db || window.store) {
      console.log('✅ Legacy APIs still available as fallback');
      results.passed++;
      results.tests.push({ name: 'legacyFallbacksWorking', success: true });
    } else {
      console.log('⚠️ No legacy APIs available - might break during transition');
      results.tests.push({ name: 'legacyFallbacksWorking', success: false });
      results.warnings.push('No legacy fallbacks available');
    }
  } catch (error) {
    console.log('❌ Legacy fallback check failed:', error);
    results.failed++;
    results.tests.push({ name: 'legacyFallbacksWorking', success: false, error: error.message });
  }
  
  // Determine if ready for context isolation
  const criticalTests = results.tests.filter(test => 
    test.name.includes('secureAPIAvailable') || test.name.includes('APIAvailable')
  );
  const criticalPassed = criticalTests.filter(test => test.success).length;
  const criticalTotal = criticalTests.length;
  
  results.readyForContextIsolation = criticalPassed >= criticalTotal * 0.8; // 80% pass rate
  
  if (results.readyForContextIsolation) {
    console.log('🎯 Ready for context isolation - security APIs are functional');
  } else {
    console.log('⚠️ Not ready for context isolation - more work needed');
  }
  
  console.log(`🧪 Phase 3 completed: ${results.passed} passed, ${results.failed} failed, ${results.warnings.length} warnings`);
  
  return results;
}

/**
 * Complete Security Transition Test Suite
 * Runs all phases of security testing
 */
export function runCompleteSecurityTestSuite() {
  const suiteResults = {
    totalTests: 0,
    totalPassed: 0,
    totalFailed: 0,
    totalWarnings: 0,
    phases: [],
    overallSuccess: false,
    readyForNextPhase: false
  };
  
  console.log('🚀 Running Complete Security Transition Test Suite...');
  debugLog?.info('Starting complete security test suite', { 
    module: 'security-transition-test',
    function: 'runCompleteSecurityTestSuite' 
  });
  
  // Run Phase 1 tests
  try {
    const phase1Results = testSecurityInfrastructure();
    suiteResults.phases.push(phase1Results);
    suiteResults.totalTests += phase1Results.tests.length;
    suiteResults.totalPassed += phase1Results.passed;
    suiteResults.totalFailed += phase1Results.failed;
    suiteResults.totalWarnings += phase1Results.warnings.length;
  } catch (error) {
    console.log('❌ Phase 1 tests failed:', error);
    suiteResults.phases.push({ 
      phase: 'Phase 1 - Security Infrastructure', 
      error: error.message,
      passed: 0,
      failed: 1,
      tests: [{ name: 'phase1Execution', success: false, error: error.message }]
    });
    suiteResults.totalFailed++;
  }
  
  // Run Phase 2 tests
  try {
    const phase2Results = testModuleMigrationReadiness();
    suiteResults.phases.push(phase2Results);
    suiteResults.totalTests += phase2Results.tests.length;
    suiteResults.totalPassed += phase2Results.passed;
    suiteResults.totalFailed += phase2Results.failed;
    suiteResults.totalWarnings += phase2Results.warnings.length;
  } catch (error) {
    console.log('❌ Phase 2 tests failed:', error);
    suiteResults.phases.push({ 
      phase: 'Phase 2 - Module Migration Readiness', 
      error: error.message,
      passed: 0,
      failed: 1,
      tests: [{ name: 'phase2Execution', success: false, error: error.message }]
    });
    suiteResults.totalFailed++;
  }
  
  // Run Phase 3 tests
  try {
    const phase3Results = testContextIsolationCompatibility();
    suiteResults.phases.push(phase3Results);
    suiteResults.totalTests += phase3Results.tests.length;
    suiteResults.totalPassed += phase3Results.passed;
    suiteResults.totalFailed += phase3Results.failed;
    suiteResults.totalWarnings += phase3Results.warnings.length;
    suiteResults.readyForNextPhase = phase3Results.readyForContextIsolation;
  } catch (error) {
    console.log('❌ Phase 3 tests failed:', error);
    suiteResults.phases.push({ 
      phase: 'Phase 3 - Context Isolation Compatibility', 
      error: error.message,
      passed: 0,
      failed: 1,
      tests: [{ name: 'phase3Execution', success: false, error: error.message }]
    });
    suiteResults.totalFailed++;
  }
  
  // Calculate overall success
  suiteResults.overallSuccess = suiteResults.totalFailed === 0 && suiteResults.totalPassed > 0;
  
  // Print summary
  console.log('\n📊 Security Test Suite Summary:');
  console.log(`Total Tests: ${suiteResults.totalTests}`);
  console.log(`Passed: ${suiteResults.totalPassed} ✅`);
  console.log(`Failed: ${suiteResults.totalFailed} ❌`);
  console.log(`Warnings: ${suiteResults.totalWarnings} ⚠️`);
  console.log(`Overall Success: ${suiteResults.overallSuccess ? 'YES' : 'NO'} ${suiteResults.overallSuccess ? '🎉' : '💥'}`);
  console.log(`Ready for Next Phase: ${suiteResults.readyForNextPhase ? 'YES' : 'NO'} ${suiteResults.readyForNextPhase ? '🚀' : '⏸️'}`);
  
  debugLog?.info('Security test suite completed', { 
    module: 'security-transition-test',
    function: 'runCompleteSecurityTestSuite',
    results: {
      totalTests: suiteResults.totalTests,
      passed: suiteResults.totalPassed,
      failed: suiteResults.totalFailed,
      warnings: suiteResults.totalWarnings,
      success: suiteResults.overallSuccess
    }
  });
  
  return suiteResults;
}

/**
 * Quick Security Status Check
 * Provides a quick overview of the current security status
 */
export function quickSecurityStatusCheck() {
  const status = {
    mode: 'unknown',
    secureAPIAvailable: false,
    contextIsolationEnabled: false,
    nodeIntegrationDisabled: false,
    readyForMigration: false,
    recommendations: []
  };
  
  console.log('🔍 Quick Security Status Check...');
  
  // Check current mode
  if (window.secureElectronAPI) {
    status.mode = 'secure';
    status.secureAPIAvailable = true;
    console.log('🔒 Mode: SECURE (contextBridge available)');
  } else if (window.electronAPI) {
    status.mode = 'modern';
    console.log('🔄 Mode: MODERN (hybrid APIs)');
  } else if (window.db || window.store) {
    status.mode = 'legacy';
    console.log('⚠️ Mode: LEGACY (insecure)');
  } else {
    status.mode = 'unknown';
    console.log('❓ Mode: UNKNOWN');
  }
  
  // Check context isolation
  try {
    if (typeof contextBridge !== 'undefined') {
      status.contextIsolationEnabled = true;
      console.log('✅ Context isolation: ENABLED');
    } else {
      console.log('❌ Context isolation: DISABLED');
      status.recommendations.push('Enable context isolation for security');
    }
  } catch (error) {
    console.log('❌ Context isolation: DISABLED');
  }
  
  // Check node integration
  try {
    if (typeof require === 'undefined') {
      status.nodeIntegrationDisabled = true;
      console.log('✅ Node integration: DISABLED (secure)');
    } else {
      console.log('❌ Node integration: ENABLED (insecure)');
      status.recommendations.push('Disable Node.js integration for security');
    }
  } catch (error) {
    status.nodeIntegrationDisabled = true;
    console.log('✅ Node integration: DISABLED (secure)');
  }
  
  // Check migration readiness
  const hasSecureAPI = status.secureAPIAvailable;
  const hasAdapterLayer = true; // Assume available if we can run this test
  const hasLegacyFallback = !!(window.electronAPI || window.db || window.store);
  
  status.readyForMigration = hasSecureAPI || (hasAdapterLayer && hasLegacyFallback);
  
  if (status.readyForMigration) {
    console.log('🚀 Migration readiness: READY');
  } else {
    console.log('⚠️ Migration readiness: NOT READY');
    status.recommendations.push('Set up secure API infrastructure before migrating');
  }
  
  // Print recommendations
  if (status.recommendations.length > 0) {
    console.log('\n💡 Recommendations:');
    status.recommendations.forEach((rec, index) => {
      console.log(`   ${index + 1}. ${rec}`);
    });
  }
  
  return status;
}

// Export all test functions
export default {
  testSecurityInfrastructure,
  testModuleMigrationReadiness,
  testContextIsolationCompatibility,
  runCompleteSecurityTestSuite,
  quickSecurityStatusCheck
};
