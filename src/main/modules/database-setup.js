/**
 * Main Process Database Setup Module
 * 
 * Handles database initialization and setup for the main process.
 * Uses the official @sqlite.org/sqlite-wasm package.
 */

import Store from 'electron-store';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { fileURLToPath } from 'url';
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

// Get __dirname equivalent for ES6 modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const store = new Store({ name: 'config' });

let dbInstance = null;
let sqlite3 = null;

/**
 * Initialize the SQLite WebAssembly module
 */
async function initializeSQLite() {
  if (!sqlite3) {
    try {
      console.log('Initializing SQLite WebAssembly module...');
      sqlite3 = await sqlite3InitModule({
        print: console.log,
        printErr: console.error,
      });
      console.log('SQLite WebAssembly module initialized successfully');
      console.log('SQLite version:', sqlite3.capi.sqlite3_libversion());
    } catch (error) {
      console.error('Failed to initialize SQLite WebAssembly module:', error);
      throw error;
    }
  }
  return sqlite3;
}

/**
 * Initialize the database instance
 */
async function initializeDatabase() {
  try {
    // Initialize SQLite first
    const sqlite3Module = await initializeSQLite();
    
    const databaseDirectory = store.get("database_directory");
    console.log(`Database directory from settings: ${databaseDirectory}`);
    
    let dbPath;
    let dbName;
    
    // Always respect the user's database directory setting if it exists
    if (databaseDirectory) {
      // Check for existing database files in the configured directory
      const mrvoiceDbPath = path.join(databaseDirectory, "mrvoice.db");
      const mxvoiceDbPath = path.join(databaseDirectory, "mxvoice.db");
      
      if (fs.existsSync(mrvoiceDbPath)) {
        dbName = "mrvoice.db";
        dbPath = mrvoiceDbPath;
        console.log(`Found mrvoice.db in configured directory: ${dbPath}`);
      } else if (fs.existsSync(mxvoiceDbPath)) {
        dbName = "mxvoice.db";
        dbPath = mxvoiceDbPath;
        console.log(`Found mxvoice.db in configured directory: ${dbPath}`);
      } else {
        // No existing database, create new mxvoice.db in configured directory
        dbName = "mxvoice.db";
        dbPath = mxvoiceDbPath;
        console.log(`No existing database found, will create: ${dbPath}`);
      }
    } else {
      // Fallback to default location only if no directory is configured
      console.warn('Database directory not set in preferences, using default userData location');
      const defaultDbPath = path.join(app.getPath('userData'), 'data');
      if (!fs.existsSync(defaultDbPath)) {
        fs.mkdirSync(defaultDbPath, { recursive: true });
      }
      dbName = "mxvoice.db";
      dbPath = path.join(defaultDbPath, dbName);
      console.log(`Using default database path: ${dbPath}`);
    }
    
    // Try to load existing database file
    if (fs.existsSync(dbPath)) {
      try {
        console.log('Loading existing database file...');
        // Read the database file and load it into memory
        const data = fs.readFileSync(dbPath);
        console.log(`Database file size: ${data.length} bytes`);
        
        // Create a new database instance and deserialize the file data
        dbInstance = new sqlite3Module.oo1.DB();
        
        // Use the deserialize API to load the database from file data
        // Allocate memory in the WebAssembly heap
        const pData = sqlite3Module.wasm.alloc(data.length);
        try {
          // Copy the data to the allocated memory
          sqlite3Module.wasm.heap8u().set(data, pData);
          
          const rc = sqlite3Module.capi.sqlite3_deserialize(
            dbInstance.pointer, 
            'main', 
            pData, 
            data.length, 
            data.length,
            sqlite3Module.capi.SQLITE_DESERIALIZE_FREEONCLOSE |
            sqlite3Module.capi.SQLITE_DESERIALIZE_RESIZEABLE
          );
          
          // Don't free pData here - SQLite takes ownership with FREEONCLOSE
          if (rc === sqlite3Module.capi.SQLITE_OK) {
            console.log('Successfully loaded existing database from file');
          } else {
            throw new Error(`Failed to deserialize database: ${sqlite3Module.capi.sqlite3_errstr(rc)} (${rc})`);
          }
        } catch (allocError) {
          // If we allocated memory but failed, free it
          sqlite3Module.wasm.dealloc(pData);
          throw allocError;
        }
      } catch (error) {
        console.warn('Failed to load existing database, creating new one:', error);
        
        // Create backup of problematic file
        const backupPath = `${dbPath}.backup-${Date.now()}`;
        try {
          const data = fs.readFileSync(dbPath);
          fs.writeFileSync(backupPath, data);
          console.log(`Created backup of problematic database at: ${backupPath}`);
        } catch (backupError) {
          console.warn('Could not create backup:', backupError.message);
        }
        
        // Create fresh database
        dbInstance = new sqlite3Module.oo1.DB();
        console.log('Created new database after failed load');
      }
    } else {
      // Create new database
      console.log('Creating new database...');
      dbInstance = new sqlite3Module.oo1.DB();
      console.log('New database created');
    }
    
    // Store the database path for later saving
    dbInstance._dbPath = dbPath;
    
    // Setup database schema and indexes
    await setupDatabaseSchema(dbInstance);
    setupDatabaseIndexes(dbInstance);
    
    return dbInstance;
  } catch (error) {
    console.error('Error initializing database:', error);
    
    // Fallback: create a test database in memory
    console.log('Creating fallback in-memory database for testing');
    try {
      const sqlite3Module = await initializeSQLite();
      dbInstance = new sqlite3Module.oo1.DB();
      
      // Create basic tables for testing
      await setupDatabaseSchema(dbInstance);
      setupDatabaseIndexes(dbInstance);
      
      return dbInstance;
    } catch (fallbackError) {
      console.error('Fallback database creation failed:', fallbackError);
      
      // Last resort: return null and let the app continue without database
      console.warn('Returning null database instance - app will continue without database functionality');
      return null;
    }
  }
}

