/**
 * Main Process Entry Point
 * 
 * This is the main entry point for the MxVoice Electron application.
 * It handles app initialization, IPC setup, and main process functionality.
 */

import { app, ipcMain } from 'electron';
import path from 'path';
import { is } from 'electron-util';
import os from 'os';
import fs from 'fs';
import readlines from 'n-readlines';
import Store from 'electron-store';
import log from 'electron-log';
import Database from 'better-sqlite3';
import { Howl, Howler } from 'howler';
import { autoUpdater } from "electron-updater";
import markdownIt from 'markdown-it';
import electronReload from 'electron-reload';
import electronSquirrelStartup from 'electron-squirrel-startup';

// Import main process modules
import * as appSetup from './modules/app-setup.js';
import * as ipcHandlers from './modules/ipc-handlers.js';
import * as fileOperations from './modules/file-operations.js';

console.log = log.log;

// Initialize Octokit for GitHub API
let octokit;
import("@octokit/rest")
  .then(({ Octokit }) => {
    octokit = new Octokit();
  })
  .catch(err => {
    console.error("Failed to load Octokit module:", err);
  });

// Initialize markdown parser
var md = markdownIt();

// Store configuration
const defaults = {
  browser_width: 1280,
  browser_height: 1024,
  music_directory: path.join(app.getPath('userData'), 'mp3'),
  hotkey_directory: path.join(app.getPath('userData'), 'hotkeys'),
  database_directory: app.getPath('userData'),
  fade_out_seconds: 2,
  first_run_completed: false
}

const store = new Store({
  defaults: defaults
});

// Auto-updater configuration
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = "info";

// Set architecture-aware update feed URL for macOS
if (process.platform === "darwin") {
  const server = "https://download.mxvoice.app";
  const arch = process.arch; // 'x64' or 'arm64'
  const feed = `${server}/update/darwin/${arch}/${app.getVersion()}`;
  autoUpdater.setFeedURL({ provider: "generic", url: feed });
}

// Global variables
let mainWindow;
let db; // Database connection for main process
let audioInstances = new Map(); // Track audio instances in main process

