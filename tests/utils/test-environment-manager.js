import { TestEnvironmentSetup } from '../setup/test-environment-setup.js';

// Singleton instance of test environment
let testEnvironmentInstance = null;

export class TestEnvironmentManager {
  static async getInstance() {
    if (!testEnvironmentInstance) {
      console.log('🚀 Initializing test environment...');
      testEnvironmentInstance = new TestEnvironmentSetup();
      await testEnvironmentInstance.setup();
      console.log('✅ Test environment initialized');
    }
    return testEnvironmentInstance;
  }

  static async reset() {
    if (testEnvironmentInstance) {
      await testEnvironmentInstance.reset();
      console.log('✅ Test environment reset');
    }
  }

  static async cleanup() {
    if (testEnvironmentInstance) {
      await testEnvironmentInstance.cleanup();
      testEnvironmentInstance = null;
      console.log('✅ Test environment cleaned up');
    }
  }
}

// Export convenience functions
export const getTestEnvironment = () => TestEnvironmentManager.getInstance();
export const resetTestEnvironment = () => TestEnvironmentManager.reset();
export const cleanupTestEnvironment = () => TestEnvironmentManager.cleanup();
