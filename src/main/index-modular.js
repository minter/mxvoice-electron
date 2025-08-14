/**
 * Main Process Entry Point
 * 
 * This is the main entry point for the MxVoice Electron application.
 * It handles app initialization, IPC setup, and main process functionality.
 * 
 * CONTEXT ISOLATION ENABLED - This version uses secure IPC communication
 * and preload scripts for enhanced security.
 */

import { app, ipcMain } from 'electron';
import path from 'path';
import os from 'os';
import fs from 'fs';
import readlines from 'n-readlines';
import Store from 'electron-store';
import log from 'electron-log';
import { initializeDatabase, getDatabase } from '../preload/modules/database-setup.js';
import { Howl, Howler } from 'howler';
import electronUpdater from 'electron-updater';
import markdownIt from 'markdown-it';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES6 modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import main process modules
import * as appSetup from './modules/app-setup.js';
import * as ipcHandlers from './modules/ipc-handlers.js';
import * as fileOperations from './modules/file-operations.js';
import initializeMainDebugLog from './modules/debug-log.js';
import { initMainLogService } from './modules/log-service.js';

// Initialize Octokit for GitHub API
let octokit;
import("@octokit/rest")
  .then(({ Octokit }) => {
    octokit = new Octokit();
  })
  .catch(err => {
    debugLog.error("Failed to load Octokit module", { 
      function: "Octokit initialization",
      error: err.message 
    });
  });

// Initialize markdown parser
const md = markdownIt();

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

// Use a stable config file name and explicit project directory to ensure
// consistent persistence across platforms/build modes (notably Windows)
const store = new Store({
  defaults: defaults,
  name: 'config',
  projectName: app.getName(),
  clearInvalidConfig: true
});

// Initialize main process DebugLog
const debugLog = initializeMainDebugLog({ store });
// Centralized Log Service for file persistence and export
const logService = initMainLogService({ store });

// Log the resolved store path for diagnostics (after logger is initialized)
debugLog.info('Electron Store initialized', { function: 'store-init', storePath: store.path, appName: app.getName() });

// Auto-updater configuration
const { autoUpdater } = electronUpdater;

// Configure auto-updater to use our debug logger instead of electron-log
autoUpdater.logger = {
  info: (message) => debugLog.info(`[AutoUpdater] ${message}`, { module: 'auto-updater' }),
  warn: (message) => debugLog.warn(`[AutoUpdater] ${message}`, { module: 'auto-updater' }),
  error: (message) => debugLog.error(`[AutoUpdater] ${message}`, { module: 'auto-updater' }),
  debug: (message) => debugLog.debug(`[AutoUpdater] ${message}`, { module: 'auto-updater' }),
  log: (message) => debugLog.info(`[AutoUpdater] ${message}`, { module: 'auto-updater' })
};

// Set architecture-aware update feed URL for macOS
if (process.platform === "darwin") {
  const currentVersion = getTestVersion(); // Use test version if available
  
  if (currentVersion.startsWith('4.')) {
    // 4.0+ users: Use GitHub provider for multi-architecture support
    debugLog.info(`Using GitHub provider for version ${currentVersion}`, { 
      function: "auto-updater setup",
      provider: "github"
    });
    
    // Allow pre-releases like 4.0.0-pre.X
    autoUpdater.allowPrerelease = true;
    // Do not auto-download; wait for explicit user action
    autoUpdater.autoDownload = false;
    
    // Explicitly configure GitHub provider; allow prereleases and let provider resolve URLs
    autoUpdater.setFeedURL({ 
      provider: "github",
      owner: "minter",
      repo: "mxvoice-electron",
      private: false,
      channel: "latest"
    });
  } else {
    // 3.x users: Use your custom server (legacy support)
    debugLog.info(`Using custom server for version ${currentVersion}`, { 
      function: "auto-updater setup",
      provider: "custom",
      server: "download.mxvoice.app"
    });
    const server = "https://download.mxvoice.app";
    const arch = process.arch; // 'x64' or 'arm64'
    const feed = `${server}/update/darwin/${arch}/${currentVersion}`;
    autoUpdater.setFeedURL({ provider: "generic", url: feed });
  }
}

// Global variables
let mainWindow;
let db; // Database connection for main process
let audioInstances = new Map(); // Track audio instances in main process
const updateState = { downloaded: false, userApprovedInstall: false };

// Enable live reload (only in development)
// Use dynamic import for electron-util to avoid CommonJS module issues
import('electron-util').then(electronUtil => {
  if (electronUtil.is && electronUtil.is.development) {
    // Use dynamic import for electron-reload to avoid ES6 module issues
    import('electron-reload').then(electronReload => {
      try {
        electronReload.default(__dirname);
        debugLog.info('Electron reload enabled for development', { 
          function: "electron-reload setup" 
        });
      } catch (error) {
        debugLog.warn('Electron reload failed', { 
          function: "electron-reload setup",
          error: error.message 
        });
      }
    }).catch(error => {
      debugLog.warn('Could not load electron-reload', { 
        function: "electron-reload import",
        error: error.message 
      });
    });
  }
}).catch(error => {
  debugLog.warn('Could not load electron-util', { 
    function: "electron-util import",
    error: error.message 
  });
});

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// Use dynamic import for electron-squirrel-startup to avoid CommonJS issues
import('electron-squirrel-startup').then(electronSquirrelStartup => {
  if (electronSquirrelStartup.default) {
    app.quit();
  }
}).catch(error => {
  debugLog.warn('Could not load electron-squirrel-startup', { 
    function: "electron-squirrel-startup import",
    error: error.message 
  });
});

