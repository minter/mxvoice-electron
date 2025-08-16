async function globalTeardown() {
  try {
    console.log('🧹 Starting global test teardown...');
    
    if (global.testEnvironment) {
      await global.testEnvironment.cleanup();
      global.testEnvironment = null;
      console.log('✅ Global test environment cleaned up');
    } else {
      console.log('⚠️ No global test environment found to clean up');
    }
    
    console.log('✅ Global test teardown completed successfully');
    
  } catch (error) {
    console.error('❌ Global test teardown failed:', error);
    // Don't throw here as it could mask test failures
  }
}

export default globalTeardown;
