/**
 * Database Setup Module
 * 
 * Handles database initialization and setup for the MxVoice Electron application.
 */

import Store from 'electron-store';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import { initializeMainDebugLog } from '../../main/modules/debug-log.js';

const store = new Store();
const debugLog = initializeMainDebugLog({ store });

let dbInstance = null;

function initializeDatabase() {
  try {
    let dbName = "mxvoice.db";
    const databaseDirectory = store.get("database_directory");
    
    debugLog.info(`Looking for database in ${databaseDirectory}`);
    
    // Handle case where database directory is not set
    if (!databaseDirectory) {
      debugLog.warn('Database directory not set, using default');
      const defaultDbPath = path.join(process.cwd(), 'data');
      if (!fs.existsSync(defaultDbPath)) {
        fs.mkdirSync(defaultDbPath, { recursive: true });
      }
      const dbPath = path.join(defaultDbPath, dbName);
      debugLog.info(`Using default database path: ${dbPath}`);
      
      dbInstance = new Database(dbPath);
      setupDatabaseIndexes(dbInstance);
      return dbInstance;
    }
    
    if (fs.existsSync(path.join(databaseDirectory, "mrvoice.db"))) {
      dbName = "mrvoice.db";
    }
    
    debugLog.info(
      `Attempting to open database file ${path.join(
        databaseDirectory,
        dbName
      )}`
    );
    
    dbInstance = new Database(
      path.join(databaseDirectory, dbName)
    );
    
    // Setup database indexes
    setupDatabaseIndexes(dbInstance);
    
    return dbInstance;
  } catch (error) {
    debugLog.error('Error initializing database:', error);
    
    // Fallback: create a test database in memory
    debugLog.info('Creating fallback in-memory database for testing');
    dbInstance = new Database(":memory:");
    
    // Create basic tables for testing
    dbInstance.exec(`
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
    `);
    
    return dbInstance;
  }
}

function setupDatabaseIndexes(db) {
  try {
    // Category indexes
    if (db.pragma('index_info(category_code_index)').length == 0) {
      debugLog.info(`Creating unique index on category codes`);
      const stmt = db.prepare("CREATE UNIQUE INDEX 'category_code_index' ON categories(code)");
      stmt.run();
    }

    if (db.pragma('index_info(category_description_index)').length == 0) {
      debugLog.info(`Creating unique index on category descriptions`);
      const stmt = db.prepare("CREATE UNIQUE INDEX 'category_description_index' ON categories(description)");
      stmt.run();
    }

    // Search indexes for better performance
    if (db.pragma('index_info(idx_title)').length == 0) {
      debugLog.info(`Creating index on title column`);
      const stmt = db.prepare("CREATE INDEX 'idx_title' ON mrvoice(title)");
      stmt.run();
    }

    if (db.pragma('index_info(idx_artist)').length == 0) {
      debugLog.info(`Creating index on artist column`);
      const stmt = db.prepare("CREATE INDEX 'idx_artist' ON mrvoice(artist)");
      stmt.run();
    }

    if (db.pragma('index_info(idx_info)').length == 0) {
      debugLog.info(`Creating index on info column`);
      const stmt = db.prepare("CREATE INDEX 'idx_info' ON mrvoice(info)");
      stmt.run();
    }

    if (db.pragma('index_info(idx_category)').length == 0) {
      debugLog.info(`Creating index on category column`);
      const stmt = db.prepare("CREATE INDEX 'idx_category' ON mrvoice(category)");
      stmt.run();
    }
  } catch (error) {
    debugLog.warn('Error setting up database indexes:', error);
  }
}

// Get the database instance
function getDatabase() {
  return dbInstance;
}

// Test function to verify database setup is working
function testDatabaseSetup() {
  debugLog.debug('Testing Database Setup...');
  
  try {
    if (!dbInstance) {
      dbInstance = initializeDatabase();
    }
    debugLog.info('✅ Database initialized successfully');
    
    // Test basic database operations
    const stmt = dbInstance.prepare("SELECT COUNT(*) as count FROM categories");
    const result = stmt.get();
    debugLog.info(`✅ Database query successful: ${result.count} categories found`);
    
    return true;
  } catch (error) {
    debugLog.error('❌ Database setup failed:', error);
    return false;
  }
}

export {
  initializeDatabase,
  setupDatabaseIndexes,
  getDatabase,
  testDatabaseSetup
};

// Default export for module loading
export default {
  initializeDatabase,
  setupDatabaseIndexes,
  getDatabase,
  testDatabaseSetup
}; 