// Initialize database
async function initializeMainDatabase() {
  try {
    debugLog.info('Initializing main database', { 
      function: "initializeMainDatabase" 
    });
    
    db = await initializeDatabase();
    debugLog.info('Main database initialized successfully', { 
      function: "initializeMainDatabase" 
    });
  } catch (error) {
    debugLog.error('Error initializing main database', { 
      function: "initializeMainDatabase",
      error: error.message 
    });
  }
}

// Check first run
async function checkFirstRun() {
  debugLog.info(`First run preference returns ${store.get('first_run_completed')}`, { 
    function: "checkFirstRun" 
  });
  if (!store.get('first_run_completed')) {
    const oldConfig = checkOldConfig();
    debugLog.info(`Old config function returned ${oldConfig}`, { 
      function: "checkFirstRun" 
    });
    if (oldConfig) {
      debugLog.info("Migrated old config settings, checking no further", { 
        function: "checkFirstRun" 
      });
    } else {
      debugLog.info("Preparing for first-time setup", { 
        function: "checkFirstRun" 
      });
      fs.mkdirSync(store.get('music_directory'), { recursive: true });
      fs.mkdirSync(store.get('hotkey_directory'), { recursive: true });

      // Initialize database for first run
      const initDb = await initializeDatabase();
      
      // Insert initial data
      initDb.run(`INSERT OR IGNORE INTO categories VALUES('UNC', 'Uncategorized')`);
      initDb.run(`INSERT OR IGNORE INTO mrvoice (title, artist, category, filename, time, modtime) VALUES (?, ?, ?, ?, ?, ?)`, 
        ['Rock Bumper', 'Patrick Short', 'UNC', 'PatrickShort-CSzRockBumper.mp3', '00:49', Math.floor(Date.now() / 1000)]);
      
      // Save the database to file
      const dbPath = path.join(store.get('database_directory'), 'mxvoice.db');
      const data = initDb.export();
      fs.writeFileSync(dbPath, data);
      
      fs.copyFileSync(path.join(__dirname, '..', 'assets', 'music', 'CSz Rock Bumper.mp3'), path.join(store.get('music_directory'), 'PatrickShort-CSzRockBumper.mp3'));
      debugLog.info(`mxvoice.db created at ${store.get('database_directory')}`, { 
        function: "checkFirstRun" 
      });
      store.set('first_run_completed', true);
    }
  }
}

// Check old config
function checkOldConfig() {
  let config_path;
  if (process.platform == 'darwin') {
    config_path = path.join(app.getPath('home'), 'mrvoice.cfg');
  }
  else if (process.platform == 'win32') {
    config_path = path.join('C:', 'mrvoice.cfg');
  }

  if (fs.existsSync(config_path)) {
    // An old config file exists, we need to load the preferences
    debugLog.info(`Found old Mr. Voice 2 config file at ${config_path}`, { 
      function: "checkOldConfig" 
    });
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
    //   if ( err ) debugLog.error('RENAME ERROR', { 
    //     function: "checkOldConfig",
    //     error: err.message 
    //   });
    // });
  } else {
    return false;
  }
}

// Track user (analytics placeholder)
function trackUser() {
  // Placeholder for user tracking/analytics
  debugLog.info('User tracking initialized', { 
    function: "trackUser" 
  });
}

// Initialize all modules with dependencies
function initializeModules() {
  const dependencies = {
    mainWindow,
    db,
    store,
    audioInstances,
    autoUpdater,
    fileOperations,
    debugLog,
    updateState,
    logService
  };

  // Initialize each module
  appSetup.initializeAppSetup(dependencies);
  
  console.log('🚀 [MAIN] Initializing IPC handlers...');
  console.log('🚀 [MAIN] autoUpdater available:', !!dependencies.autoUpdater);
  console.log('🚀 [MAIN] autoUpdater type:', typeof dependencies.autoUpdater);
  
  ipcHandlers.initializeIpcHandlers(dependencies);
  
  console.log('🚀 [MAIN] IPC handlers initialized');
  
  fileOperations.initializeFileOperations(dependencies);
}

