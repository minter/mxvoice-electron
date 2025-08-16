import { cleanupTestEnvironment } from '../utils/test-environment-manager.js';

async function globalTeardown() {
  try {
    console.log('🧹 Starting global test teardown...');
    
    // Clean up test environment
    await cleanupTestEnvironment();
    
    console.log('✅ Global test environment cleaned up');
    
  } catch (error) {
    console.error('❌ Global test teardown failed:', error);
  }
}

export default globalTeardown;
