#!/usr/bin/env node

/**
 * Test Isolation Verification Script
 * 
 * This script verifies that the test environment is completely isolated
 * from the real Mx. Voice application.
 */

import { TestEnvironmentSetup } from './test-environment-setup.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function verifyTestIsolation() {
  console.log('🔒 Verifying Test Environment Isolation');
  console.log('=====================================\n');
  
  try {
    // Create test environment
    const testEnv = new TestEnvironmentSetup();
    
    // Test 1: Directory Isolation
    console.log('1️⃣ Testing directory isolation...');
    testEnv.verifyDirectoryIsolation();
    console.log('✅ Directory isolation verified\n');
    
    // Test 2: Environment Setup
    console.log('2️⃣ Testing environment setup...');
    await testEnv.setup();
    console.log('✅ Environment setup completed\n');
    
    // Test 3: Store Isolation
    console.log('3️⃣ Testing store isolation...');
    const store = testEnv.getTestStore();
    const isolationVerified = store.get('is_test_environment');
    const testSessionId = store.get('test_session_id');
    
    if (!isolationVerified || !testSessionId) {
      throw new Error('Store isolation verification failed');
    }
    console.log(`✅ Store isolation verified - Session: ${testSessionId}\n`);
    
    // Test 4: Path Isolation
    console.log('4️⃣ Testing path isolation...');
    const testPaths = {
      database: testEnv.getTestDatabaseDirectory(),
      hotkeys: testEnv.getTestHotkeyDirectory(),
      holdingTank: testEnv.getTestHoldingTankDirectory(),
      preferences: testEnv.getTestPreferencesDirectory(),
      userData: testEnv.getTestUserDataDirectory()
    };
    
    // Verify all paths are within test fixtures directory
    const fixturesDir = path.join(__dirname, '../fixtures');
    for (const [key, testPath] of Object.entries(testPaths)) {
      if (!testPath.startsWith(fixturesDir)) {
        throw new Error(`Test path ${key} is not isolated: ${testPath}`);
      }
      console.log(`  ✅ ${key}: ${path.relative(fixturesDir, testPath)}`);
    }
    console.log('✅ All test paths are isolated\n');
    
    // Test 5: Environment Validation
    console.log('5️⃣ Testing environment validation...');
    const validation = await testEnv.validateTestEnvironment();
    if (!validation.valid || !validation.isolated) {
      throw new Error(`Environment validation failed: ${JSON.stringify(validation)}`);
    }
    console.log('✅ Environment validation passed\n');
    
    // Test 6: Cleanup
    console.log('6️⃣ Testing cleanup...');
    await testEnv.cleanup();
    console.log('✅ Cleanup completed successfully\n');
    
    console.log('🎉 All isolation tests passed!');
    console.log('Your test environment is completely isolated from the real app.');
    
  } catch (error) {
    console.error('❌ Test isolation verification failed:', error);
    process.exit(1);
  }
}

// Run the verification if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  verifyTestIsolation();
}

export { verifyTestIsolation };