// Main window creation function
const createWindow = async () => {
  // Check first run (which also checks old config)
  await checkFirstRun();
  
  // Initialize database connection for main process
  await initializeMainDatabase();

  // Create the window with restored size from store
  mainWindow = appSetup.createWindow({
    width: store.get('browser_width') || defaults.browser_width,
    height: store.get('browser_height') || defaults.browser_height
  });

  // Initialize modules with dependencies AFTER mainWindow is created
  initializeModules();

  // Migrate old preferences after modules are initialized
  fileOperations.migrateOldPreferences();

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
    
    // Test auto-update scenarios if enabled
    testAutoUpdateScenarios();
  });

  // Setup auto-updater events
  autoUpdater.on('update-available', (updateInfo) => {
    updateState.downloaded = false;
    debugLog.info(`Update available: ${updateInfo.releaseName}`, { 
      function: "autoUpdater update-available",
      currentVersion: app.getVersion(),
      updateVersion: updateInfo.releaseName,
      provider: app.getVersion().startsWith('4.') ? 'github' : 'custom'
    });
    mainWindow.webContents.send('display_release_notes', updateInfo.releaseName, `<h1>Version ${updateInfo.releaseName}</h1>` + updateInfo.releaseNotes);
    debugLog.info('display_release_notes call done', { 
      function: "autoUpdater update-available" 
    });
  });

  // Add more auto-updater event logging for testing
  autoUpdater.on('checking-for-update', () => {
    debugLog.info('Checking for updates...', { 
      function: "autoUpdater checking-for-update",
      currentVersion: app.getVersion(),
      provider: app.getVersion().startsWith('4.') ? 'github' : 'custom'
    });
  });

  autoUpdater.on('update-not-available', () => {
    debugLog.info('No updates available', { 
      function: "autoUpdater update-not-available",
      currentVersion: app.getVersion(),
      provider: app.getVersion().startsWith('4.') ? 'github' : 'custom'
    });
  });

  autoUpdater.on('error', (err) => {
    debugLog.error(`Auto-updater error: ${err.message}`, { 
      function: "autoUpdater error",
      currentVersion: app.getVersion(),
      provider: app.getVersion().startsWith('4.') ? 'github' : 'custom',
      error: err.message
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    try { mainWindow?.webContents.send('update_download_progress', progress || {}); } catch (_) {}
    debugLog.info('Auto-updater download progress', { function: 'autoUpdater download-progress', ...progress });
  });

  autoUpdater.on('update-downloaded', (info) => {
    updateState.downloaded = true;
    try { mainWindow?.webContents.send('update_ready', info?.version || ''); } catch (_) {}
    debugLog.info('Update downloaded and ready to install', { function: 'autoUpdater update-downloaded', version: info?.version });
    // If user already approved install, proceed automatically now
    if (updateState.userApprovedInstall) {
      try {
        debugLog.info('User approved install earlier; quitting to install now', { function: 'autoUpdater update-downloaded' });
        autoUpdater.quitAndInstall();
      } catch (e) {
        debugLog.error('Auto-install on ready failed', { function: 'autoUpdater update-downloaded', error: e?.message });
      }
    }
  });
}

// Test function to verify modular main process is working
function testModularMain() {
  debugLog.info('Testing Modular Main Process...', { 
    function: "testModularMain" 
  });
  
  // Test each module
  const appSetupTest = appSetup.testAppSetup();
  const ipcHandlersTest = ipcHandlers.testIpcHandlers();
  const fileOperationsTest = fileOperations.testFileOperations();
  
  if (appSetupTest && ipcHandlersTest && fileOperationsTest) {
    debugLog.info('Modular main process is working correctly!', { 
      function: "testModularMain" 
    });
    return true;
  } else {
    debugLog.warn('Modular main process has issues', { 
      function: "testModularMain" 
    });
    return false;
  }
}

// Temporary testing functions for auto-update validation
function testAutoUpdateScenarios() {
  if (process.env.TEST_AUTO_UPDATE === 'true') {
    debugLog.info('Testing auto-update scenarios...', { 
      function: "testAutoUpdateScenarios" 
    });
    
    const currentVersion = getTestVersion(); // Use test version if available
    const isV4 = currentVersion.startsWith('4.');
    
    debugLog.info(`Current version: ${currentVersion}, Provider: ${isV4 ? 'github' : 'custom'}`, { 
      function: "testAutoUpdateScenarios",
      version: currentVersion,
      provider: isV4 ? 'github' : 'custom'
    });
    
    // Test provider configuration
    if (isV4) {
      debugLog.info('Testing GitHub provider configuration', { 
        function: "testAutoUpdateScenarios",
        owner: "minter",
        repo: "mxvoice-electron"
      });
    } else {
      debugLog.info('Testing custom server configuration', { 
        function: "testAutoUpdateScenarios",
        server: "https://download.mxvoice.app",
        arch: process.arch
      });
    }
    
    // Simulate update check for testing
    setTimeout(() => {
      debugLog.info('Simulating update check for testing...', { 
        function: "testAutoUpdateScenarios" 
      });
      if (autoUpdater) {
        autoUpdater.checkForUpdatesAndNotify();
      }
    }, 3000);
  }
}

// Version override for testing - allows testing different versions without package.json changes
function getTestVersion() {
  if (process.env.TEST_UPDATE_VERSION) {
    const originalVersion = app.getVersion();
    debugLog.info(`Using test version override: ${process.env.TEST_UPDATE_VERSION}`, { 
      function: "getTestVersion",
      originalVersion: originalVersion,
      testVersion: process.env.TEST_UPDATE_VERSION
    });
    return process.env.TEST_UPDATE_VERSION;
  }
  return app.getVersion();
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