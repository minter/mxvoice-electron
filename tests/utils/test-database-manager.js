import pkg from 'node-sqlite3-wasm';
const { Database, onRuntimeInitialized } = pkg;

export class TestDatabaseManager {
  constructor() {
    this.testDb = null;
    this.originalDbPath = null;
  }

  async initialize() {
    try {
      await onRuntimeInitialized;
      console.log('✅ SQLite runtime initialized for testing');
    } catch (error) {
      console.error('❌ Failed to initialize SQLite runtime:', error);
      throw error;
    }
  }

  async createTestDatabase() {
    try {
      // Create in-memory database for tests
      this.testDb = new Database(':memory:');
      console.log('✅ Test database created in memory');
      
      // Setup schema
      await this.setupTestSchema();
      
      // Populate with test data
      await this.populateTestData();
      
      return this.testDb;
    } catch (error) {
      console.error('❌ Failed to create test database:', error);
      throw error;
    }
  }

  async setupTestSchema() {
    try {
      const schema = `
        CREATE TABLE IF NOT EXISTS categories (
          code TEXT PRIMARY KEY,
          description TEXT
        );
        
        CREATE TABLE IF NOT EXISTS mrvoice (
          id INTEGER PRIMARY KEY,
          title TEXT,
          artist TEXT,
          category TEXT,
          info TEXT,
          filename TEXT,
          time TEXT,
          modtime INTEGER
        );
        
        CREATE INDEX IF NOT EXISTS idx_title ON mrvoice(title);
        CREATE INDEX IF NOT EXISTS idx_artist ON mrvoice(artist);
        CREATE INDEX IF NOT EXISTS idx_category ON mrvoice(category);
        CREATE INDEX IF NOT EXISTS idx_info ON mrvoice(info);
      `;
      
      this.testDb.exec(schema);
      console.log('✅ Test database schema created');
    } catch (error) {
      console.error('❌ Failed to setup test schema:', error);
      throw error;
    }
  }

  async populateTestData() {
    try {
      const { TEST_CONFIG } = await import('../config/test-environment.js');
      
      // Insert test categories
      const categoryStmt = this.testDb.prepare(
        'INSERT OR REPLACE INTO categories (code, description) VALUES (?, ?)'
      );
      
      TEST_CONFIG.schema.categories.forEach(cat => {
        categoryStmt.run([cat.code, cat.description]);
      });
      categoryStmt.finalize();

      // Insert test songs
      const songStmt = this.testDb.prepare(`
        INSERT OR REPLACE INTO mrvoice (title, artist, category, info, filename, time, modtime)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      TEST_CONFIG.schema.songs.forEach(song => {
        songStmt.run([
          song.title,
          song.artist,
          song.category,
          song.info,
          song.filename,
          song.time,
          Date.now()
        ]);
      });
      songStmt.finalize();
      
      console.log('✅ Test data populated');
    } catch (error) {
      console.error('❌ Failed to populate test data:', error);
      throw error;
    }
  }

  async resetDatabase() {
    try {
      if (this.testDb) {
        this.testDb.exec('DELETE FROM mrvoice');
        this.testDb.exec('DELETE FROM categories');
        await this.populateTestData();
        console.log('✅ Test database reset to initial state');
      }
    } catch (error) {
      console.error('❌ Failed to reset test database:', error);
      throw error;
    }
  }

  async cleanup() {
    try {
      if (this.testDb) {
        this.testDb.close();
        this.testDb = null;
        console.log('✅ Test database cleaned up');
      }
    } catch (error) {
      console.error('❌ Failed to cleanup test database:', error);
    }
  }

  getTestDatabase() {
    return this.testDb;
  }

  async query(sql, params = []) {
    if (!this.testDb) {
      throw new Error('Test database not initialized');
    }
    
    try {
      const stmt = this.testDb.prepare(sql);
      const result = stmt.all(params);
      stmt.finalize();
      return result;
    } catch (error) {
      console.error('❌ Database query failed:', error);
      throw error;
    }
  }

  async getSongCount() {
    const result = await this.query('SELECT COUNT(*) as count FROM mrvoice');
    return result[0]?.count || 0;
  }

  async getCategoryCount() {
    const result = await this.query('SELECT COUNT(*) as count FROM categories');
    return result[0]?.count || 0;
  }
}
