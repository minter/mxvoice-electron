/**
 * IPC Handlers Module
 * 
 * Handles all IPC (Inter-Process Communication) between main and renderer processes
 * for the MxVoice Electron application.
 */

// Import file operations module
import fileOperations from './file-operations.js';
import * as storeHandlers from './ipc/store-handlers.js';
import * as pathOsHandlers from './ipc/path-os-handlers.js';
import * as databaseHandlers from './ipc/database-handlers.js';
import * as filesystemHandlers from './ipc/filesystem-handlers.js';
import * as loggingHandlers from './ipc/logging-handlers.js';
import * as dialogHandlers from './ipc/dialog-handlers.js';
import * as uiHandlers from './ipc/ui-handlers.js';
import * as audioHandlers from './ipc/audio-handlers.js';
import * as appUpdateHandlers from './ipc/app-update-handlers.js';
import * as utilityHandlers from './ipc/utility-handlers.js';
import * as profileHandlers from './ipc/profile-handlers.js';
import * as profileBackupHandlers from './ipc/profile-backup-handlers.js';
import * as libraryHandlers from './ipc/library-handlers.js';
import * as analyticsHandlers from './ipc/analytics-handlers.js';

// Dependencies that will be injected
let getMainWindow = () => null;
let getDb = () => null;
let getCurrentProfile;
let getProfileDirectory;
let store;
let audioInstances;
let autoUpdater;
let debugLog;
let logService;
let updateState;
let analytics;

// Initialize the module with dependencies
function initializeIpcHandlers(dependencies) {
  getMainWindow = dependencies.getMainWindow || (() => dependencies.mainWindow);
  getDb = dependencies.getDb || (() => dependencies.db);
  getCurrentProfile = dependencies.getCurrentProfile;
  getProfileDirectory = dependencies.getProfileDirectory;
  store = dependencies.store;
  audioInstances = dependencies.audioInstances;
  autoUpdater = dependencies.autoUpdater;
  debugLog = dependencies.debugLog;
  logService = dependencies.logService;
  updateState = dependencies.updateState || { downloaded: false };
  analytics = dependencies.analytics;

  // Initialize file operations module
  fileOperations.initializeFileOperations(dependencies);

  const deps = {
    getMainWindow,
    getDb,
    getCurrentProfile,
    getProfileDirectory,
    store,
    audioInstances,
    autoUpdater,
    debugLog,
    logService,
    updateState,
    analytics,
  };

  registerAllHandlers(deps);
}

// Register all IPC handlers
function registerAllHandlers(deps) {
  storeHandlers.register(deps);
  pathOsHandlers.register(deps);
  databaseHandlers.register(deps);
  filesystemHandlers.register(deps);
  loggingHandlers.register(deps);
  dialogHandlers.register(deps);
  uiHandlers.register(deps);
  audioHandlers.register(deps);
  appUpdateHandlers.register(deps);
  utilityHandlers.register(deps);

  profileHandlers.register(deps);
  profileBackupHandlers.register(deps);
  libraryHandlers.register(deps);
  analyticsHandlers.register(deps);

  debugLog?.info('✅ All IPC handlers registered successfully (context isolation ready)', {
    module: 'ipc-handlers',
    function: 'registerAllHandlers',
    note: 'Using secure handlers only - legacy handlers removed for security'
  });
}

export {
  initializeIpcHandlers,
  registerAllHandlers
};

// Default export for module loading
export default {
  initializeIpcHandlers,
  registerAllHandlers
};
