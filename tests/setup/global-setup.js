import { TestEnvironmentSetup } from './test-environment-setup.js';

let testEnv;

async function globalSetup() {
  try {
    console.log('🌍 Starting global test setup...');
    
    // Create and initialize test environment
    testEnv = new TestEnvironmentSetup();
    await testEnv.setup();
    
    // Store test environment for tests to access
    global.testEnvironment = testEnv;
    
    // Validate the test environment
    const validation = await testEnv.validateTestEnvironment();
    if (!validation.valid) {
      throw new Error(`Test environment validation failed: ${validation.error}`);
    }
    
    console.log('✅ Global test setup completed successfully');
    console.log('📊 Test environment stats:', await testEnv.getDatabaseStats());
    
  } catch (error) {
    console.error('❌ Global test setup failed:', error);
    throw error;
  }
}

export default globalSetup;
