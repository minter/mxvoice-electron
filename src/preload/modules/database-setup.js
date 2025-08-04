// Database Setup Module
// Handles database initialization and setup

const Store = require('electron-store');
const path = require('path');
const fs = require('fs');

const store = new Store();

let dbInstance = null;

function initializeDatabase() {
  try {
    var dbName = "mxvoice.db";
    const databaseDirectory = store.get("database_directory");
    
    console.log(`Looking for database in ${databaseDirectory}`);
    
    // Handle case where database directory is not set
    if (!databaseDirectory) {
      console.warn('Database directory not set, using default');
      const defaultDbPath = path.join(process.cwd(), 'data');
      if (!fs.existsSync(defaultDbPath)) {
        fs.mkdirSync(defaultDbPath, { recursive: true });
      }
      const dbPath = path.join(defaultDbPath, dbName);
      console.log(`Using default database path: ${dbPath}`);
      
      dbInstance = require("better-sqlite3")(dbPath);
      setupDatabaseIndexes(dbInstance);
      return dbInstance;
    }
    
    if (fs.existsSync(path.join(databaseDirectory, "mrvoice.db"))) {
      dbName = "mrvoice.db";
    }
    
    console.log(
      `Attempting to open database file ${path.join(
        databaseDirectory,
        dbName
      )}`
    );
    
    dbInstance = require("better-sqlite3")(
      path.join(databaseDirectory, dbName)
    );
    
    // Setup database indexes
    setupDatabaseIndexes(dbInstance);
    
    return dbInstance;
  } catch (error) {
    console.error('Error initializing database:', error);
    
    // Fallback: create a test database in memory
    console.log('Creating fallback in-memory database for testing');
    dbInstance = require("better-sqlite3")(":memory:");
    
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
      console.log(`Creating unique index on category codes`);
      const stmt = db.prepare("CREATE UNIQUE INDEX 'category_code_index' ON categories(code)");
      stmt.run();
    }

    if (db.pragma('index_info(category_description_index)').length == 0) {
      console.log(`Creating unique index on category descriptions`);
      const stmt = db.prepare("CREATE UNIQUE INDEX 'category_description_index' ON categories(description)");
      stmt.run();
    }

    // Search indexes for better performance
    if (db.pragma('index_info(idx_title)').length == 0) {
      console.log(`Creating index on title column`);
      const stmt = db.prepare("CREATE INDEX 'idx_title' ON mrvoice(title)");
      stmt.run();
    }

    if (db.pragma('index_info(idx_artist)').length == 0) {
      console.log(`Creating index on artist column`);
      const stmt = db.prepare("CREATE INDEX 'idx_artist' ON mrvoice(artist)");
      stmt.run();
    }

    if (db.pragma('index_info(idx_info)').length == 0) {
      console.log(`Creating index on info column`);
      const stmt = db.prepare("CREATE INDEX 'idx_info' ON mrvoice(info)");
      stmt.run();
    }

    if (db.pragma('index_info(idx_category)').length == 0) {
      console.log(`Creating index on category column`);
      const stmt = db.prepare("CREATE INDEX 'idx_category' ON mrvoice(category)");
      stmt.run();
    }
  } catch (error) {
    console.warn('Error setting up database indexes:', error);
  }
}

// Get the database instance
function getDatabase() {
  return dbInstance;
}

// Test function to verify database setup is working
function testDatabaseSetup() {
  console.log('Testing Database Setup...');
  
  try {
    if (!dbInstance) {
      dbInstance = initializeDatabase();
    }
    console.log('✅ Database initialized successfully');
    
    // Test basic database operations
    const stmt = dbInstance.prepare("SELECT COUNT(*) as count FROM categories");
    const result = stmt.get();
    console.log(`✅ Database query successful: ${result.count} categories found`);
    
    return true;
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    return false;
  }
}

module.exports = {
  initializeDatabase,
  setupDatabaseIndexes,
  getDatabase,
  testDatabaseSetup
}; 