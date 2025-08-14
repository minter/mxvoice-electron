/**
 * Database Setup Module
 * 
 * Handles database initialization and setup for the MxVoice Electron application.
 */

import Store from 'electron-store';
import path from 'path';
import fs from 'fs';
import initSqlJs from 'sql.js';
import { initializeMainDebugLog } from '../../main/modules/debug-log.js';

const store = new Store({ name: 'config' });
const debugLog = initializeMainDebugLog({ store });

let dbInstance = null;
let sqlWasm = null;

async function initializeSqlJs() {
  if (!sqlWasm) {
    try {
      sqlWasm = await initSqlJs({
        locateFile: file => `node_modules/sql.js/dist/${file}`
      });
      debugLog.info('SQL.js WASM loaded successfully');
    } catch (error) {
      debugLog.error('Failed to load SQL.js WASM:', error);
      throw error;
    }
  }
  return sqlWasm;
}

async function initializeDatabase() {
  try {
    await initializeSqlJs();
    
    let dbName = "mxvoice.db";
    const databaseDirectory = store.get("database_directory");
    
    debugLog.info(`Looking for database in ${databaseDirectory}`);
    
    let dbPath;
    // Handle case where database directory is not set
    if (!databaseDirectory) {
      debugLog.warn('Database directory not set, using default');
      const defaultDbPath = 'data';
      if (!fs.existsSync(defaultDbPath)) {
        fs.mkdirSync(defaultDbPath, { recursive: true });
      }
      dbPath = path.join(defaultDbPath, dbName);
      debugLog.info(`Using default database path: ${dbPath}`);
    } else {
      if (fs.existsSync(path.join(databaseDirectory, "mrvoice.db"))) {
        dbName = "mrvoice.db";
      }
      dbPath = path.join(databaseDirectory, dbName);
      debugLog.info(`Attempting to open database file ${dbPath}`);
    }
    
    // Try to load existing database file
    if (fs.existsSync(dbPath)) {
      try {
        const data = fs.readFileSync(dbPath);
        dbInstance = new sqlWasm.Database(data);
        debugLog.info('Existing database loaded successfully');
      } catch (error) {
        debugLog.warn('Failed to load existing database, creating new one:', error);
        dbInstance = new sqlWasm.Database();
      }
    } else {
      // Create new database
      dbInstance = new sqlWasm.Database();
      debugLog.info('New database created');
    }
    
    // Setup database schema and indexes
    await setupDatabaseSchema(dbInstance);
    setupDatabaseIndexes(dbInstance);
    
    return dbInstance;
  } catch (error) {
    debugLog.error('Error initializing database:', error);
    
    // Fallback: create a test database in memory
    debugLog.info('Creating fallback in-memory database for testing');
    try {
      await initializeSqlJs();
      dbInstance = new sqlWasm.Database();
      
      // Create basic tables for testing
      await setupDatabaseSchema(dbInstance);
      setupDatabaseIndexes(dbInstance);
      
      return dbInstance;
    } catch (fallbackError) {
      debugLog.error('Fallback database creation failed:', fallbackError);
      throw fallbackError;
    }
  }
}

async function setupDatabaseSchema(db) {
  try {
    // Create tables if they don't exist
    db.run(`
      CREATE TABLE IF NOT EXISTS categories (
        code TEXT PRIMARY KEY,
        description TEXT
      );
    `);
    
    db.run(`
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
    
    debugLog.info('Database schema setup completed');
  } catch (error) {
    debugLog.error('Error setting up database schema:', error);
    throw error;
  }
}

function setupDatabaseIndexes(db) {
  try {
    // Category indexes
    db.run("CREATE UNIQUE INDEX IF NOT EXISTS 'category_code_index' ON categories(code)");
    db.run("CREATE UNIQUE INDEX IF NOT EXISTS 'category_description_index' ON categories(description)");

    // Search indexes for better performance
    db.run("CREATE INDEX IF NOT EXISTS 'idx_title' ON mrvoice(title)");
    db.run("CREATE INDEX IF NOT EXISTS 'idx_artist' ON mrvoice(artist)");
    db.run("CREATE INDEX IF NOT EXISTS 'idx_info' ON mrvoice(info)");
    db.run("CREATE INDEX IF NOT EXISTS 'idx_category' ON mrvoice(category)");
    
    debugLog.info('Database indexes setup completed');
  } catch (error) {
    debugLog.warn('Error setting up database indexes:', error);
  }
}

// Save database to file
function saveDatabase(db, filePath) {
  try {
    const data = db.export();
    fs.writeFileSync(filePath, data);
    debugLog.info(`Database saved to ${filePath}`);
  } catch (error) {
    debugLog.error('Error saving database:', error);
    throw error;
  }
}

// Get the database instance
function getDatabase() {
  return dbInstance;
}

// Test function to verify database setup is working
async function testDatabaseSetup() {
  debugLog.debug('Testing Database Setup...');
  
  try {
    if (!dbInstance) {
      dbInstance = await initializeDatabase();
    }
    debugLog.info('✅ Database initialized successfully');
    
    // Test basic database operations
    const result = dbInstance.exec("SELECT COUNT(*) as count FROM categories");
    const count = result[0]?.values?.[0]?.[0] || 0;
    debugLog.info(`✅ Database query successful: ${count} categories found`);
    
    return true;
  } catch (error) {
    debugLog.error('❌ Database setup failed:', error);
    return false;
  }
}

export {
  initializeDatabase,
  setupDatabaseSchema,
  setupDatabaseIndexes,
  saveDatabase,
  getDatabase,
  testDatabaseSetup
};

// Default export for module loading
export default {
  initializeDatabase,
  setupDatabaseSchema,
  setupDatabaseIndexes,
  saveDatabase,
  getDatabase,
  testDatabaseSetup
}; 