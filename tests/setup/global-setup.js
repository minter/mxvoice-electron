import { TestEnvironmentManager } from '../utils/test-environment-manager.js';

async function globalSetup() {
  try {
    console.log('🌍 Starting global test setup...');
    
    // Initialize test environment manager
    await TestEnvironmentManager.getInstance();
    
    console.log('✅ Global test setup completed successfully');
    
  } catch (error) {
    console.error('❌ Global test setup failed:', error);
    throw error;
  }
}

export default globalSetup;
