/**
 * Main Process Database Setup Module
 * 
 * Handles database initialization and setup for the main process.
 * Uses node-sqlite3-wasm package for persistent file-based databases.
 */

import Store from 'electron-store';
import path from 'path';
import fs from 'fs';
import electron from 'electron';

// Destructure from electron (handles both named and default exports)
const { app } = electron;
import { fileURLToPath } from 'url';
import pkg from 'node-sqlite3-wasm';
const { Database, onRuntimeInitialized } = pkg;
import initializeMainDebugLog from './debug-log.js';

// Get __filename equivalent for ES6 modules (__dirname not currently used)
const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename); // Currently unused

const store = new Store({ name: 'config' });

// Initialize main process DebugLog
const debugLog = initializeMainDebugLog({ store });

let dbInstance = null;

/**
 * Initialize SQLite WebAssembly runtime
 */
async function initializeSQLite() {
  try {
    debugLog?.info('Initializing SQLite WebAssembly runtime...', { module: 'database-setup', function: 'initializeSQLite' });
    
    // Wait for the WebAssembly runtime to be ready
    await onRuntimeInitialized;
    debugLog?.info('SQLite runtime initialized successfully', { module: 'database-setup', function: 'initializeSQLite' });
    
    // Return an object with the Database constructor
    return { Database };
  } catch (error) {
    debugLog?.error('Failed to initialize SQLite runtime:', { module: 'database-setup', function: 'initializeSQLite', error: error.message });
    throw error;
  }
}

/**
 * Clean up stale lock directories from previous sessions
 * With single-instance enforcement, any lock at startup is stale
 */
function cleanStaleLocks(dbPath) {
  const lockDir = `${dbPath}.lock`;
  
  try {
    if (fs.existsSync(lockDir)) {
      const stats = fs.statSync(lockDir);
      const ageMinutes = (Date.now() - stats.mtimeMs) / 1000 / 60;
      
      debugLog?.info('Removing stale lock directory from previous session', {
        module: 'database-setup',
        function: 'cleanStaleLocks',
        lockDir,
        ageMinutes: Math.round(ageMinutes)
      });
      
      fs.rmSync(lockDir, { recursive: true, force: true });
    }
  } catch (error) {
    debugLog?.error('Failed to remove stale lock directory', {
      module: 'database-setup',
      function: 'cleanStaleLocks',
      lockDir,
      error: error.message
    });
    // Don't throw - allow app to continue and try to open database
  }
}

/**
 * Initialize database connection
 */
async function initializeMainDatabase() {
  try {
    debugLog?.info('Starting database initialization', { 
      module: 'database-setup',
      function: 'initializeMainDatabase' 
    });
    
    // Ensure SQLite runtime is initialized
    const { Database: SQLiteDatabase } = await initializeSQLite();
    
    let dbInstance;
    
    const databaseDirectory = store.get("database_directory");
    debugLog?.info('Database directory from settings', { 
      module: 'database-setup',
      function: 'initializeMainDatabase',
      databaseDirectory 
    });
    
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
        debugLog?.info(`Found mrvoice.db in configured directory: ${dbPath}`, { module: 'database-setup', function: 'initializeMainDatabase' });
      } else if (fs.existsSync(mxvoiceDbPath)) {
        dbName = "mxvoice.db";
        dbPath = mxvoiceDbPath;
        debugLog?.info(`Found mxvoice.db in configured directory: ${dbPath}`, { module: 'database-setup', function: 'initializeMainDatabase' });
      } else {
        // No existing database, create new mxvoice.db in configured directory
        dbName = "mxvoice.db";
        dbPath = mxvoiceDbPath;
        debugLog?.info(`No existing database found, will create: ${dbPath}`, { module: 'database-setup', function: 'initializeMainDatabase' });
      }
    } else {
      // Fallback to default location only if no directory is configured
      debugLog?.warn('Database directory not set in preferences, using default userData location', { module: 'database-setup', function: 'initializeMainDatabase' });
      const defaultDbPath = path.join(app.getPath('userData'), 'data');
      if (!fs.existsSync(defaultDbPath)) {
        fs.mkdirSync(defaultDbPath, { recursive: true });
      }
      dbName = "mxvoice.db";
      dbPath = path.join(defaultDbPath, dbName);
      debugLog?.info(`Using default database path: ${dbPath}`, { module: 'database-setup', function: 'initializeMainDatabase' });
    }
    
    // Clean up any stale lock directories from previous sessions
    cleanStaleLocks(dbPath);
    
    if (fs.existsSync(dbPath)) {
      try {
        debugLog?.info('Opening existing database in file mode...', { module: 'database-setup', function: 'initializeMainDatabase', dbPath });
        // Open existing database directly in file mode
        dbInstance = new SQLiteDatabase(dbPath);
        debugLog?.info('Successfully opened existing database in file mode', { module: 'database-setup', function: 'initializeMainDatabase' });
      } catch (error) {
        debugLog?.warn('Failed to open existing database, creating new one:', { module: 'database-setup', function: 'initializeMainDatabase', error: error.message });
        
        // Create backup of problematic file
        const backupPath = `${dbPath}.backup-${Date.now()}`;
        try {
          const data = fs.readFileSync(dbPath);
          fs.writeFileSync(backupPath, data);
          debugLog?.info(`Created backup of problematic database at: ${backupPath}`, { module: 'database-setup', function: 'initializeMainDatabase' });
        } catch (backupError) {
                      debugLog?.warn('Could not create backup:', { module: 'database-setup', function: 'initializeMainDatabase', error: backupError.message });
        }
        
        // Create fresh database
        dbInstance = new SQLiteDatabase(dbPath);
        debugLog?.info('Created new database after failed load', { module: 'database-setup', function: 'initializeMainDatabase' });
      }
    } else {
      // Create new database
      debugLog?.info('Creating new database...', { module: 'database-setup', function: 'initializeMainDatabase', dbPath });
      dbInstance = new SQLiteDatabase(dbPath);
              debugLog?.info('New database created in file mode', { module: 'database-setup', function: 'initializeMainDatabase' });
    }
    
    // Store the database path for reference
    dbInstance._dbPath = dbPath;
    
          debugLog?.info('Setting up database schema and indexes', { 
        module: 'database-setup',
        function: 'initializeMainDatabase' 
      });
      // Setup database schema and indexes
      await setupDatabaseSchema(dbInstance);
      setupDatabaseIndexes(dbInstance);
      
      debugLog?.info('Database initialization completed successfully', {
        module: 'database-setup',
        function: 'initializeMainDatabase',
        dbType: typeof dbInstance,
        constructor: dbInstance?.constructor?.name,
        methods: Object.getOwnPropertyNames(Object.getPrototypeOf(dbInstance || {})),
        hasExec: typeof dbInstance?.exec === 'function',
        hasPrepare: typeof dbInstance?.prepare === 'function',
        hasAll: typeof dbInstance?.all === 'function',
        hasRun: typeof dbInstance?.run === 'function'
      });
      return dbInstance;
  } catch (error) {
    debugLog?.error('Error initializing database:', { module: 'database-setup', function: 'initializeMainDatabase', error: error.message, stack: error.stack });
    
    // Fallback: create a test database in memory
    debugLog?.info('Creating fallback in-memory database for testing', { module: 'database-setup', function: 'initializeMainDatabase' });
    try {
      dbInstance = new Database(':memory:');
      
      // Create basic tables for testing
      await setupDatabaseSchema(dbInstance);
      setupDatabaseIndexes(dbInstance);
      
      return dbInstance;
    } catch (fallbackError) {
      debugLog?.error('Fallback database creation failed:', { module: 'database-setup', function: 'initializeMainDatabase', error: fallbackError.message, stack: fallbackError.stack });
      
      // Last resort: return null and let the app continue without database
      debugLog?.warn('Returning null database instance - app will continue without database functionality', { module: 'database-setup', function: 'initializeMainDatabase' });
      return null;
    }
  }
}

