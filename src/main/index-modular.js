/**
 * Main Process Entry Point
 * 
 * This is the main entry point for the MxVoice Electron application.
 * It handles app initialization, IPC setup, and main process functionality.
 * 
 * CONTEXT ISOLATION ENABLED - This version uses secure IPC communication
 * and preload scripts for enhanced security.
 */

// Add immediate logging to see if the file is being loaded
// Note: debugLog will be initialized later in this file

import { app, ipcMain } from 'electron';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';
import readlines from 'n-readlines';
import Store from 'electron-store';
import log from 'electron-log';
import { Howl, Howler } from 'howler';
import electronUpdater from 'electron-updater';
import markdownIt from 'markdown-it';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES6 modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In test mode, allow overriding Electron's userData path to ensure isolation
// Must run BEFORE creating the Store or computing defaults that depend on userData
const E2E_USER_DATA_DIR = process.env.E2E_USER_DATA_DIR || process.env.APP_TEST_USER_DATA_DIR;
if (process.env.APP_TEST_MODE === '1' || E2E_USER_DATA_DIR) {
  const testUserData = E2E_USER_DATA_DIR || path.join(process.cwd(), 'tests', 'fixtures', 'test-user-data');
  try {
    fs.mkdirSync(testUserData, { recursive: true });
  } catch (_) {}
  app.setPath('userData', testUserData);
}

// Import main process modules
import * as appSetup from './modules/app-setup.js';
import * as ipcHandlers from './modules/ipc-handlers.js';
import * as fileOperations from './modules/file-operations.js';
import initializeMainDebugLog from './modules/debug-log.js';
import { initMainLogService } from './modules/log-service.js';
import * as profileManager from './modules/profile-manager.js';
import * as launcherWindow from './modules/launcher-window.js';

// Initialize Octokit for GitHub API (will be initialized after debugLog is available)
let octokit;

// Initialize markdown parser
const md = markdownIt();

// Profile context - set via command line arg or launcher
let currentProfile = null;

/**
 * Parse command line arguments to check for profile
 * @returns {string|null} Profile name if provided, null otherwise
 */
function getProfileFromArgs() {
  const args = process.argv.slice(1); // Skip electron executable
  
  for (const arg of args) {
    if (arg.startsWith('--profile=')) {
      return arg.substring('--profile='.length);
    }
  }
  
  return null;
}

/**
 * Get the current active profile
 * @returns {string} Current profile name
 */
export function getCurrentProfile() {
  return currentProfile || 'Default User';
}

/**
 * Get profile-specific directory path
 * @param {string} type - Type of directory ('hotkeys', 'holding-tank', etc.)
 * @returns {string} Profile-specific directory path
 */
export function getProfileDirectory(type) {
  const profile = getCurrentProfile();
  const sanitized = profileManager.sanitizeProfileName(profile);
  const profilesDir = profileManager.getProfilesDirectory();
  
  switch (type) {
    case 'hotkeys':
      return path.join(profilesDir, sanitized, 'hotkeys');
    case 'holding-tank':
      return path.join(profilesDir, sanitized, 'holding-tank');
    case 'preferences':
      return path.join(profilesDir, sanitized);
    default:
      return path.join(profilesDir, sanitized);
  }
}