// Enable live reload
if (is.development) {
  electronReload(__dirname);
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (electronSquirrelStartup) {
  app.quit();
}

// Initialize database
function initializeDatabase() {
  try {
    var dbName = "mxvoice.db";
    const dbDir = store.get("database_directory");
    console.log(`Looking for database in ${dbDir}`);
    
    // Handle undefined database directory
    if (!dbDir) {
      const defaultDbPath = path.join(__dirname, '..', '..', 'data', 'mxvoice.db');
      console.log(`Using default database path: ${defaultDbPath}`);
      db = Database(defaultDbPath);
      return;
    }
    
    if (fs.existsSync(path.join(dbDir, "mrvoice.db"))) {
      dbName = "mrvoice.db";
    }
    console.log(
      `Attempting to open database file ${path.join(dbDir, dbName)}`
    );
    db = Database(path.join(dbDir, dbName));
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

// Check first run
function checkFirstRun() {
  console.log(`First run preference returns ${store.get('first_run_completed')}`);
  if (!store.get('first_run_completed')) {
    var oldConfig = checkOldConfig();
    console.log(`Old config function returned ${oldConfig}`);
    if (oldConfig) {
      console.log("Migrated old config settings, checking no further");
    } else {
      console.log("Preparing for first-time setup");
      fs.mkdirSync(store.get('music_directory'), { recursive: true });
      fs.mkdirSync(store.get('hotkey_directory'), { recursive: true });

      const initDb = Database(path.join(store.get('database_directory'), 'mxvoice.db'));
      initDb.exec(`CREATE TABLE IF NOT EXISTS 'categories' (   code varchar(8) NOT NULL,   description varchar(255) NOT NULL );
CREATE TABLE IF NOT EXISTS mrvoice (   id INTEGER PRIMARY KEY,   title varchar(255) NOT NULL,   artist varchar(255),   category varchar(8) NOT NULL,   info varchar(255),   filename varchar(255) NOT NULL,   time varchar(10),   modtime timestamp(6),   publisher varchar(16),   md5 varchar(32) );
CREATE UNIQUE INDEX IF NOT EXISTS 'category_code_index' ON categories(code);
CREATE UNIQUE INDEX IF NOT EXISTS 'category_description_index' ON categories(description);
INSERT OR IGNORE INTO categories VALUES('UNC', 'Uncategorized');
INSERT OR IGNORE INTO mrvoice (title, artist, category, filename, time, modtime) VALUES ('Rock Bumper', 'Patrick Short', 'UNC', 'PatrickShort-CSzRockBumper.mp3', '00:49', '${Math.floor(Date.now() / 1000)}');
`);
      fs.copyFileSync(path.join(__dirname, '..', 'assets', 'music', 'CSz Rock Bumper.mp3'), path.join(store.get('music_directory'), 'PatrickShort-CSzRockBumper.mp3'));
      console.log(`mxvoice.db created at ${store.get('database_directory')}`);
      initDb.close();
      store.set('first_run_completed', true);
    }
  }
}

// Check old config
function checkOldConfig() {
  var config_path;
  if (process.platform == 'darwin') {
    config_path = path.join(app.getPath('home'), 'mrvoice.cfg');
  }
  else if (process.platform == 'win32') {
    config_path = path.join('C:', 'mrvoice.cfg');
  }

  if (fs.existsSync(config_path)) {
    // An old config file exists, we need to load the preferences
    console.log("Found old Mr. Voice 2 config file at " + config_path);
    old_settings = [];

    const line_reader = new readlines(config_path);

    while (line = line_reader.next()) {
      [key, val] = line.toString().trim().split('::');
      old_settings[key] = val;
    }
    store.set('database_directory', path.dirname(old_settings['db_file']));
    store.set('music_directory', old_settings['filepath']);
    store.set('hotkey_directory', old_settings['savedir']);
    store.set('first_run_completed', true);
    return true;

    // Save renaming the old config file for final releases
    // fs.rename(config_path, config_path + '.converted', function(err) {
    //   if ( err ) console.log('RENAME ERROR: ' + err);
    // });
  } else {
    return false;
  }
}

// Track user (analytics placeholder)
function trackUser() {
  // Placeholder for user tracking/analytics
  console.log('User tracking initialized');
}

// Initialize all modules with dependencies
function initializeModules() {
  const dependencies = {
    mainWindow,
    db,
    store,
    audioInstances,
    autoUpdater
  };

  // Initialize each module
  appSetup.initializeAppSetup(dependencies);
  ipcHandlers.initializeIpcHandlers(dependencies);
  fileOperations.initializeFileOperations(dependencies);
}

// Main window creation function
const createWindow = () => {
  // Check first run (which also checks old config)
  checkFirstRun();
  
  // Initialize database connection for main process
  initializeDatabase();

  // Initialize modules with dependencies
  initializeModules();

  // Migrate old preferences after modules are initialized
  fileOperations.migrateOldPreferences();

  // Create the window
  mainWindow = appSetup.createWindow();

  // Create the menu
  appSetup.createApplicationMenu();

  // Track user
  trackUser();
};

// Setup app lifecycle
function setupApp() {
  // Setup app lifecycle events
  appSetup.setupAppLifecycle();

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  app.on('ready', () => {
    createWindow();
  });

  // Setup auto-updater events
  autoUpdater.on('update-available', (updateInfo) => {
    console.log(`Triggering update-available action with info ${updateInfo.releaseNotes}`);
    mainWindow.webContents.send('display_release_notes', updateInfo.releaseName, `<h1>Version ${updateInfo.releaseName}</h1>` + updateInfo.releaseNotes);
    console.log(`display_release_notes call done`);
  });
}

// Test function to verify modular main process is working
function testModularMain() {
  console.log('🧪 Testing Modular Main Process...');
  
  // Test each module
  const appSetupTest = appSetup.testAppSetup();
  const ipcHandlersTest = ipcHandlers.testIpcHandlers();
  const fileOperationsTest = fileOperations.testFileOperations();
  
  if (appSetupTest && ipcHandlersTest && fileOperationsTest) {
    console.log('✅ Modular main process is working correctly!');
    return true;
  } else {
    console.log('❌ Modular main process has issues');
    return false;
  }
}

// Initialize the app
setupApp();

// Export for testing
export {
  appSetup,
  ipcHandlers,
  fileOperations,
  testModularMain
};

// Default export for module loading
export default {
  appSetup,
  ipcHandlers,
  fileOperations,
  testModularMain
}; 