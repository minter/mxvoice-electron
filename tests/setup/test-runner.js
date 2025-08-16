#!/usr/bin/env node

/**
 * Test Runner Script
 * 
 * This script tests the test environment setup independently of Playwright
 * to verify that all components work correctly.
 */

import { TestEnvironmentSetup } from './test-environment-setup.js';

async function runTestEnvironmentTest() {
  console.log('🧪 Testing Test Environment Setup...\n');
  
  const testEnv = new TestEnvironmentSetup();
  
  try {
    // Test 1: Setup
    console.log('1️⃣ Testing environment setup...');
    await testEnv.setup();
    console.log('✅ Setup completed successfully\n');
    
    // Test 2: Validation
    console.log('2️⃣ Validating test environment...');
    const validation = await testEnv.validateTestEnvironment();
    if (validation.valid) {
      console.log('✅ Environment validation passed');
      console.log(`   - Database: ${validation.database.songs} songs, ${validation.database.categories} categories`);
      console.log(`   - Store: test_mode = ${validation.store.testMode}`);
      console.log(`   - Songs: ${validation.songs.count} test files\n`);
    } else {
      throw new Error(`Validation failed: ${validation.error}`);
    }
    
    // Test 3: Database operations
    console.log('3️⃣ Testing database operations...');
    const stats = await testEnv.getDatabaseStats();
    console.log(`✅ Database stats: ${stats.songs} songs, ${stats.categories} categories\n`);
    
    // Test 4: Custom song addition
    console.log('4️⃣ Testing custom song addition...');
    await testEnv.addTestSongToDatabase({
      title: 'Custom Test Song',
      artist: 'Custom Test Artist',
      category: 'TEST_CUSTOM',
      filename: 'custom-test.mp3',
      time: '3:30',
      info: 'Custom test song for validation'
    });
    console.log('✅ Custom song added successfully\n');
    
    // Test 5: Reset functionality
    console.log('5️⃣ Testing reset functionality...');
    await testEnv.reset();
    const resetStats = await testEnv.getDatabaseStats();
    console.log(`✅ Reset completed: ${resetStats.songs} songs, ${resetStats.categories} categories\n`);
    
    // Test 6: Cleanup
    console.log('6️⃣ Testing cleanup...');
    await testEnv.cleanup();
    console.log('✅ Cleanup completed successfully\n');
    
    console.log('🎉 All test environment tests passed!');
    console.log('The testing framework is ready to use.');
    
  } catch (error) {
    console.error('❌ Test environment test failed:', error);
    process.exit(1);
  }
}

// Run the test if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTestEnvironmentTest();
}

export { runTestEnvironmentTest };