// Streaming file copy function for large files with progress tracking
async function copyFileStreaming(source, destination, progressCallback = null) {
  let sourceStream = null;
  let destStream = null;
  
  try {
    // Validate source file exists
    if (!fs.existsSync(source)) {
      throw new Error(`Source file does not exist: ${source}`);
    }
    
    // Ensure destination directory exists
    const destDir = path.dirname(destination);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    
    sourceStream = createReadStream(source);
    destStream = createWriteStream(destination);
    
    let bytesCopied = 0;
    let totalSize = 0;
    
    // Get file size for progress tracking
    try {
      const stats = fs.statSync(source);
      totalSize = stats.size;
    } catch (statError) {
      debugLog?.warn('Could not get file size for progress tracking', { 
        function: 'copyFileStreaming',
        source
      });
    }
    
    // Track progress if callback provided and we have total size
    if (progressCallback && totalSize > 0) {
      sourceStream.on('data', (chunk) => {
        bytesCopied += chunk.length;
        const progress = Math.round((bytesCopied / totalSize) * 100);
        progressCallback(progress, bytesCopied, totalSize);
      });
    }
    
    // Handle stream errors
    sourceStream.on('error', (error) => {
      debugLog?.error('Source stream error:', { 
        function: 'copyFileStreaming', 
        error: error.message,
        source
      });
    });
    
    destStream.on('error', (error) => {
      debugLog?.error('Destination stream error:', { 
        function: 'copyFileStreaming', 
        error: error.message,
        destination
      });
    });
    
    await pipeline(sourceStream, destStream);
    
    if (progressCallback) {
      progressCallback(100, totalSize, totalSize);
    }
    
    return { success: true, bytesCopied: totalSize };
  } catch (error) {
    // Clean up partial file if it exists
    try {
      if (fs.existsSync(destination)) {
        fs.unlinkSync(destination);
        debugLog?.info('Cleaned up partial destination file', { 
          function: 'copyFileStreaming',
          destination
        });
      }
    } catch (cleanupError) {
      debugLog?.warn('Failed to clean up partial file', { 
        function: 'copyFileStreaming',
        error: cleanupError.message,
        destination
      });
    }
    
    debugLog?.error('Streaming file copy error:', { 
      function: 'copyFileStreaming', 
      error: error.message,
      source,
      destination
    });
    return { success: false, error: error.message };
  } finally {
    // Ensure streams are properly closed
    if (sourceStream && !sourceStream.destroyed) {
      sourceStream.destroy();
    }
    if (destStream && !destStream.destroyed) {
      destStream.destroy();
    }
  }
}

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

// Add immediate logging now that debugLog is available
debugLog.info('Main process starting...', { 
  module: 'main', 
  function: 'bootstrap',
  timestamp: new Date().toISOString() 
});

// Initialize Octokit for GitHub API now that debugLog is available
import("@octokit/rest")
  .then(({ Octokit }) => {
    octokit = new Octokit();
    debugLog.info('Octokit module loaded successfully', { 
      module: 'main', 
      function: 'Octokit initialization' 
    });
  })
  .catch(err => {
    debugLog.error("Failed to load Octokit module", { 
      module: 'main',
      function: "Octokit initialization",
      error: err.message 
    });
  });

// Centralized Log Service for file persistence and export
const logService = initMainLogService({ store });

// Log the resolved store path for diagnostics (after logger is initialized)
debugLog.info('Electron Store initialized', { function: 'store-init', storePath: store.path, appName: app.getName() });

// Auto-updater configuration
const { autoUpdater } = electronUpdater;

debugLog.info('Auto-updater module loaded', { 
  function: "auto-updater setup",
  hasAutoUpdater: !!autoUpdater,
  autoUpdaterType: typeof autoUpdater,
  platform: process.platform,
  arch: process.arch,
  electronVersion: process.versions.electron
});

// Configure auto-updater to use our debug logger instead of electron-log
autoUpdater.logger = {
  info: (message) => debugLog.info(`[AutoUpdater] ${message}`, { 
    module: 'auto-updater',
    platform: process.platform,
    arch: process.arch
  }),
  warn: (message) => debugLog.warn(`[AutoUpdater] ${message}`, { 
    module: 'auto-updater',
    platform: process.platform,
    arch: process.arch
  }),
  error: (message) => debugLog.error(`[AutoUpdater] ${message}`, { 
    module: 'auto-updater',
    platform: process.platform,
    arch: process.arch
  }),
  debug: (message) => debugLog.debug(`[AutoUpdater] ${message}`, { 
    module: 'auto-updater',
    platform: process.platform,
    arch: process.arch
  }),
  log: (message) => debugLog.info(`[AutoUpdater] ${message}`, { 
    module: 'auto-updater',
    platform: process.platform,
    arch: process.arch
  })
};