/**
 * Setup database schema
 */
async function setupDatabaseSchema(db) {
  try {
    // Create tables if they don't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        code TEXT PRIMARY KEY,
        description TEXT
      );
    `);
    
    db.exec(`
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
    
    console.log('Database schema setup completed');
  } catch (error) {
    console.error('Error setting up database schema:', error);
    throw error;
  }
}

/**
 * Setup database indexes for better performance
 */
function setupDatabaseIndexes(db) {
  try {
    // Category indexes
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS 'category_code_index' ON categories(code)");
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS 'category_description_index' ON categories(description)");

    // Search indexes for better performance
    db.exec("CREATE INDEX IF NOT EXISTS 'idx_title' ON mrvoice(title)");
    db.exec("CREATE INDEX IF NOT EXISTS 'idx_artist' ON mrvoice(artist)");
    db.exec("CREATE INDEX IF NOT EXISTS 'idx_info' ON mrvoice(info)");
    db.exec("CREATE INDEX IF NOT EXISTS 'idx_category' ON mrvoice(category)");
    
    console.log('Database indexes setup completed');
  } catch (error) {
    console.warn('Error setting up database indexes:', error);
  }
}

/**
 * Save database to file
 */
function saveDatabase(db, filePath) {
  try {
    if (!db || !db._dbPath) {
      console.warn('Cannot save database: no database instance or path');
      return;
    }
    
    // Use the stored path or provided path
    const savePath = filePath || db._dbPath;
    
    // Serialize the database and save to file
    try {
      const sqlite3Module = getSQLite();
      if (!sqlite3Module) {
        console.warn('SQLite module not available for saving');
        return;
      }
      
      // Serialize the database to get the raw data
      const serializedPtr = sqlite3Module.capi.sqlite3_serialize(
        db.pointer, 'main', null, 0
      );
      
      if (serializedPtr) {
        // Get the size of the serialized data
        const size = sqlite3Module.capi.sqlite3_malloc_size(serializedPtr);
        
        // Convert to Uint8Array and save to file
        const data = sqlite3Module.wasm.heap8u().subarray(serializedPtr, serializedPtr + size);
        fs.writeFileSync(savePath, data);
        
        // Free the serialized data
        sqlite3Module.capi.sqlite3_free(serializedPtr);
        
        console.log(`Database saved to ${savePath} (${size} bytes)`);
      } else {
        console.warn('Failed to serialize database for saving');
      }
    } catch (saveError) {
      console.error('Error during database save:', saveError);
      throw saveError;
    }
  } catch (error) {
    console.error('Error saving database:', error);
    throw error;
  }
}

/**
 * Get the database instance
 */
function getDatabase() {
  return dbInstance;
}

/**
 * Get the SQLite module instance
 */
function getSQLite() {
  return sqlite3;
}

export {
  initializeDatabase,
  setupDatabaseSchema,
  setupDatabaseIndexes,
  saveDatabase,
  getDatabase,
  getSQLite
};

// Default export for module loading
export default {
  initializeDatabase,
  setupDatabaseSchema,
  setupDatabaseIndexes,
  saveDatabase,
  getDatabase,
  getSQLite
};