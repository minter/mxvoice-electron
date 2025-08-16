import { TestDatabaseManager } from '../utils/test-database-manager.js';
import { TestStoreManager } from '../utils/test-store-manager.js';
import { TestSongManager } from '../utils/test-song-manager.js';
import { ensureTestDirectories, getAllTestAppDirs } from '../config/test-environment.js';

export class TestEnvironmentSetup {
  constructor() {
    this.dbManager = new TestDatabaseManager();
    this.storeManager = new TestStoreManager();
    this.songManager = new TestSongManager();
    this.isInitialized = false;
  }

  async setup() {
    try {
      console.log('🚀 Setting up test environment...');
      
      // Ensure test directories exist
      ensureTestDirectories();
      console.log('✅ Test directories ensured');
      
      // Verify directory isolation
      this.verifyDirectoryIsolation();
      
      // Initialize test database
      await this.dbManager.initialize();
      // Prefer file-backed DB so the app can open the path directly if needed
      await this.dbManager.createFileBackedDatabase();
      console.log('✅ Test database setup complete');
      
      // Initialize test store
      await this.storeManager.initialize();
      
      // Verify store isolation
      if (!this.storeManager.verifyIsolation()) {
        throw new Error('Test store isolation verification failed');
      }
      console.log('✅ Test store setup complete with isolation verified');
      
      // Create test song files
      await this.songManager.createTestSongFiles();
      console.log('✅ Test song files setup complete');
      
      this.isInitialized = true;
      console.log('🎉 Test environment setup complete with full isolation');
      
      return {
        database: this.dbManager.getTestDatabase(),
        store: this.storeManager.getTestStore(),
        songPaths: this.songManager.getAllTestSongPaths(),
        isolatedPaths: this.storeManager.getTestStore()
      };
    } catch (error) {
      console.error('❌ Test environment setup failed:', error);
      throw error;
    }
  }

  verifyDirectoryIsolation() {
    try {
      const testDirs = getAllTestAppDirs();
      const realAppPaths = [
        process.env.HOME + '/Library/Application Support/Mx. Voice', // macOS
        process.env.APPDATA + '/Mx. Voice', // Windows
        process.env.HOME + '/.config/Mx. Voice' // Linux
      ].filter(Boolean);
      
      console.log('🔒 Verifying test directory isolation...');
      
      // Check that test directories are completely separate from real app paths
      for (const [key, testPath] of Object.entries(testDirs)) {
        for (const realPath of realAppPaths) {
          if (realPath && testPath.includes(realPath)) {
            throw new Error(`Test directory ${key} is not isolated from real app: ${testPath}`);
          }
        }
        console.log(`  ✅ ${key}: ${testPath}`);
      }
      
      console.log('✅ All test directories are isolated from real app');
    } catch (error) {
      console.error('❌ Directory isolation verification failed:', error);
      throw error;
    }
  }

  async reset() {
    try {
      if (!this.isInitialized) {
        console.log('⚠️ Test environment not initialized, skipping reset');
        return;
      }
      
      console.log('🔄 Resetting test environment...');
      
      // Reset database to known state
      await this.dbManager.resetDatabase();
      console.log('✅ Database reset complete');
      
      // Reset store to default state
      await this.storeManager.resetToDefaultState();
      console.log('✅ Store reset complete');
      
      console.log('✅ Test environment reset complete');
    } catch (error) {
      console.error('❌ Test environment reset failed:', error);
      throw error;
    }
  }

  async cleanup() {
    try {
      console.log('🧹 Cleaning up test environment...');
      
      // Clean up all test resources
      await this.dbManager.cleanup();
      this.storeManager.cleanup();
      await this.songManager.cleanup();
      
      this.isInitialized = false;
      console.log('✅ Test environment cleanup complete');
    } catch (error) {
      console.error('❌ Test environment cleanup failed:', error);
    }
  }

  // Getters for test components
  getTestDatabase() {
    if (!this.isInitialized) {
      throw new Error('Test environment not initialized. Call setup() first.');
    }
    return this.dbManager.getTestDatabase();
  }

  getTestStore() {
    if (!this.isInitialized) {
      throw new Error('Test environment not initialized. Call setup() first.');
    }
    return this.storeManager.getTestStore();
  }