// Set architecture-aware update feed URL for macOS and Windows
if (process.platform === "darwin" || process.platform === "win32") {
  const currentVersion = app.getVersion(); // Use actual app version for auto-update config
  
  debugLog.info(`Configuring auto-updater for ${process.platform}`, { 
    function: "auto-updater setup",
    platform: process.platform,
    arch: process.arch,
    version: currentVersion,
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node
  });
  
  if (currentVersion.startsWith('4.')) {
    // 4.0+ users: Use GitHub provider for multi-architecture support
    debugLog.info(`Using GitHub provider for version ${currentVersion} on ${process.platform}`, { 
      function: "auto-updater setup",
      provider: "github",
      platform: process.platform,
      arch: process.arch,
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node
    });
    
    // Check user preference for prerelease updates OR if currently running a pre-release version
    const userPrefersPrereleases = store.get('prerelease_updates') || false;
    const isCurrentlyPrerelease = currentVersion.includes('-pre.') || currentVersion.includes('-beta') || currentVersion.includes('-alpha');
    const shouldAllowPrereleases = userPrefersPrereleases || isCurrentlyPrerelease;
    
    autoUpdater.allowPrerelease = shouldAllowPrereleases;
    
    debugLog.info(`Prerelease updates ${shouldAllowPrereleases ? 'enabled' : 'disabled'}`, { 
      function: "auto-updater setup",
      prereleaseEnabled: shouldAllowPrereleases,
      userPreference: userPrefersPrereleases,
      isCurrentlyPrerelease: isCurrentlyPrerelease,
      currentVersion: currentVersion,
      platform: process.platform,
      arch: process.arch
    });
    // Do not auto-download; wait for explicit user action
    autoUpdater.autoDownload = false;
    
    // Explicitly configure GitHub provider; allow prereleases and let provider resolve URLs
    const feedConfig = {
      provider: "github",
      owner: "minter",
      repo: "mxvoice-electron",
      private: false,
      channel: "latest"
    };
    
    debugLog.info('Setting GitHub feed URL', { 
      function: "auto-updater setup",
      feedConfig: feedConfig,
      platform: process.platform,
      arch: process.arch
    });
    
    autoUpdater.setFeedURL(feedConfig);
    
    // Log GitHub feed configuration details
    debugLog.info('GitHub feed URL set successfully', { 
      function: "auto-updater setup",
      feedConfig: feedConfig,
      platform: process.platform,
      arch: process.arch,
      version: currentVersion
    });
  } else {
    // 3.x users: Use your custom server (legacy support)
    debugLog.info(`Using custom server for version ${currentVersion} on ${process.platform}`, { 
      function: "auto-updater setup",
      provider: "custom",
      server: "download.mxvoice.app",
      platform: process.platform,
      arch: process.arch
    });
    const server = "https://download.mxvoice.app";
    const arch = process.arch; // 'x64' or 'arm64'
    const platform = process.platform === "darwin" ? "darwin" : "win32";
    const feed = `${server}/update/${platform}/${arch}/${currentVersion}`;
    
    debugLog.info('Setting custom server feed URL', { 
      function: "auto-updater setup",
      server: server,
      platform: platform,
      arch: arch,
      version: currentVersion,
      feed: feed
    });
    
    autoUpdater.setFeedURL({ provider: "generic", url: feed });
    
    // Log custom server feed configuration details
    debugLog.info('Custom server feed URL set successfully', { 
      function: "auto-updater setup",
      provider: "generic",
      url: feed,
      platform: process.platform,
      arch: process.arch,
      version: currentVersion
    });
  }
  
  // Log final auto-updater configuration
  debugLog.info('Auto-updater configuration completed', { 
    function: "auto-updater setup",
    platform: process.platform,
    arch: process.arch,
    version: currentVersion,
    provider: currentVersion.startsWith('4.') ? 'github' : 'custom',
    allowPrerelease: autoUpdater.allowPrerelease,
    autoDownload: autoUpdater.autoDownload,
    hasAutoUpdater: !!autoUpdater,
    autoUpdaterType: typeof autoUpdater,
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node,
    timestamp: new Date().toISOString(),
    userDataPath: app.getPath('userData'),
    appPath: app.getAppPath(),
    storePath: store.path,
    cwd: process.cwd(),
    env: {
      NODE_ENV: process.env.NODE_ENV,
      TEST_AUTO_UPDATE: process.env.TEST_AUTO_UPDATE,
      TEST_UPDATE_VERSION: process.env.TEST_UPDATE_VERSION
    },
    memory: {
      heapUsed: process.memoryUsage().heapUsed,
      heapTotal: process.memoryUsage().heapTotal,
      external: process.memoryUsage().external
    },
    uptime: process.uptime(),
    pid: process.pid,
    versions: {
      chrome: process.versions.chrome,
      node: process.versions.node,
      electron: process.versions.electron
    },
    buildInfo: {
      isDev: process.env.NODE_ENV === 'development',
      isTest: process.env.TEST_AUTO_UPDATE === 'true',
      hasTestVersion: !!process.env.TEST_UPDATE_VERSION
    },
    systemInfo: {
      platform: process.platform,
      arch: process.arch,
      version: process.version,
      release: process.release
    },
    electronInfo: {
      isPackaged: app.isPackaged,
      appPath: app.getAppPath(),
      exePath: app.getPath('exe'),
      appName: app.getName(),
      appVersion: app.getVersion()
    },
    autoUpdaterInfo: {
      hasLogger: !!autoUpdater.logger,
      loggerType: typeof autoUpdater.logger,
      hasSetFeedURL: typeof autoUpdater.setFeedURL === 'function',
      hasCheckForUpdates: typeof autoUpdater.checkForUpdates === 'function',
      hasAllowPrerelease: 'allowPrerelease' in autoUpdater,
      hasAutoDownload: 'autoDownload' in autoUpdater,
      hasGetFeedURL: typeof autoUpdater.getFeedURL === 'function',
      hasQuitAndInstall: typeof autoUpdater.quitAndInstall === 'function',
      hasOn: typeof autoUpdater.on === 'function',
      hasRemoveAllListeners: typeof autoUpdater.removeAllListeners === 'function',
      hasCheckForUpdatesAndNotify: typeof autoUpdater.checkForUpdatesAndNotify === 'function',
      hasSetFeedURL: typeof autoUpdater.setFeedURL === 'function',
      hasGetFeedURL: typeof autoUpdater.getFeedURL === 'function',
      hasQuitAndInstall: typeof autoUpdater.quitAndInstall === 'function',
      hasOn: typeof autoUpdater.on === 'function',
      hasRemoveAllListeners: typeof autoUpdater.removeAllListeners === 'function',
      hasCheckForUpdatesAndNotify: typeof autoUpdater.checkForUpdatesAndNotify === 'function',
      hasSetFeedURL: typeof autoUpdater.setFeedURL === 'function',
      hasGetFeedURL: typeof autoUpdater.getFeedURL === 'function',
      hasQuitAndInstall: typeof autoUpdater.quitAndInstall === 'function',
      hasOn: typeof autoUpdater.on === 'function',
      hasRemoveAllListeners: typeof autoUpdater.removeAllListeners === 'function',
      hasCheckForUpdatesAndNotify: typeof autoUpdater.checkForUpdatesAndNotify === 'function',
      hasSetFeedURL: typeof autoUpdater.setFeedURL === 'function',
      hasGetFeedURL: typeof autoUpdater.getFeedURL === 'function',
      hasQuitAndInstall: typeof autoUpdater.quitAndInstall === 'function',
      hasOn: typeof autoUpdater.on === 'function',
      hasRemoveAllListeners: typeof autoUpdater.removeAllListeners === 'function',
      hasCheckForUpdatesAndNotify: typeof autoUpdater.checkForUpdatesAndNotify === 'function',
      hasSetFeedURL: typeof autoUpdater.setFeedURL === 'function',
      hasGetFeedURL: typeof autoUpdater.getFeedURL === 'function',
      hasQuitAndInstall: typeof autoUpdater.quitAndInstall === 'function',
      hasOn: typeof autoUpdater.on === 'function',
      hasRemoveAllListeners: typeof autoUpdater.removeAllListeners === 'function',
      hasCheckForUpdatesAndNotify: typeof autoUpdater.checkForUpdatesAndNotify === 'function',
      hasSetFeedURL: typeof autoUpdater.setFeedURL === 'function',
      hasGetFeedURL: typeof autoUpdater.getFeedURL === 'function',
      hasQuitAndInstall: typeof autoUpdater.quitAndInstall === 'function',
      hasOn: typeof autoUpdater.on === 'function',
      hasRemoveAllListeners: typeof autoUpdater.removeAllListeners === 'function',
      hasCheckForUpdatesAndNotify: typeof autoUpdater.checkForUpdatesAndNotify === 'function',
      hasSetFeedURL: typeof autoUpdater.setFeedURL === 'function',
      hasGetFeedURL: typeof autoUpdater.getFeedURL === 'function',
      hasQuitAndInstall: typeof autoUpdater.quitAndInstall === 'function',
      hasOn: typeof autoUpdater.on === 'function',
      hasRemoveAllListeners: typeof autoUpdater.removeAllListeners === 'function',
      hasCheckForUpdatesAndNotify: typeof autoUpdater.checkForUpdatesAndNotify === 'function'
    }
  });
}

