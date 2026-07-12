/**
 * IPC Handlers Module
 * 
 * Handles all IPC (Inter-Process Communication) between main and renderer processes
 * for the MxVoice Electron application.
 */

import electron from 'electron';

// Destructure from electron (handles both named and default exports)
const { ipcMain, dialog, app } = electron;
import path from 'path';
import fs from 'fs';
import { promises as fsPromises } from 'fs';

// Import file operations module
import fileOperations from './file-operations.js';
import * as profileManager from './profile-manager.js';
import * as profileBackupManager from './profile-backup-manager.js';
import * as libraryTransferManager from './library-transfer-manager.js';
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

// Dependencies that will be injected
let mainWindow;
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
  mainWindow = dependencies.mainWindow;
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
    mainWindow,
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

  // Song operations
  // Note: delete-selected-song and edit-selected-song handlers are defined later with enhanced error handling

  // Profile handlers
  ipcMain.handle('profile:get-current', async () => {
    try {
      // Import the main module to get current profile
      const profile = getCurrentProfile();
      return { success: true, profile: profile || null };
    } catch (error) {
      debugLog?.error('Get current profile error:', { module: 'ipc-handlers', function: 'profile:get-current', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('profile:get-directory', async (event, type) => {
    try {
      // Import the main module to get profile directory
      const directory = getProfileDirectory(type);
      return { success: true, directory };
    } catch (error) {
      debugLog?.error('Get profile directory error:', { module: 'ipc-handlers', function: 'profile:get-directory', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('profile:load-state', async () => {
    try {
      const stateFile = path.join(getProfileDirectory('state'), 'state.json');
      try {
        const data = await fsPromises.readFile(stateFile, 'utf8');
        return { success: true, loaded: true, data };
      } catch (error) {
        if (error.code === 'ENOENT') return { success: true, loaded: false };
        throw error;
      }
    } catch (error) {
      debugLog?.error('Load profile state error', {
        module: 'ipc-handlers',
        function: 'profile:load-state',
        error: error.message
      });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('profile:get-legacy-migration-data', async () => {
    try {
      const stateFile = path.join(getProfileDirectory('state'), 'state.json');
      const configFile = path.join(app.getPath('userData'), 'config.json');
      const stateExists = fs.existsSync(stateFile);
      if (!fs.existsSync(configFile)) {
        return { success: true, stateExists, configExists: false, hotkeys: null, holdingTank: null };
      }
      const config = JSON.parse(await fsPromises.readFile(configFile, 'utf8'));
      return {
        success: true,
        stateExists,
        configExists: true,
        hotkeys: typeof config.hotkeys === 'string' ? config.hotkeys : null,
        holdingTank: typeof config.holding_tank === 'string' ? config.holding_tank : null
      };
    } catch (error) {
      debugLog?.error('Legacy migration data error', {
        module: 'ipc-handlers',
        function: 'profile:get-legacy-migration-data',
        error: error.message
      });
      return { success: false, error: error.message };
    }
  });

  // Profile: Save state (called on window close)
  ipcMain.handle('profile:save-state', async (event, state, profileName) => {
    try {
      const name = profileName || getCurrentProfile();
      return await profileManager.saveProfileState(name, state, { reason: 'window-close' });
    } catch (error) {
      debugLog?.error('Error saving profile state', {
        module: 'ipc-handlers',
        function: 'profile:save-state',
        error: error.message
      });
      return { success: false, error: error.message };
    }
  });


  // Profile: Get preference value
  ipcMain.handle('profile:get-preference', async (event, key) => {
    try {
      const profileName = getCurrentProfile();
      const preferences = await profileManager.loadProfilePreferences(profileName);
      
      return { success: true, value: preferences[key] };
    } catch (error) {
      debugLog?.error('Error getting profile preference', { 
        module: 'ipc-handlers',
        function: 'profile:get-preference',
        key: key,
        error: error.message
      });
      return { success: false, error: error.message };
    }
  });

  // Profile: Set preference value
  ipcMain.handle('profile:set-preference', async (event, key, value) => {
    try {
      const profileName = getCurrentProfile();
      
      debugLog?.info('[PROFILE-PREF] Loading preferences for profile', {
        module: 'ipc-handlers',
        function: 'profile:set-preference',
        profileName,
        key
      });
      
      const preferences = await profileManager.loadProfilePreferences(profileName);
      
      debugLog?.info('[PROFILE-PREF] Current preferences loaded', {
        module: 'ipc-handlers',
        function: 'profile:set-preference',
        profileName,
        key,
        hasPreferences: !!preferences
      });
      
      preferences[key] = value;
      
      debugLog?.info('[PROFILE-PREF] Saving updated preferences', {
        module: 'ipc-handlers',
        function: 'profile:set-preference',
        profileName,
        key,
        valueType: typeof value,
        valueLength: Array.isArray(value) ? value.length : undefined
      });
      
      await profileManager.saveProfilePreferences(profileName, preferences);
      
      debugLog?.info('[PROFILE-PREF] Profile preference saved successfully', { 
        module: 'ipc-handlers',
        function: 'profile:set-preference',
        profileName,
        key
      });
      
      return { success: true };
    } catch (error) {
      debugLog?.error('[PROFILE-PREF] Error setting profile preference', { 
        module: 'ipc-handlers',
        function: 'profile:set-preference',
        key: key,
        error: error.message,
        stack: error.stack
      });
      return { success: false, error: error.message };
    }
  });

  // Profile: Set multiple preferences atomically (prevents race conditions)
  ipcMain.handle('profile:set-preferences', async (event, preferencesObject) => {
    try {
      const profileName = getCurrentProfile();
      
      debugLog?.info('[PROFILE-PREF] Setting multiple preferences atomically', {
        module: 'ipc-handlers',
        function: 'profile:set-preferences',
        profileName,
        keys: Object.keys(preferencesObject || {})
      });
      
      const currentPreferences = await profileManager.loadProfilePreferences(profileName);
      
      debugLog?.info('[PROFILE-PREF] Current preferences before update', {
        module: 'ipc-handlers',
        function: 'profile:set-preferences',
        profileName,
        currentFadeOut: currentPreferences?.fade_out_seconds,
        currentKeys: Object.keys(currentPreferences || {})
      });
      
      // Merge new preferences into current preferences
      const updatedPreferences = {
        ...currentPreferences,
        ...preferencesObject
      };
      
      debugLog?.info('[PROFILE-PREF] Saving updated preferences atomically', {
        module: 'ipc-handlers',
        function: 'profile:set-preferences',
        profileName,
        preferenceCount: Object.keys(preferencesObject || {}).length,
        newFadeOut: updatedPreferences.fade_out_seconds,
        allNewValues: preferencesObject
      });
      
      const saveResult = await profileManager.saveProfilePreferences(profileName, updatedPreferences);

      // Sync prerelease_updates to the global store so the auto-updater picks it up
      // (auto-updater reads from store.get('prerelease_updates'), not profile preferences)
      if ('prerelease_updates' in preferencesObject) {
        store.set('prerelease_updates', preferencesObject.prerelease_updates);
      }

      debugLog?.info('[PROFILE-PREF] Save completed', {
        module: 'ipc-handlers',
        function: 'profile:set-preferences',
        profileName,
        saveSuccess: saveResult,
        savedFadeOut: updatedPreferences.fade_out_seconds
      });

      debugLog?.info('[PROFILE-PREF] Multiple preferences saved successfully', {
        module: 'ipc-handlers',
        function: 'profile:set-preferences',
        profileName
      });
      
      return { success: true };
    } catch (error) {
      debugLog?.error('[PROFILE-PREF] Error setting multiple profile preferences', { 
        module: 'ipc-handlers',
        function: 'profile:set-preferences',
        error: error.message,
        stack: error.stack
      });
      return { success: false, error: error.message };
    }
  });

  // Profile: Get all preferences
  ipcMain.handle('profile:get-all-preferences', async () => {
    try {
      const profileName = getCurrentProfile();
      const preferences = await profileManager.loadProfilePreferences(profileName);
      
      return { success: true, preferences: preferences };
    } catch (error) {
      debugLog?.error('Error getting all profile preferences', { 
        module: 'ipc-handlers',
        function: 'profile:get-all-preferences',
        error: error.message
      });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('profile:switch', async () => {
    try {
      debugLog?.info('Profile switch requested, will save state and relaunch', { 
        module: 'ipc-handlers',
        function: 'profile:switch' 
      });
      
      // Note: State must be saved BEFORE we tell the renderer we're switching
      // The renderer should call profile:save-state-before-switch first
      
      // Save current profile name for fallback if launcher is closed without selection
      const currentProfile = getCurrentProfile();
      if (currentProfile) {
        // Store the current profile as the fallback profile
        store.set('fallback-profile', currentProfile);
        debugLog?.info('Saved fallback profile for launcher close scenario', { 
          module: 'ipc-handlers',
          function: 'profile:switch',
          fallbackProfile: currentProfile 
        });
      }
      
      // Close main window and relaunch launcher
      if (mainWindow) {
        mainWindow.close();
      }
      
      // Relaunch the app without profile argument to show launcher
      app.relaunch({ args: process.argv.slice(1).filter(arg => !arg.startsWith('--profile=')) });
      app.exit(0);
      
      return { success: true };
    } catch (error) {
      debugLog?.error('Profile switch error:', { module: 'ipc-handlers', function: 'profile:switch', error: error.message });
      return { success: false, error: error.message };
    }
  });
  
  // Profile: Save state before switch (explicit save, not relying on beforeunload)
  ipcMain.handle('profile:save-state-before-switch', async (event, state, profileName) => {
    try {
      const name = profileName || getCurrentProfile();
      return await profileManager.saveProfileState(name, state, { reason: 'profile-switch' });
    } catch (error) {
      debugLog?.error('Error saving profile state before switch', {
        module: 'ipc-handlers',
        function: 'profile:save-state-before-switch',
        error: error.message
      });
      return { success: false, error: error.message };
    }
  });

  // Profile: Create profile
  ipcMain.handle('profile:create', async (event, profileName, description) => {
    try {
      debugLog?.info('Profile create requested', { 
        module: 'ipc-handlers',
        function: 'profile:create',
        profileName,
        description 
      });
      
      // Create the profile using the imported profile manager
      const result = await profileManager.createProfile(profileName, description);
      
      if (result.success) {
        debugLog?.info('Profile created successfully', { 
          module: 'ipc-handlers',
          function: 'profile:create',
          profileName 
        });
      } else {
        debugLog?.error('Failed to create profile', { 
          module: 'ipc-handlers',
          function: 'profile:create',
          profileName,
          error: result.error 
        });
      }
      
      return result;
    } catch (error) {
      debugLog?.error('Profile create error:', { 
        module: 'ipc-handlers', 
        function: 'profile:create',
        profileName,
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  });

  // Profile: Duplicate profile
        ipcMain.handle('profile:duplicate', async (event, sourceProfileName, targetProfileName, description) => {
          try {
            debugLog?.info('Profile duplicate requested', {
              module: 'ipc-handlers',
              function: 'profile:duplicate',
              sourceProfileName,
              targetProfileName,
              description
            });

            const result = await profileManager.duplicateProfile(sourceProfileName, targetProfileName, description);

            if (result.success) {
              debugLog?.info('Profile duplicated successfully', {
                module: 'ipc-handlers',
                function: 'profile:duplicate',
                sourceProfileName,
                targetProfileName
              });
            } else {
              debugLog?.error('Failed to duplicate profile', {
                module: 'ipc-handlers',
                function: 'profile:duplicate',
                sourceProfileName,
                targetProfileName,
                error: result.error
              });
            }

            return result;
          } catch (error) {
            debugLog?.error('Profile duplicate error:', {
              module: 'ipc-handlers',
              function: 'profile:duplicate',
              sourceProfileName,
              targetProfileName,
              error: error.message
            });
            return { success: false, error: error.message };
          }
        });

  // Profile: Switch to specific profile
  ipcMain.handle('profile:switch-to', async (event, profileName) => {
    try {
      debugLog?.info('Profile switch to specific profile requested', { 
        module: 'ipc-handlers',
        function: 'profile:switch-to',
        profileName 
      });
      
      // Save current profile name for fallback if launcher is closed without selection
      const currentProfile = getCurrentProfile();
      if (currentProfile) {
        store.set('fallback-profile', currentProfile);
        debugLog?.info('Saved fallback profile before switch', {
          module: 'ipc-handlers',
          function: 'profile:switch-to',
          fallbackProfile: currentProfile 
        });
      }
      
      // Set the target profile as the fallback so launcher will auto-select it
      store.set('auto-select-profile', profileName);
      
      // Close main window and relaunch launcher
      if (mainWindow) {
        mainWindow.close();
      }
      app.relaunch({ args: [...process.argv.slice(1).filter(arg => !arg.startsWith('--profile=')), `--profile=${profileName}`] });
      app.exit(0);
      
      return { success: true };
    } catch (error) {
      debugLog?.error('Profile switch to specific profile error:', { 
        module: 'ipc-handlers', 
        function: 'profile:switch-to',
        profileName,
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  });

  // Profile: Delete profile
  ipcMain.handle('profile:delete', async (event, profileName) => {
    try {
      debugLog?.info('Profile delete requested', { 
        module: 'ipc-handlers',
        function: 'profile:delete',
        profileName 
      });
      
      // Delete the profile using the imported profile manager
      const result = await profileManager.deleteProfile(profileName);
      
      if (result.success) {
        debugLog?.info('Profile deleted successfully', { 
          module: 'ipc-handlers',
          function: 'profile:delete',
          profileName 
        });
      } else {
        debugLog?.error('Failed to delete profile', { 
          module: 'ipc-handlers',
          function: 'profile:delete',
          profileName,
          error: result.error 
        });
      }
      
      return result;
    } catch (error) {
      debugLog?.error('Profile delete error:', { 
        module: 'ipc-handlers', 
        function: 'profile:delete',
        profileName,
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  });

  // Profile Backup: Create backup
  ipcMain.handle('profile:createBackup', async (_event) => {
    try {
      const currentProfile = getCurrentProfile();
      
      if (!currentProfile) {
        return { success: false, error: 'No active profile' };
      }
      
      debugLog?.info('Profile backup create requested', { 
        module: 'ipc-handlers',
        function: 'profile:createBackup',
        profileName: currentProfile
      });
      
      const result = await profileBackupManager.createBackup(currentProfile, { mode: 'manual' });
      
      if (result.success) {
        debugLog?.info('Profile backup created successfully', { 
          module: 'ipc-handlers',
          function: 'profile:createBackup',
          profileName: currentProfile,
          backupId: result.backupId
        });
      } else {
        debugLog?.error('Failed to create profile backup', { 
          module: 'ipc-handlers',
          function: 'profile:createBackup',
          profileName: currentProfile,
          error: result.error 
        });
      }
      
      return result;
    } catch (error) {
      debugLog?.error('Profile backup create error:', { 
        module: 'ipc-handlers', 
        function: 'profile:createBackup',
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  });

  // Profile Backup: List backups
  ipcMain.handle('profile:listBackups', async (_event) => {
    try {
      const currentProfile = getCurrentProfile();
      
      if (!currentProfile) {
        return { success: false, error: 'No active profile' };
      }
      
      debugLog?.info('Profile backup list requested', { 
        module: 'ipc-handlers',
        function: 'profile:listBackups',
        profileName: currentProfile
      });
      
      const result = await profileBackupManager.listBackups(currentProfile);
      
      return result;
    } catch (error) {
      debugLog?.error('Profile backup list error:', { 
        module: 'ipc-handlers', 
        function: 'profile:listBackups',
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  });

  // Profile Backup: Get backup metadata
  ipcMain.handle('profile:getBackupMetadata', async (_event) => {
    try {
      const currentProfile = getCurrentProfile();
      
      if (!currentProfile) {
        return { success: false, error: 'No active profile' };
      }
      
      const result = await profileBackupManager.getBackupMetadata(currentProfile);
      
      return result;
    } catch (error) {
      debugLog?.error('Profile backup metadata error:', { 
        module: 'ipc-handlers', 
        function: 'profile:getBackupMetadata',
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  });

  // Profile Backup: Restore from backup
  ipcMain.handle('profile:restoreBackup', async (event, backupId) => {
    try {
      const currentProfile = getCurrentProfile();
      
      if (!currentProfile) {
        return { success: false, error: 'No active profile' };
      }
      
      debugLog?.info('Profile backup restore requested', { 
        module: 'ipc-handlers',
        function: 'profile:restoreBackup',
        profileName: currentProfile,
        backupId
      });
      
      const result = await profileBackupManager.restoreBackup(currentProfile, backupId);
      
      if (result.success) {
        debugLog?.info('Profile backup restored successfully', { 
          module: 'ipc-handlers',
          function: 'profile:restoreBackup',
          profileName: currentProfile,
          backupId
        });
      } else {
        debugLog?.error('Failed to restore profile backup', { 
          module: 'ipc-handlers',
          function: 'profile:restoreBackup',
          profileName: currentProfile,
          backupId,
          error: result.error 
        });
      }
      
      return result;
    } catch (error) {
      debugLog?.error('Profile backup restore error:', { 
        module: 'ipc-handlers', 
        function: 'profile:restoreBackup',
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  });

  // Profile Backup: Delete backup
  ipcMain.handle('profile:deleteBackup', async (event, backupId) => {
    try {
      const currentProfile = getCurrentProfile();
      
      if (!currentProfile) {
        return { success: false, error: 'No active profile' };
      }
      
      debugLog?.info('Profile backup delete requested', { 
        module: 'ipc-handlers',
        function: 'profile:deleteBackup',
        profileName: currentProfile,
        backupId
      });
      
      const result = await profileBackupManager.deleteBackup(currentProfile, backupId);
      
      return result;
    } catch (error) {
      debugLog?.error('Profile backup delete error:', { 
        module: 'ipc-handlers', 
        function: 'profile:deleteBackup',
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  });

  // Profile Backup: Get backup settings
  ipcMain.handle('profile:getBackupSettings', async (_event) => {
    try {
      const currentProfile = getCurrentProfile();
      
      if (!currentProfile) {
        return { success: false, error: 'No active profile' };
      }
      
      const preferences = await profileManager.loadProfilePreferences(currentProfile);
      const backupSettings = preferences?.backup_settings || {
        autoBackupEnabled: true,
        backupInterval: 30 * 60 * 1000, // 30 minutes
        maxBackupCount: 25,
        maxBackupAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      };
      
      return { success: true, settings: backupSettings };
    } catch (error) {
      debugLog?.error('Profile backup settings get error:', { 
        module: 'ipc-handlers', 
        function: 'profile:getBackupSettings',
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  });

  // Profile Backup: Save backup settings
  ipcMain.handle('profile:saveBackupSettings', async (event, settings) => {
    try {
      const currentProfile = getCurrentProfile();
      
      if (!currentProfile) {
        return { success: false, error: 'No active profile' };
      }
      
      debugLog?.info('Profile backup settings save requested', { 
        module: 'ipc-handlers',
        function: 'profile:saveBackupSettings',
        profileName: currentProfile,
        settings
      });
      
      const preferences = await profileManager.loadProfilePreferences(currentProfile);
      const updatedPreferences = {
        ...preferences,
        backup_settings: settings
      };
      
      const result = await profileManager.saveProfilePreferences(currentProfile, updatedPreferences);
      
      if (result) {
        return { success: true };
      } else {
        return { success: false, error: 'Failed to save preferences' };
      }
    } catch (error) {
      debugLog?.error('Profile backup settings save error:', { 
        module: 'ipc-handlers', 
        function: 'profile:saveBackupSettings',
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  });

  // Library Transfer handlers
  ipcMain.handle('library:export', async () => {
    try {
      const result = await dialog.showSaveDialog(mainWindow, {
        buttonLabel: 'Export',
        filters: [{ name: 'Mx. Voice Library', extensions: ['mxvlib'] }],
        defaultPath: path.join(app.getPath('documents'), 'MxVoice-Library.mxvlib'),
        message: 'Choose where to save your library export'
      });

      if (result.canceled) {
        return { success: false, canceled: true };
      }

      const progressCallback = (progress) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('library:export-progress', progress);
        }
      };

      return await libraryTransferManager.exportLibrary(result.filePath, progressCallback);
    } catch (error) {
      debugLog?.error('Library export handler error:', {
        module: 'ipc-handlers', function: 'library:export', error: error.message
      });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('library:import', async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        buttonLabel: 'Import',
        filters: [{ name: 'Mx. Voice Library', extensions: ['mxvlib'] }],
        message: 'Select a Mx. Voice library file to import',
        properties: ['openFile']
      });

      if (result.canceled || !result.filePaths.length) {
        return { success: false, canceled: true };
      }

      const archivePath = result.filePaths[0];

      // Notify the renderer that validation is starting so it can show a loading modal
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('library:import-progress', {
          percent: 0,
          message: 'Validating library file...'
        });
      }

      const validation = await libraryTransferManager.validateArchive(archivePath);
      if (!validation.success) {
        return validation;
      }

      return { success: true, archivePath, manifest: validation.manifest };
    } catch (error) {
      debugLog?.error('Library import handler error:', {
        module: 'ipc-handlers', function: 'library:import', error: error.message
      });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('library:import-confirm', async (_event, archivePath) => {
    try {
      const progressCallback = (progress) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('library:import-progress', progress);
        }
      };

      return await libraryTransferManager.importLibrary(archivePath, progressCallback);
    } catch (error) {
      debugLog?.error('Library import confirm handler error:', {
        module: 'ipc-handlers', function: 'library:import-confirm', error: error.message
      });
      return { success: false, error: error.message };
    }
  });

  debugLog?.info('✅ Secure IPC handlers registered successfully', {
    module: 'ipc-handlers',
    function: 'registerAllHandlers',
    secureHandlersCount: 60
  });

  // Analytics handlers
  ipcMain.handle('analytics:track-event', async (event, name, properties) => {
    try {
      // Skip events fired before the user has seen the consent banner.
      // Mirrors the gate around app_launched in main/index-modular.js so
      // renderer-side handlers (errors, etc.) don't leak events on first run.
      if (analytics && store.get('analytics_banner_shown')) {
        analytics.trackEvent(name, properties || {});
      }
      return { success: true };
    } catch (error) {
      debugLog?.error('Analytics track-event error', { module: 'ipc-handlers', function: 'analytics:track-event', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('analytics:get-opt-out-status', async () => {
    try {
      if (analytics) {
        return { success: true, value: analytics.getOptOutStatus() };
      }
      return { success: true, value: false };
    } catch (error) {
      debugLog?.error('Analytics get-opt-out error', { module: 'ipc-handlers', function: 'analytics:get-opt-out-status', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('analytics:set-opt-out', async (event, value) => {
    try {
      if (analytics) {
        analytics.setOptOut(!!value);
      }
      return { success: true };
    } catch (error) {
      debugLog?.error('Analytics set-opt-out error', { module: 'ipc-handlers', function: 'analytics:set-opt-out', error: error.message });
      return { success: false, error: error.message };
    }
  });

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
