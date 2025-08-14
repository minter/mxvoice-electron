/**
 * Main Process Database Setup Module
 * 
 * Handles database initialization and setup for the main process.
 * This is separate from the preload database setup to handle different contexts.
 */

import Store from 'electron-store';
import path from 'path';
import fs from 'fs';
import initSqlJs from 'sql.js';
import { app } from 'electron';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES6 modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const store = new Store({ name: 'config' });

let dbInstance = null;
let sqlWasm = null;

async function initializeSqlJs() {
  if (!sqlWasm) {
    try {
      sqlWasm = await initSqlJs({
        locateFile: file => {
          // Determine the correct path for SQL.js WASM files
          let wasmPath;
          
          // Check if we're in development mode (not packaged)
          const isDevelopment = !app.isPackaged;
          
          if (isDevelopment) {
            // Development mode: use relative path from project root
            wasmPath = path.join(__dirname, '..', '..', '..', 'node_modules/sql.js/dist', file);
          } else {
            // Production mode: use unpacked resources path
            wasmPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules/sql.js/dist', file);
          }
          
          console.log('Attempting to load SQL.js WASM', {
            development: isDevelopment,
            wasmPath,
            resourcesPath: process.resourcesPath,
            currentDir: __dirname,
            requestedFile: file,
            isPackaged: app.isPackaged,
            pathComponents: {
              dirname: __dirname,
              up1: path.join(__dirname, '..'),
              up2: path.join(__dirname, '..', '..'),
              up3: path.join(__dirname, '..', '..', '..'),
              finalPath: wasmPath
            }
          });
          
          return wasmPath;
        }
      });
      console.log('SQL.js WASM loaded successfully');
    } catch (error) {
      console.error('Failed to load SQL.js WASM:', error);
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
    
    console.log(`Looking for database in ${databaseDirectory}`);
    
    let dbPath;
    // Handle case where database directory is not set
    if (!databaseDirectory) {
      console.warn('Database directory not set, using default');
      const defaultDbPath = path.join(app.getPath('userData'), 'data');
      if (!fs.existsSync(defaultDbPath)) {
        fs.mkdirSync(defaultDbPath, { recursive: true });
      }
      dbPath = path.join(defaultDbPath, dbName);
      console.log(`Using default database path: ${dbPath}`);
    } else {
      if (fs.existsSync(path.join(databaseDirectory, "mrvoice.db"))) {
        dbName = "mrvoice.db";
      }
      dbPath = path.join(databaseDirectory, dbName);
      console.log(`Attempting to open database file ${dbPath}`);
    }
    
    // Try to load existing database file
    if (fs.existsSync(dbPath)) {
      try {
        const data = fs.readFileSync(dbPath);
        dbInstance = new sqlWasm.Database(data);
        console.log('Existing database loaded successfully');
      } catch (error) {
        console.warn('Failed to load existing database, creating new one:', error);
        dbInstance = new sqlWasm.Database();
      }
    } else {
      // Create new database
      dbInstance = new sqlWasm.Database();
      console.log('New database created');
    }
    
    // Setup database schema and indexes
    await setupDatabaseSchema(dbInstance);
    setupDatabaseIndexes(dbInstance);
    
    return dbInstance;
  } catch (error) {
    console.error('Error initializing database:', error);
    
    // Fallback: create a test database in memory
    console.log('Creating fallback in-memory database for testing');
    try {
      await initializeSqlJs();
      dbInstance = new sqlWasm.Database();
      
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
    
    console.log('Database schema setup completed');
  } catch (error) {
    console.error('Error setting up database schema:', error);
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
    
    console.log('Database indexes setup completed');
  } catch (error) {
    console.warn('Error setting up database indexes:', error);
  }
}

// Save database to file
function saveDatabase(db, filePath) {
  try {
    const data = db.export();
    fs.writeFileSync(filePath, data);
    console.log(`Database saved to ${filePath}`);
  } catch (error) {
    console.error('Error saving database:', error);
    throw error;
  }
}

// Get the database instance
function getDatabase() {
  return dbInstance;
}

export {
  initializeDatabase,
  setupDatabaseSchema,
  setupDatabaseIndexes,
  saveDatabase,
  getDatabase
};

// Default export for module loading
export default {
  initializeDatabase,
  setupDatabaseSchema,
  setupDatabaseIndexes,
  saveDatabase,
  getDatabase
};