// Global variables
let mainWindow;
let db; // Database connection for main process
let dbModule; // Lazy-loaded database module
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
async function initializeMainDatabaseWrapper() {
  try {
    if (!dbModule) {
      dbModule = await import('./modules/database-setup.js');
    }
    debugLog.info('Initializing main database', { 
      function: "initializeMainDatabaseWrapper" 
    });
    
    db = await dbModule.initializeMainDatabase();
    
    if (db) {
      debugLog.info('Main database initialized successfully', { 
        function: "initializeMainDatabaseWrapper",
        dbType: typeof db,
        constructor: db?.constructor?.name
      });
    } else {
      debugLog.warn('Database initialization returned null - app will continue without database', { 
        function: "initializeMainDatabaseWrapper" 
      });
    }
  } catch (error) {
    debugLog.error('Error initializing main database', { 
      function: "initializeMainDatabaseWrapper",
      error: error.message 
    });
    // Don't re-throw - let the app continue without database
    db = null;
  }
}

// Check first run
async function checkFirstRun() {
  debugLog.info(`First run preference returns ${store.get('first_run_completed')}`, { 
    function: "checkFirstRun" 
  });
  if (!store.get('first_run_completed')) {
    const shouldCheckLegacyConfig = process.env.APP_TEST_MODE !== '1';
    const oldConfig = shouldCheckLegacyConfig ? checkOldConfig() : false;
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
      if (!dbModule) {
        dbModule = await import('./modules/database-setup.js');
      }
      const initDb = await dbModule.initializeMainDatabase();
      
      // Insert initial data using prepared statements
      const categoryStmt = initDb.prepare(`INSERT OR IGNORE INTO categories VALUES(?, ?)`);
      categoryStmt.run(['UNC', 'Uncategorized']);
      categoryStmt.finalize();
      
      const songStmt = initDb.prepare(`INSERT OR IGNORE INTO mrvoice (title, artist, category, filename, time, modtime) VALUES (?, ?, ?, ?, ?, ?)`);
      songStmt.run(['Rock Bumper', 'Patrick Short', 'UNC', 'PatrickShort-CSzRockBumper.mp3', '00:49', Math.floor(Date.now() / 1000)]);
      songStmt.finalize();
      
      // Save the database to file - node-sqlite3-wasm handles this automatically
      const dbPath = path.join(store.get('database_directory'), 'mxvoice.db');
      debugLog.info(`Database path: ${dbPath}`, { function: "checkFirstRun" });
      debugLog.info(`Database will be saved to ${dbPath} by node-sqlite3-wasm`, { function: "checkFirstRun" });
      
      // Copy sample music file using streaming for better memory efficiency
      const sourceFile = path.join(__dirname, '..', 'assets', 'music', 'CSz Rock Bumper.mp3');
      const destFile = path.join(store.get('music_directory'), 'PatrickShort-CSzRockBumper.mp3');
      const copyResult = await copyFileStreaming(sourceFile, destFile);
      
      if (copyResult.success) {
        debugLog.info(`Sample music file copied successfully`, { 
          function: "checkFirstRun",
          bytesCopied: copyResult.bytesCopied
        });
      } else {
        debugLog.warn(`Failed to copy sample music file`, { 
          function: "checkFirstRun",
          error: copyResult.error
        });
      }
      
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
async function initializeModules() {
  debugLog.info('Starting module initialization', { function: "initializeModules", hasDb: !!db, dbType: typeof db });
  
  // Ensure database is initialized before proceeding
  if (!db) {
    debugLog.warn('Database not ready, attempting to initialize...', { function: "initializeModules" });
    try {
      debugLog.info('Calling initializeMainDatabaseWrapper...', { function: "initializeModules" });
      await initializeMainDatabaseWrapper();
      debugLog.info('initializeMainDatabaseWrapper completed', { function: "initializeModules", hasDb: !!db, dbType: typeof db });
    } catch (error) {
      debugLog.error('Failed to initialize database for modules', { 
        function: "initializeModules",
        error: error.message,
        stack: error.stack
      });
      // Continue without database
    }
  } else {
    debugLog.info('Database already available, proceeding with modules', { function: "initializeModules" });
  }

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
  
  debugLog?.info('Initializing IPC handlers', { 
    function: "initializeModules" 
  });
  debugLog?.info('Module dependencies status', { 
    function: "initializeModules",
    hasDb: !!dependencies.db,
    hasAutoUpdater: !!dependencies.autoUpdater,
    autoUpdaterType: typeof dependencies.autoUpdater
  });
  
  ipcHandlers.initializeIpcHandlers(dependencies);
  
  debugLog?.info('IPC handlers initialized', { 
    function: "initializeModules" 
  });
  
  fileOperations.initializeFileOperations(dependencies);
}

// Main window creation function
const createWindow = async () => {
  try {
    debugLog.info('Starting main window creation', { function: "createWindow" });
    
    // Check first run (which also checks old config)
    debugLog.info('Checking first run...', { function: "createWindow" });
    await checkFirstRun();
    debugLog.info('First run check completed', { function: "createWindow" });
    
    // Initialize database connection for main process
    debugLog.info('Initializing main database...', { function: "createWindow" });
    await initializeMainDatabaseWrapper();
    debugLog.info('Main database initialization completed', { function: "createWindow", hasDb: !!db, dbType: typeof db });

    // Create the window with restored state from store
    const windowState = appSetup.loadWindowState(store);
    debugLog.debug('Window state for creation', { 
      function: "createWindow",
      windowState: windowState
    });
    
    const windowOptions = windowState ? {
      width: windowState.width || defaults.browser_width,
      height: windowState.height || defaults.browser_height,
      x: windowState.x,
      y: windowState.y,
      isMaximized: windowState.isMaximized,
      isFullScreen: windowState.isFullScreen,
      displayId: windowState.displayId
    } : {
      width: store.get('browser_width') || defaults.browser_width,
      height: store.get('browser_height') || defaults.browser_height
    };

    debugLog.debug('Window creation options', { 
      function: "createWindow",
      windowOptions: windowOptions
    });

    mainWindow = appSetup.createWindow(windowOptions);

    // Initialize modules with dependencies AFTER mainWindow is created
    await initializeModules();

    // Set up window state saving now that store is available
    appSetup.setupWindowStateSaving();

    // Migrate old preferences after modules are initialized
    fileOperations.migrateOldPreferences();

    // Create the menu
    appSetup.createApplicationMenu();

    // Track user
    trackUser();
  } catch (error) {
    debugLog?.error('Failed to create main window', { 
      function: "createWindow",
      error: error.message,
      stack: error.stack
    });
    
    // Create a minimal window even if database fails
    try {
      const windowState = appSetup.loadWindowState(store);
      const windowOptions = windowState ? {
        width: windowState.width || defaults.browser_width,
        height: windowState.height || defaults.browser_height,
        x: windowState.x,
        y: windowState.y,
        isMaximized: windowState.isMaximized,
        isFullScreen: windowState.isFullScreen,
        displayId: windowState.displayId
      } : {
        width: store.get('browser_width') || defaults.browser_width,
        height: store.get('browser_height') || defaults.browser_height
      };

      mainWindow = appSetup.createWindow(windowOptions);
      
      // Initialize basic modules without database
      await initializeModules();
      
      // Set up window state saving now that store is available
      appSetup.setupWindowStateSaving();
      
      // Create the menu
      appSetup.createApplicationMenu();
      
      debugLog?.info('Created minimal window despite database initialization failure', { 
        function: "createWindow" 
      });
    } catch (fallbackError) {
      debugLog?.error('Failed to create even minimal window', { 
        function: "createWindow",
        error: fallbackError.message 
      });
      app.quit();
    }
  }
};

// Setup app lifecycle
function setupApp() {
  // Setup app lifecycle events
  appSetup.setupAppLifecycle();
  
  // Listen for preference changes that affect auto-updater
  store.onDidChange('prerelease_updates', (newValue) => {
    if (autoUpdater) {
      const currentVersion = getTestVersion();
      const isCurrentlyPrerelease = currentVersion.includes('-pre.') || currentVersion.includes('-beta') || currentVersion.includes('-alpha');
      const shouldAllowPrereleases = newValue || isCurrentlyPrerelease;
      
      autoUpdater.allowPrerelease = shouldAllowPrereleases;
      debugLog.info(`Auto-updater prerelease setting updated`, { 
        function: "preference-change",
        prereleaseEnabled: shouldAllowPrereleases,
        userPreference: newValue,
        isCurrentlyPrerelease: isCurrentlyPrerelease,
        currentVersion: currentVersion,
        platform: process.platform,
        arch: process.arch
      });
    }
  });

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  app.on('ready', async () => {
    debugLog.info('Electron app ready event fired', { function: "app ready event" });
    
    // Initialize profile manager
    profileManager.initializeProfileManager({ debugLog });
    
    // Check if profile was provided via command line
    currentProfile = getProfileFromArgs();
    
    if (currentProfile) {
      // Profile provided - launch main app directly
      debugLog.info('Profile provided via command line, launching main app', { 
        function: "app ready event",
        profile: currentProfile 
      });
      
      createWindow();
      
      // Test auto-update scenarios if enabled
      testAutoUpdateScenarios();
    } else {
      // No profile - show launcher window
      debugLog.info('No profile provided, showing launcher', { 
        function: "app ready event" 
      });
      
      // Initialize launcher window with ability to launch main app
      launcherWindow.initializeLauncherWindow({
        debugLog,
        profileManager,
        mainAppLauncher: async (profileName) => {
          currentProfile = profileName;
          
          debugLog.info('Launching main app from launcher', { 
            function: "mainAppLauncher",
            profile: profileName 
          });
          
          createWindow();
          
          // Test auto-update scenarios if enabled
          testAutoUpdateScenarios();
        }
      });
      
      // Show launcher window
      await launcherWindow.createLauncherWindow();
    }
  });

  // Setup auto-updater events
  autoUpdater.on('update-available', (updateInfo) => {
    updateState.downloaded = false;
    debugLog.info(`Update available: ${updateInfo.releaseName}`, { 
      function: "autoUpdater update-available",
      currentVersion: app.getVersion(),
      updateVersion: updateInfo.releaseName,
      provider: app.getVersion().startsWith('4.') ? 'github' : 'custom',
      platform: process.platform,
      arch: process.arch,
      updateInfo: {
        version: updateInfo.version,
        releaseDate: updateInfo.releaseDate,
        releaseNotes: updateInfo.releaseNotes ? updateInfo.releaseNotes.substring(0, 100) + '...' : null
      }
    });
    
    // Process markdown in release notes for proper formatting
    let processedNotes = updateInfo.releaseNotes;
    if (updateInfo.releaseNotes && typeof updateInfo.releaseNotes === 'string') {
      try {
        processedNotes = md.render(updateInfo.releaseNotes);
        debugLog.info('Markdown processed successfully for release notes', { 
          function: "autoUpdater update-available",
          originalLength: updateInfo.releaseNotes.length,
          processedLength: processedNotes.length,
          sampleProcessed: processedNotes.substring(0, 100) + (processedNotes.length > 100 ? '...' : '')
        });
      } catch (markdownError) {
        debugLog.warn('Failed to process markdown in release notes, using raw text', { 
          function: "autoUpdater update-available",
          error: markdownError.message
        });
        // Fall back to raw text if markdown processing fails
        processedNotes = updateInfo.releaseNotes;
      }
    }
    
    mainWindow.webContents.send('display_release_notes', updateInfo.releaseName, `<h1>Version ${updateInfo.releaseName}</h1>` + processedNotes);
    debugLog.info('display_release_notes call done', { 
      function: "autoUpdater update-available" 
    });
  });

  // Add more auto-updater event logging for testing
  autoUpdater.on('checking-for-update', () => {
    debugLog.info('Checking for updates...', { 
      function: "autoUpdater checking-for-update",
      currentVersion: app.getVersion(),
      provider: app.getVersion().startsWith('4.') ? 'github' : 'custom',
      platform: process.platform,
      arch: process.arch,
      feedURL: autoUpdater.getFeedURL?.() || 'not set'
    });
  });

  autoUpdater.on('update-not-available', () => {
    debugLog.info('No updates available', { 
      function: "autoUpdater update-not-available",
      currentVersion: app.getVersion(),
      provider: app.getVersion().startsWith('4.') ? 'github' : 'custom',
      platform: process.platform,
      arch: process.arch
    });
  });

  autoUpdater.on('error', (err) => {
    debugLog.error(`Auto-updater error: ${err.message}`, { 
      function: "autoUpdater error",
      currentVersion: app.getVersion(),
      provider: app.getVersion().startsWith('4.') ? 'github' : 'custom',
      error: err.message,
      errorStack: err.stack,
      platform: process.platform,
      arch: process.arch
    });
    
    // Additional error handling for checksum mismatches
    if (err.message.includes('checksum mismatch')) {
      debugLog.error('Checksum mismatch detected - this could indicate file corruption or build issues', {
        function: "autoUpdater error",
        errorType: 'checksum_mismatch',
        currentVersion: app.getVersion(),
        platform: process.platform,
        arch: process.arch
      });
    }
  });

  autoUpdater.on('download-progress', (progress) => {
    try { 
      // Send IPC event and dispatch custom event in renderer
      mainWindow?.webContents.send('update_download_progress', progress || {});
      mainWindow?.webContents.executeJavaScript(`
        window.dispatchEvent(new CustomEvent('mxvoice:update-download-progress', { 
          detail: ${JSON.stringify(progress || {})} 
        }));
      `);
    } catch (error) {
      debugLog.warn('Failed to send update download progress to renderer', { 
        module: 'main', 
        function: 'autoUpdater download-progress',
        error: error?.message || 'Unknown error' 
      });
    }
    debugLog.info('Auto-updater download progress', { 
      function: 'autoUpdater download-progress', 
      ...progress,
      platform: process.platform,
      arch: process.arch
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    updateState.downloaded = true;
    try { 
      // Send IPC event and dispatch custom event in renderer
      const version = info?.version || '';
      mainWindow?.webContents.send('update_ready', version); 
      mainWindow?.webContents.executeJavaScript(`
        window.dispatchEvent(new CustomEvent('mxvoice:update-ready', { 
          detail: ${JSON.stringify(version)} 
        }));
      `);
    } catch (error) {
      debugLog.warn('Failed to send update ready to renderer', { 
        module: 'main', 
        function: 'autoUpdater update-downloaded',
        error: error?.message || 'Unknown error' 
      });
    }
    debugLog.info('Update downloaded and ready to install', { 
      function: 'autoUpdater update-downloaded', 
      version: info?.version,
      platform: process.platform,
      arch: process.arch,
      updateInfo: {
        version: info?.version,
        releaseDate: info?.releaseDate,
        releaseNotes: info?.releaseNotes ? info?.releaseNotes.substring(0, 100) + '...' : null
      }
    });
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
      provider: isV4 ? 'github' : 'custom',
      platform: process.platform,
      arch: process.arch,
      testVersion: process.env.TEST_UPDATE_VERSION || 'not set'
    });
    
    // Test provider configuration
    if (isV4) {
      debugLog.info('Testing GitHub provider configuration', { 
        function: "testAutoUpdateScenarios",
        owner: "minter",
        repo: "mxvoice-electron",
        platform: process.platform,
        arch: process.arch,
        currentVersion: currentVersion
      });
    } else {
      debugLog.info('Testing custom server configuration', { 
        function: "testAutoUpdateScenarios",
        server: "https://download.mxvoice.app",
        arch: process.arch,
        platform: process.platform,
        currentVersion: currentVersion
      });
    }
    
    // Simulate update check for testing
    setTimeout(() => {
      debugLog.info('Simulating update check for testing...', { 
        function: "testAutoUpdateScenarios",
        hasAutoUpdater: !!autoUpdater,
        autoUpdaterType: typeof autoUpdater,
        platform: process.platform,
        arch: process.arch
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
      testVersion: process.env.TEST_UPDATE_VERSION,
      platform: process.platform,
      arch: process.arch
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