/**
 * Setup database schema
 */
async function setupDatabaseSchema(db) {
  try {
    debugLog?.info('Setting up database schema', { module: 'database-setup', function: 'setupDatabaseSchema' });
    
    // Create tables if they don't exist using prepared statements
    const categoriesStmt = db.prepare(`
      CREATE TABLE IF NOT EXISTS categories (
        code TEXT PRIMARY KEY,
        description TEXT
      )
    `);
    categoriesStmt.run();
    categoriesStmt.finalize();
    
    const mrvoiceStmt = db.prepare(`
      CREATE TABLE IF NOT EXISTS mrvoice (
        id INTEGER PRIMARY KEY,
        title TEXT,
        artist TEXT,
        category TEXT,
        info TEXT,
        filename TEXT,
        time TEXT,
        modtime INTEGER
      )
    `);
    mrvoiceStmt.run();
    mrvoiceStmt.finalize();
    
    debugLog?.info('Database schema setup completed', { module: 'database-setup', function: 'setupDatabaseSchema' });
  } catch (error) {
    debugLog?.error('Error setting up database schema:', { module: 'database-setup', function: 'setupDatabaseSchema', error: error.message, stack: error.stack });
    throw error;
  }
}

/**
 * Setup database indexes for better performance
 */
function setupDatabaseIndexes(db) {
  try {
    debugLog?.info('Setting up database indexes', { module: 'database-setup', function: 'setupDatabaseIndexes' });
    
    // Category indexes
    const categoryCodeStmt = db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS 'category_code_index' ON categories(code)");
    categoryCodeStmt.run();
    categoryCodeStmt.finalize();
    
    const categoryDescStmt = db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS 'category_description_index' ON categories(description)");
    categoryDescStmt.run();
    categoryDescStmt.finalize();

    // Search indexes for better performance
    const titleStmt = db.prepare("CREATE INDEX IF NOT EXISTS 'idx_title' ON mrvoice(title)");
    titleStmt.run();
    titleStmt.finalize();
    
    const artistStmt = db.prepare("CREATE INDEX IF NOT EXISTS 'idx_index' ON mrvoice(artist)");
    artistStmt.run();
    artistStmt.finalize();
    
    const infoStmt = db.prepare("CREATE INDEX IF NOT EXISTS 'idx_info' ON mrvoice(info)");
    infoStmt.run();
    infoStmt.finalize();
    
    const categoryStmt = db.prepare("CREATE INDEX IF NOT EXISTS 'idx_category' ON mrvoice(category)");
    categoryStmt.run();
    categoryStmt.finalize();
    
    debugLog?.info('Database indexes setup completed', { module: 'database-setup', function: 'setupDatabaseIndexes' });
  } catch (error) {
    debugLog?.warn('Error setting up database indexes:', { module: 'database-setup', function: 'setupDatabaseIndexes', error: error.message });
  }
}



/**
 * Get the current database instance
 */
function getMainDatabase() {
  return dbInstance;
}

export {
  initializeMainDatabase,
  getMainDatabase
};

// Default export for module loading
export default {
  initializeMainDatabase,
  setupDatabaseSchema,
  setupDatabaseIndexes,
  getMainDatabase
};