  getTestSongPaths() {
    if (!this.isInitialized) {
      throw new Error('Test environment not initialized. Call setup() first.');
    }
    return this.songManager.getAllTestSongPaths();
  }

  // Get isolated test paths
  getTestDatabaseDirectory() {
    if (!this.isInitialized) {
      throw new Error('Test environment not initialized. Call setup() first.');
    }
    return this.storeManager.getTestDatabaseDirectory();
  }

  getTestHotkeyDirectory() {
    if (!this.isInitialized) {
      throw new Error('Test environment not initialized. Call setup() first.');
    }
    return this.storeManager.getTestHotkeyDirectory();
  }

  getTestHoldingTankDirectory() {
    if (!this.isInitialized) {
      throw new Error('Test environment not initialized. Call setup() first.');
    }
    return this.storeManager.getTestHoldingTankDirectory();
  }

  getTestPreferencesDirectory() {
    if (!this.isInitialized) {
      throw new Error('Test environment not initialized. Call setup() first.');
    }
    return this.storeManager.getTestPreferencesDirectory();
  }

  getTestUserDataDirectory() {
    if (!this.isInitialized) {
      throw new Error('Test environment not initialized. Call setup() first.');
    }
    return this.storeManager.getTestUserDataDirectory();
  }

  // Helper methods for common test scenarios
  async addTestSongToDatabase(songData) {
    if (!this.isInitialized) {
      throw new Error('Test environment not initialized. Call setup() first.');
    }
    
    try {
      const db = this.getTestDatabase();
      const stmt = db.prepare(`
        INSERT INTO mrvoice (title, artist, category, info, filename, time, modtime)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run([
        songData.title,
        songData.artist,
        songData.category,
        songData.info,
        songData.filename,
        songData.time,
        Date.now()
      ]);
      stmt.finalize();
      
      console.log(`✅ Added test song to database: ${songData.title}`);
    } catch (error) {
      console.error('❌ Failed to add test song to database:', error);
      throw error;
    }
  }

  async removeTestSongFromDatabase(filename) {
    if (!this.isInitialized) {
      throw new Error('Test environment not initialized. Call setup() first.');
    }
    
    try {
      const db = this.getTestDatabase();
      const stmt = db.prepare('DELETE FROM mrvoice WHERE filename = ?');
      stmt.run([filename]);
      stmt.finalize();
      
      console.log(`✅ Removed test song from database: ${filename}`);
    } catch (error) {
      console.error('❌ Failed to remove test song from database:', error);
      throw error;
    }
  }

  async getDatabaseStats() {
    if (!this.isInitialized) {
      throw new Error('Test environment not initialized. Call setup() first.');
    }
    
    try {
      const songCount = await this.dbManager.getSongCount();
      const categoryCount = await this.dbManager.getCategoryCount();
      
      return {
        songs: songCount,
        categories: categoryCount
      };
    } catch (error) {
      console.error('❌ Failed to get database stats:', error);
      throw error;
    }
  }

  // State validation methods
  async validateTestEnvironment() {
    if (!this.isInitialized) {
      return { valid: false, error: 'Test environment not initialized' };
    }
    
    try {
      const dbStats = await this.getDatabaseStats();
      const store = this.getTestStore();
      const songPaths = this.getTestSongPaths();
      
      // Verify isolation
      const isolationVerified = this.storeManager.verifyIsolation();
      
      const validation = {
        valid: true,
        isolated: isolationVerified,
        database: {
          songs: dbStats.songs,
          categories: dbStats.categories,
          valid: dbStats.songs > 0 && dbStats.categories > 0
        },
        store: {
          testMode: store.get('test_mode'),
          valid: store.get('test_mode') === true
        },
        songs: {
          count: songPaths.length,
          valid: songPaths.length > 0
        }
      };
      
      validation.valid = validation.database.valid && 
                        validation.store.valid && 
                        validation.songs.valid &&
                        validation.isolated;
      
      return validation;
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  // Debug information
  getDebugInfo() {
    return {
      initialized: this.isInitialized,
      databaseManager: this.dbManager ? 'active' : 'inactive',
      storeManager: this.storeManager ? 'active' : 'inactive',
      songManager: this.songManager ? 'active' : 'inactive',
      isolationVerified: this.storeManager?.verifyIsolation() || false
    };
  }
}
