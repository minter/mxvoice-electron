import Store from 'electron-store';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class TestStoreManager {
  constructor() {
    // Use completely isolated test store path
    this.testStorePath = path.join(__dirname, '../fixtures/test-store');
    this.testStore = null;
    this.originalStorePath = null;
  }

  async initialize() {
    try {
      // Ensure test store directory exists
      if (!fs.existsSync(this.testStorePath)) {
        fs.mkdirSync(this.testStorePath, { recursive: true });
      }

      // Create test store with isolated path and unique name
      this.testStore = new Store({
        name: 'test-config',
        cwd: this.testStorePath,
        clearInvalidConfig: true,
        // Ensure this store is completely separate from the real app
        encryptionKey: 'test-only-encryption-key'
      });

      // Set test-specific configuration with isolated paths
      await this.setupTestConfig();
      
      console.log('✅ Test store initialized with isolated paths');
      return this.testStore;
    } catch (error) {
      console.error('❌ Failed to initialize test store:', error);
      throw error;
    }
  }

  async setupTestConfig() {
    try {
      // Reset to known test state
      this.testStore.clear();
      
      // Import test environment config for isolated paths
      const { TEST_CONFIG } = await import('../config/test-environment.js');
      
      // Set test configuration with COMPLETELY ISOLATED paths
      this.testStore.set('database_directory', TEST_CONFIG.testAppDirs.databaseDirectory);
      this.testStore.set('hotkey_directory', TEST_CONFIG.testAppDirs.hotkeyDirectory);
      this.testStore.set('holding_tank_directory', TEST_CONFIG.testAppDirs.holdingTankDirectory);
      this.testStore.set('preferences_directory', TEST_CONFIG.testAppDirs.preferencesDirectory);
      this.testStore.set('user_data_directory', TEST_CONFIG.testAppDirs.userDataDirectory);
      this.testStore.set('temp_directory', TEST_CONFIG.testAppDirs.tempDirectory);
      
      // App settings (isolated from real app)
      this.testStore.set('browser_width', 1200);
      this.testStore.set('browser_height', 800);
      this.testStore.set('theme', 'light');
      this.testStore.set('auto_update_enabled', false);
      this.testStore.set('dev_tools_enabled', false);
      this.testStore.set('test_mode', true);
      
      // Ensure test isolation
      this.testStore.set('is_test_environment', true);
      this.testStore.set('test_session_id', `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
      
      console.log('✅ Test store configuration set with isolated paths');
    } catch (error) {
      console.error('❌ Failed to setup test config:', error);
      throw error;
    }
  }

  async resetToDefaultState() {
    try {
      await this.setupTestConfig();
      console.log('✅ Test store reset to default state with isolated paths');
    } catch (error) {
      console.error('❌ Failed to reset test store:', error);
      throw error;
    }
  }

  getTestStore() {
    return this.testStore;
  }

  setTestValue(key, value) {
    try {
      this.testStore.set(key, value);
      console.log(`✅ Test store set ${key} = ${value}`);
    } catch (error) {
      console.error(`❌ Failed to set test store value ${key}:`, error);
      throw error;
    }
  }

  getTestValue(key) {
    try {
      return this.testStore.get(key);
    } catch (error) {
      console.error(`❌ Failed to get test store value ${key}:`, error);
      return undefined;
    }
  }

  // Get isolated test paths
  getTestDatabaseDirectory() {
    return this.testStore.get('database_directory');
  }

  getTestHotkeyDirectory() {
    return this.testStore.get('hotkey_directory');
  }

  getTestHoldingTankDirectory() {
    return this.testStore.get('holding_tank_directory');
  }

  getTestPreferencesDirectory() {
    return this.testStore.get('preferences_directory');
  }

  getTestUserDataDirectory() {
    return this.testStore.get('user_data_directory');
  }

  getTestTempDirectory() {
    return this.testStore.get('temp_directory');
  }

  // Verify isolation from real app
  verifyIsolation() {
    try {
      const isTestEnv = this.testStore.get('is_test_environment');
      const testSessionId = this.testStore.get('test_session_id');
      
      if (!isTestEnv || !testSessionId) {
        throw new Error('Test store isolation verification failed');
      }
      
      console.log(`✅ Test store isolation verified - Session: ${testSessionId}`);
      return true;
    } catch (error) {
      console.error('❌ Test store isolation verification failed:', error);
      return false;
    }
  }

  cleanup() {
    try {
      if (this.testStore) {
        this.testStore.clear();
        this.testStore = null;
        console.log('✅ Test store cleared');
      }
      
      // Clean up test store files
      if (fs.existsSync(this.testStorePath)) {
        fs.rmSync(this.testStorePath, { recursive: true, force: true });
        console.log('✅ Test store directory cleaned up');
      }
    } catch (error) {
      console.error('❌ Failed to cleanup test store:', error);
    }
  }

  // Helper methods for common test scenarios
  enableDevTools() {
    this.setTestValue('dev_tools_enabled', true);
  }

  disableDevTools() {
    this.setTestValue('dev_tools_enabled', false);
  }

  setTheme(theme) {
    this.setTestValue('theme', theme);
  }

  setWindowSize(width, height) {
    this.setTestValue('browser_width', width);
    this.setTestValue('browser_height', height);
  }

  enableAutoUpdate() {
    this.setTestValue('auto_update_enabled', true);
  }

  disableAutoUpdate() {
    this.setTestValue('auto_update_enabled', false);
  }
}
