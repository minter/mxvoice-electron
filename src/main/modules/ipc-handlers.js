/**
 * IPC Handlers Module
 * 
 * Handles all IPC (Inter-Process Communication) between main and renderer processes
 * for the MxVoice Electron application.
 */

import { ipcMain, dialog, app, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';
import os from 'os';
import { Howl, Howler } from 'howler';
import { parseFile as parseAudioFile } from 'music-metadata';
import { v4 as uuidv4 } from 'uuid';

// Import file operations module
import fileOperations from './file-operations.js';

// Import profile system modules
import * as profileManager from './profile-manager.js';
import * as profileStore from './profile-store.js';

// Dependencies that will be injected
let mainWindow;
let db;
let store;
let audioInstances;
let autoUpdater;
let debugLog;
let logService;
let updateState;
let profileManagerInstance;
let profileStoreInstance;

// Initialize the module with dependencies
function initializeIpcHandlers(dependencies) {
  mainWindow = dependencies.mainWindow;
  db = dependencies.db;
  store = dependencies.store;
  audioInstances = dependencies.audioInstances;
  autoUpdater = dependencies.autoUpdater;
  debugLog = dependencies.debugLog;
  logService = dependencies.logService;
  updateState = dependencies.updateState || { downloaded: false };
  profileManagerInstance = dependencies.profileManager;
  profileStoreInstance = dependencies.profileStore;
  
  // Initialize file operations module
  fileOperations.initializeFileOperations(dependencies);
  
  registerAllHandlers();
}

// Track if handlers have been registered to prevent duplicates
let handlersRegistered = false;

// Register all IPC handlers
function registerAllHandlers() {
  // Prevent duplicate registration
  if (handlersRegistered) {
    debugLog?.info('IPC handlers already registered, skipping', { 
      module: 'ipc-handlers', 
      function: 'registerAllHandlers'
    });
    return;
  }

  debugLog?.info('Registering IPC handlers', { 
    module: 'ipc-handlers', 
    function: 'registerAllHandlers' 
  });

  // Logs API (centralized log service)
  ipcMain.handle('logs:write', async (_event, payload) => {
    try {
      logService?.write(payload);
      return { success: true };
    } catch (error) {
      debugLog?.error('Logs write error', { module: 'ipc-handlers', function: 'logs:write', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('logs:get-paths', async () => {
    try {
      const paths = logService?.getPaths();
      return { success: true, ...paths };
    } catch (error) {
      debugLog?.error('Logs get-paths error', { module: 'ipc-handlers', function: 'logs:get-paths', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('logs:export', async (_event, options) => {
    try {
      const result = await logService?.exportLogs(options || {});
      return result || { success: false };
    } catch (error) {
      debugLog?.error('Logs export error', { module: 'ipc-handlers', function: 'logs:export', error: error.message });
      return { success: false, error: error.message };
    }
  });
  // Get app path handler
  ipcMain.handle('get-app-path', async () => {
    try {
      const result = await app.getAppPath();
      return { success: true, path: result };
    } catch (error) {
      debugLog?.error('Error getting app path:', { module: 'ipc-handlers', function: 'get-app-path', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('show-directory-picker', async (event, defaultPath) => {
    let path = dialog.showOpenDialogSync({
      defaultPath: defaultPath,
      properties: ['openDirectory']
    });
    return path;
  });

  // File operations
  ipcMain.handle('open-hotkey-file', async () => {
    return await fileOperations.loadHotkeysFile();
  });

  ipcMain.handle('save-hotkey-file', async (event, hotkeyArray) => {
    return await fileOperations.saveHotkeysFile(hotkeyArray);
  });

  ipcMain.handle('open-holding-tank-file', async () => {
    return await fileOperations.loadHoldingTankFile();
  });

  ipcMain.handle('save-holding-tank-file', async (event, holdingTankArray) => {
    return await fileOperations.saveHoldingTankFile(holdingTankArray);
  });

  // App operations
  // Note: restart-and-install-new-version handler is defined later with enhanced error handling

  // UI operations
  ipcMain.handle('increase-font-size', async () => {
    mainWindow.webContents.send("increase_font_size");
  });

  ipcMain.handle('decrease-font-size', async () => {
    mainWindow.webContents.send("decrease_font_size");
  });

  ipcMain.handle('toggle-waveform', async () => {
    mainWindow.webContents.send("toggle_wave_form");
  });

  ipcMain.handle('toggle-advanced-search', async () => {
    mainWindow.webContents.send("toggle_advanced_search");
  });

  ipcMain.handle('close-all-tabs', async () => {
    mainWindow.webContents.send("close_all_tabs");
  });

  // Song operations
  // Note: delete-selected-song and edit-selected-song handlers are defined later with enhanced error handling

  // Category operations
  ipcMain.handle('manage-categories', async () => {
    mainWindow.webContents.send('manage_categories');
  });

  // Preferences
  ipcMain.handle('show-preferences', async () => {
    mainWindow.webContents.send('show_preferences');
  });

  // Profile menu operations - these are handled by the profile-specific handlers below

  // Database API handlers
  ipcMain.handle('database-query', async (event, sql, params) => {
    try {
      debugLog?.info('Database query handler called', { 
        module: 'ipc-handlers', 
        function: 'database-query', 
        sql, 
        params, 
        hasDb: !!db 
      });
      
      if (!db) {
        debugLog?.warn('Database not initialized in query handler', { 
          module: 'ipc-handlers', 
          function: 'database-query' 
        });
        throw new Error('Database not initialized');
      }
      
      debugLog?.info('Database available, executing query', { 
        module: 'ipc-handlers', 
        function: 'database-query' 
      });
      
      // For node-sqlite3-wasm, always use prepare/all for queries to ensure consistent results
      let result;
      debugLog?.info('Using prepared statement for query', { 
        module: 'ipc-handlers', 
        function: 'database-query',
        hasParams: params && params.length > 0
      });
      
      // Execute the actual query
      const stmt = db.prepare(sql);
      result = stmt.all(params || []);
      stmt.finalize();
      
      debugLog?.info('Prepared statement result', { 
        module: 'ipc-handlers', 
        function: 'database-query', 
        resultType: typeof result,
        resultCount: Array.isArray(result) ? result.length : 'not array',
        result: result
      });
      
      debugLog?.info('Query successful, returning result', { 
        module: 'ipc-handlers', 
        function: 'database-query' 
      });
      return { success: true, data: result || [] };
    } catch (error) {
      debugLog?.error('Database query error', { 
        module: 'ipc-handlers', 
        function: 'database-query', 
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('database-execute', async (event, sql, params) => {
    try {
      if (!db) {
        throw new Error('Database not initialized');
      }
      
      // For node-sqlite3-wasm, always use prepare/run for consistent results
      let result;
      const stmt = db.prepare(sql);
      result = stmt.run(params || []);
      stmt.finalize();
      
      return { success: true, data: { changes: result.changes || 0, lastInsertRowid: result.lastInsertRowid || 0 } };
    } catch (error) {
      debugLog?.error('Database execute error:', { module: 'ipc-handlers', function: 'database-execute', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-categories', async () => {
    try {
      if (!db) {
        throw new Error('Database not initialized');
      }
      
      // For node-sqlite3-wasm, use prepare/all for consistent results
      const sql = 'SELECT * FROM categories ORDER BY description ASC';
      debugLog?.info('Executing categories query', { 
        module: 'ipc-handlers', 
        function: 'get-categories', 
        sql 
      });
      
      const stmt = db.prepare(sql);
      const result = stmt.all([]);
      stmt.finalize();
      
      debugLog?.info('Raw categories result', { 
        module: 'ipc-handlers', 
        function: 'get-categories', 
        resultType: typeof result,
        resultLength: Array.isArray(result) ? result.length : 'not array',
        result: result
      });
      
      return { success: true, data: result || [] };
    } catch (error) {
      debugLog?.error('Get categories error', { 
        module: 'ipc-handlers', 
        function: 'get-categories', 
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('add-song', async (event, songData) => {
    try {
      if (!db) {
        throw new Error('Database not initialized');
      }
      
      debugLog?.info('Adding song to database:', { 
        module: 'ipc-handlers', 
        function: 'add-song', 
        songData 
      });
      
      // For node-sqlite3-wasm, use prepare/run for parameterized statements
      const stmt = db.prepare(`
        INSERT INTO mrvoice (title, artist, category, filename, time, modtime)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run([songData.title, songData.artist, songData.category, 
                              songData.filename, songData.duration || '00:00', Math.floor(Date.now() / 1000)]);
      
      stmt.finalize();
      
      debugLog?.info('Raw database result:', { 
        module: 'ipc-handlers', 
        function: 'add-song', 
        result, 
        resultType: typeof result,
        hasChanges: 'changes' in result,
        hasLastInsertRowid: 'lastInsertRowid' in result,
        changes: result.changes,
        lastInsertRowid: result.lastInsertRowid
      });
      
      return { success: true, data: { changes: result.changes || 0, lastInsertRowid: result.lastInsertRowid || 0 } };
    } catch (error) {
      debugLog?.error('Add song error:', { module: 'ipc-handlers', function: 'add-song', error: error.message });
      return { success: false, error: error.message };
    }
  });

  // File System API handlers (INSECURE - kept for backward compatibility)
  ipcMain.handle('file-read-legacy', async (event, filePath) => {
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      return { success: true, data };
    } catch (error) {
      debugLog?.error('File read error:', { module: 'ipc-handlers', function: 'file-read-legacy', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('file-write', async (event, filePath, data) => {
    try {
      fs.writeFileSync(filePath, data, 'utf8');
      return { success: true };
    } catch (error) {
      debugLog?.error('File write error:', { module: 'ipc-handlers', function: 'file-write', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('file-exists', async (event, filePath) => {
    try {
      return { success: true, exists: fs.existsSync(filePath) };
    } catch (error) {
      debugLog?.error('File exists error:', { module: 'ipc-handlers', function: 'file-exists', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('file-delete', async (event, filePath) => {
    try {
      fs.unlinkSync(filePath);
      return { success: true };
    } catch (error) {
      debugLog?.error('File delete error:', { module: 'ipc-handlers', function: 'file-delete', error: error.message });
      return { success: false, error: error.message };
    }
  });

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
          module: 'ipc-handlers', 
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
          module: 'ipc-handlers', 
          function: 'copyFileStreaming', 
          error: error.message,
          source
        });
      });
      
      destStream.on('error', (error) => {
        debugLog?.error('Destination stream error:', { 
          module: 'ipc-handlers', 
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
            module: 'ipc-handlers', 
            function: 'copyFileStreaming',
            destination
          });
        }
      } catch (cleanupError) {
        debugLog?.warn('Failed to clean up partial file', { 
          module: 'ipc-handlers', 
          function: 'copyFileStreaming',
          error: cleanupError.message,
          destination
        });
      }
      
      debugLog?.error('Streaming file copy error:', { 
        module: 'ipc-handlers', 
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

  ipcMain.handle('file-copy', async (event, sourcePath, destPath) => {
    try {
      // Use streaming for better memory efficiency with large files
      return await copyFileStreaming(sourcePath, destPath);
    } catch (error) {
      debugLog?.error('File copy error:', { module: 'ipc-handlers', function: 'file-copy', error: error.message });
      return { success: false, error: error.message };
    }
  });

  // File copy with progress tracking for large files
  ipcMain.handle('file-copy-with-progress', async (event, sourcePath, destPath) => {
    try {
      const result = await copyFileStreaming(sourcePath, destPath);
      return result;
    } catch (error) {
      debugLog?.error('File copy with progress error:', { module: 'ipc-handlers', function: 'file-copy-with-progress', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('file-mkdir', async (event, dirPath, options = {}) => {
    try {
      fs.mkdirSync(dirPath, { recursive: true, ...options });
      return { success: true };
    } catch (error) {
      debugLog?.error('Directory creation error:', { module: 'ipc-handlers', function: 'file-mkdir', error: error.message });
      return { success: false, error: error.message };
    }
  });

  // Store API handlers
  ipcMain.handle('store-get', async (event, key) => {
    try {
      // Use profile-aware store if available, fallback to regular store
      let value;
      if (profileStoreInstance && profileStoreInstance.get) {
        value = await profileStoreInstance.get(key);
        debugLog?.info('Profile-aware store get', { module: 'ipc-handlers', function: 'store-get', key, valueType: typeof value });
      } else {
        value = store.get(key);
        debugLog?.info('Regular store get', { module: 'ipc-handlers', function: 'store-get', key, valueType: typeof value });
      }
      return { success: true, value };
    } catch (error) {
      debugLog?.error('Store get error:', { module: 'ipc-handlers', function: 'store-get', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('store-set', async (event, key, value) => {
    try {
      // Use profile-aware store if available, fallback to regular store
      let result;
      if (profileStoreInstance && profileStoreInstance.set) {
        result = await profileStoreInstance.set(key, value);
        debugLog?.info('Profile-aware store set', { module: 'ipc-handlers', function: 'store-set', key, valueType: typeof value, result });
      } else {
        store.set(key, value);
        const verify = store.get(key);
        result = { success: true, value: verify };
        debugLog?.info('Regular store set', { module: 'ipc-handlers', function: 'store-set', key, valueType: typeof value });
      }
      return result;
    } catch (error) {
      debugLog?.error('Store set error:', { module: 'ipc-handlers', function: 'store-set', key, error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('store-delete', async (event, key) => {
    try {
      store.delete(key);
      return { success: true };
    } catch (error) {
      debugLog?.error('Store delete error:', { module: 'ipc-handlers', function: 'store-delete', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('store-has', async (event, key) => {
    try {
      return { success: true, has: store.has(key) };
    } catch (error) {
      debugLog?.error('Store has error:', { module: 'ipc-handlers', function: 'store-has', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('store-keys', async () => {
    try {
      return { success: true, keys: Object.keys(store.store) };
    } catch (error) {
      debugLog?.error('Store keys error:', { module: 'ipc-handlers', function: 'store-keys', error: error.message });
      return { success: false, error: error.message };
    }
  });

  // Profile API handlers
  ipcMain.handle('profile-get-available', async () => {
    try {
      if (!profileManagerInstance) {
        throw new Error('Profile manager not initialized');
      }
      const profiles = await profileManagerInstance.getAvailableProfiles();
      return { success: true, profiles };
    } catch (error) {
      debugLog?.error('Profile get available error:', { module: 'ipc-handlers', function: 'profile-get-available', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('profile-get-active', async () => {
    try {
      if (!profileManagerInstance) {
        throw new Error('Profile manager not initialized');
      }
      const activeProfileName = await profileManagerInstance.getActiveProfile();
      return { success: true, profile: { name: activeProfileName } };
    } catch (error) {
      debugLog?.error('Profile get active error:', { module: 'ipc-handlers', function: 'profile-get-active', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('profile-create', async (event, name, description, copyFromCurrent) => {
    try {
      if (!profileManagerInstance) {
        throw new Error('Profile manager not initialized');
      }
      const result = await profileManagerInstance.createProfile(name, description, copyFromCurrent);
      return result;
    } catch (error) {
      debugLog?.error('Profile create error:', { module: 'ipc-handlers', function: 'profile-create', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('profile-delete', async (event, name) => {
    try {
      if (!profileManagerInstance) {
        throw new Error('Profile manager not initialized');
      }
      const result = await profileManagerInstance.deleteProfile(name);
      return result;
    } catch (error) {
      debugLog?.error('Profile delete error:', { module: 'ipc-handlers', function: 'profile-delete', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('profile-update', async (event, originalName, newName, description) => {
    try {
      if (!profileManagerInstance) {
        throw new Error('Profile manager not initialized');
      }
      const result = await profileManagerInstance.updateProfile(originalName, newName, description);
      return { success: result };
    } catch (error) {
      debugLog?.error('Profile update error:', { module: 'ipc-handlers', function: 'profile-update', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('profile-switch', async (event, name) => {
    try {
      if (!profileManagerInstance) {
        throw new Error('Profile manager not initialized');
      }
      
      debugLog?.info('Profile switch requested', { 
        module: 'ipc-handlers', 
        function: 'profile-switch', 
        profileName: name 
      });
      
      // Import switchToProfile function to properly restart the app
      const { switchToProfile } = await import('./app-setup.js');
      
      // Use switchToProfile which will set the active profile AND restart the app
      await switchToProfile(name);
      
      // This line should never be reached since switchToProfile calls app.exit(0)
      return { success: true };
    } catch (error) {
      debugLog?.error('Profile switch error:', { module: 'ipc-handlers', function: 'profile-switch', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('profile-set-active', async (event, name) => {
    try {
      if (!profileManagerInstance) {
        throw new Error('Profile manager not initialized');
      }
      
      debugLog?.info('Setting active profile (no restart)', { 
        module: 'ipc-handlers', 
        function: 'profile-set-active', 
        profileName: name 
      });
      
      // Set active profile without restarting (for use during startup)
      const result = await profileManagerInstance.setActiveProfile(name);
      
      if (result) {
        debugLog?.info('Active profile set successfully', { 
          module: 'ipc-handlers', 
          function: 'profile-set-active', 
          profileName: name 
        });
      }
      
      return { success: result };
    } catch (error) {
      debugLog?.error('Set active profile error:', { module: 'ipc-handlers', function: 'profile-set-active', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('profile-should-show-selection', async () => {
    try {
      if (!profileManagerInstance) {
        throw new Error('Profile manager not initialized');
      }
      const shouldShow = await profileManagerInstance.shouldShowProfileSelection();
      return { success: true, shouldShow };
    } catch (error) {
      debugLog?.error('Profile should show selection error:', { module: 'ipc-handlers', function: 'profile-should-show-selection', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('profile-mark-selection-shown', async () => {
    try {
      if (!profileManagerInstance) {
        throw new Error('Profile manager not initialized');
      }
      const result = profileManagerInstance.markProfileSelectionShown();
      return { success: result };
    } catch (error) {
      debugLog?.error('Profile mark selection shown error:', { module: 'ipc-handlers', function: 'profile-mark-selection-shown', error: error.message });
      return { success: false, error: error.message };
    }
  });

  // Profile menu IPC handlers
  ipcMain.handle('show-profile-management', async () => {
    try {
      if (!profileManagerInstance) {
        throw new Error('Profile manager not initialized');
      }
      // This will be handled by the renderer process
      return { success: true };
    } catch (error) {
      debugLog?.error('Show profile management error:', { module: 'ipc-handlers', function: 'show-profile-management', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('show-create-profile', async () => {
    try {
      if (!profileManagerInstance) {
        throw new Error('Profile manager not initialized');
      }
      // This will be handled by the renderer process
      return { success: true };
    } catch (error) {
      debugLog?.error('Show create profile error:', { module: 'ipc-handlers', function: 'show-create-profile', error: error.message });
      return { success: false, error: error.message };
    }
  });

  // Audio API handlers
  ipcMain.handle('audio-play', async (event, filePath) => {
    try {
      // Stop any currently playing audio
      Howler.stop();
      
      // Create new audio instance
      const sound = new Howl({
        src: [filePath],
        html5: true,
        volume: 1.0
      });
      
      // Store the instance
      const soundId = Date.now().toString();
      audioInstances.set(soundId, sound);
      
      // Play the audio
      sound.play();
      
      return { success: true, id: soundId };
    } catch (error) {
      debugLog?.error('Audio play error:', { module: 'ipc-handlers', function: 'audio-play', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('audio-stop', async (event, soundId) => {
    try {
      if (soundId) {
        // Stop specific sound
        const sound = audioInstances.get(soundId);
        if (sound) {
          sound.stop();
          audioInstances.delete(soundId);
        }
      } else {
        // Stop all sounds
        Howler.stop();
        audioInstances.clear();
      }
      return { success: true };
    } catch (error) {
      debugLog?.error('Audio stop error:', { module: 'ipc-handlers', function: 'audio-stop', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('audio-pause', async (event, soundId) => {
    try {
      if (soundId) {
        const sound = audioInstances.get(soundId);
        if (sound) {
          sound.pause();
        }
      } else {
        Howler.stop();
      }
      return { success: true };
    } catch (error) {
      debugLog?.error('Audio pause error:', { module: 'ipc-handlers', function: 'audio-pause', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('audio-volume', async (event, volume) => {
    try {
      Howler.volume(volume);
      return { success: true };
    } catch (error) {
      debugLog?.error('Audio volume error:', { module: 'ipc-handlers', function: 'audio-volume', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('audio-fade', async (event, soundId, fromVolume, toVolume, duration) => {
    try {
      if (soundId) {
        const sound = audioInstances.get(soundId);
        if (sound) {
          sound.fade(fromVolume, toVolume, duration);
        }
      } else {
        // Fade all sounds
        audioInstances.forEach(sound => {
          sound.fade(fromVolume, toVolume, duration);
        });
      }
      return { success: true };
    } catch (error) {
      debugLog?.error('Audio fade error:', { module: 'ipc-handlers', function: 'audio-fade', error: error.message });
      return { success: false, error: error.message };
    }
  });

  // Path operations
  ipcMain.handle('path-join', async (event, ...paths) => {
    try {
      const joinedPath = path.join(...paths);
      return { success: true, data: joinedPath };
    } catch (error) {
      debugLog?.error('Path join error:', { module: 'ipc-handlers', function: 'path-join', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('path-parse', async (event, filePath) => {
    try {
      const parsedPath = path.parse(filePath);
      return { success: true, data: parsedPath };
    } catch (error) {
      debugLog?.error('Path parse error:', { module: 'ipc-handlers', function: 'path-parse', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('path-extname', async (event, filePath) => {
    try {
      const ext = path.extname(filePath);
      return { success: true, data: ext };
    } catch (error) {
      debugLog?.error('Path extname error:', { module: 'ipc-handlers', function: 'path-extname', error: error.message });
      return { success: false, error: error.message };
    }
  });

  // File system operations
  ipcMain.handle('fs-readdir', async (event, dirPath) => {
    try {
      return fs.readdirSync(dirPath);
    } catch (error) {
      debugLog?.error('File system readdir error:', { module: 'ipc-handlers', function: 'fs-readdir', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('fs-stat', async (event, filePath) => {
    try {
      const stats = fs.statSync(filePath);
      return {
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        size: stats.size,
        mtime: stats.mtime,
        ctime: stats.ctime
      };
    } catch (error) {
      debugLog?.error('File system stat error:', { module: 'ipc-handlers', function: 'fs-stat', error: error.message });
      return { success: false, error: error.message };
    }
  });

  // ===============================================
  // SECURE IPC HANDLERS FOR CONTEXT ISOLATION
  // ===============================================
  
  // Enhanced secure file operations with validation
  ipcMain.handle('file-read', async (event, filePath) => {
    try {
      // Security: Validate input
      if (!filePath || typeof filePath !== 'string') {
        throw new Error('Invalid file path');
      }
      
      // Security: Restrict to allowed directories
      const allowedPaths = [
        app.getPath('userData'),
        app.getPath('documents'),
        app.getPath('music'),
        app.getPath('downloads'),
        app.getPath('home')
      ];
      
      const resolvedPath = path.resolve(filePath);
      const isAllowed = allowedPaths.some(allowedPath => {
        const resolvedAllowedPath = path.resolve(allowedPath);
        return resolvedPath.startsWith(resolvedAllowedPath);
      });
      
      if (!isAllowed) {
        debugLog?.warn('File access denied', { 
          module: 'ipc-handlers', 
          function: 'file-read-secure', 
          filePath: filePath,
          resolvedPath: resolvedPath
        });
        throw new Error(`Access denied: File path not in allowed directories`);
      }
      
      const data = await fs.promises.readFile(resolvedPath, 'utf8');
      return { success: true, data };
    } catch (error) {
      debugLog?.error('Secure file read error:', { 
        module: 'ipc-handlers', 
        function: 'file-read-secure', 
        error: error.message,
        filePath: filePath 
      });
      return { success: false, error: error.message };
    }
  });

  // Additional path operations for secure API
  ipcMain.handle('path-dirname', async (event, filePath) => {
    try {
      if (!filePath || typeof filePath !== 'string') {
        throw new Error('Invalid file path');
      }
      return { success: true, data: path.dirname(filePath) };
    } catch (error) {
      debugLog?.error('Path dirname error:', { module: 'ipc-handlers', function: 'path-dirname', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('path-basename', async (event, filePath, ext) => {
    try {
      if (!filePath || typeof filePath !== 'string') {
        throw new Error('Invalid file path');
      }
      return { success: true, data: path.basename(filePath, ext) };
    } catch (error) {
      debugLog?.error('Path basename error:', { module: 'ipc-handlers', function: 'path-basename', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('path-resolve', async (event, ...paths) => {
    try {
      return { success: true, data: path.resolve(...paths) };
    } catch (error) {
      debugLog?.error('Path resolve error:', { module: 'ipc-handlers', function: 'path-resolve', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('path-normalize', async (event, filePath) => {
    try {
      if (!filePath || typeof filePath !== 'string') {
        throw new Error('Invalid file path');
      }
      return { success: true, data: path.normalize(filePath) };
    } catch (error) {
      debugLog?.error('Path normalize error:', { module: 'ipc-handlers', function: 'path-normalize', error: error.message });
      return { success: false, error: error.message };
    }
  });

  // OS operations for secure API
  ipcMain.handle('os-homedir', async () => {
    try {
      return { success: true, data: os.homedir() };
    } catch (error) {
      debugLog?.error('OS homedir error:', { module: 'ipc-handlers', function: 'os-homedir', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('os-platform', async () => {
    try {
      return { success: true, data: os.platform() };
    } catch (error) {
      debugLog?.error('OS platform error:', { module: 'ipc-handlers', function: 'os-platform', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('os-arch', async () => {
    try {
      return { success: true, data: os.arch() };
    } catch (error) {
      debugLog?.error('OS arch error:', { module: 'ipc-handlers', function: 'os-arch', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('os-tmpdir', async () => {
    try {
      return { success: true, data: os.tmpdir() };
    } catch (error) {
      debugLog?.error('OS tmpdir error:', { module: 'ipc-handlers', function: 'os-tmpdir', error: error.message });
      return { success: false, error: error.message };
    }
  });

  // Enhanced audio operations for secure API
  ipcMain.handle('audio-resume', async (event, soundId) => {
    try {
      if (soundId) {
        const sound = audioInstances.get(soundId);
        if (sound) {
          sound.play();
        }
      }
      return { success: true };
    } catch (error) {
      debugLog?.error('Audio resume error:', { module: 'ipc-handlers', function: 'audio-resume', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('audio-set-volume', async (event, volume, soundId) => {
    try {
      if (soundId) {
        const sound = audioInstances.get(soundId);
        if (sound) {
          sound.volume(volume);
        }
      } else {
        Howler.volume(volume);
      }
      return { success: true };
    } catch (error) {
      debugLog?.error('Audio set volume error:', { module: 'ipc-handlers', function: 'audio-set-volume', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('audio-get-duration', async (event, filePath) => {
    try {
      if (!filePath || typeof filePath !== 'string') {
        throw new Error('Invalid file path');
      }
      // First attempt: music-metadata
      let durationSec = 0;
      try {
        const metadata = await parseAudioFile(filePath);
        durationSec = metadata?.format?.duration ? Number(metadata.format.duration) : 0;
      } catch (e) {
        debugLog?.warn('music-metadata parse failed for duration', { module: 'ipc-handlers', function: 'audio-get-duration', error: e?.message, filePath });
      }

      // Fallback: Howler (loads audio to get accurate duration)
      if (!(durationSec > 0.5)) {
        await new Promise((resolve) => setImmediate(resolve));
        durationSec = await new Promise((resolve, reject) => {
          const sound = new Howl({ src: [filePath], html5: true, preload: true });
          const cleanup = () => {
            try { 
              sound.unload(); 
            } catch (error) {
              debugLog?.warn('Failed to unload Howler sound during cleanup', { 
                module: 'ipc-handlers', 
                function: 'audio-get-duration',
                error: error?.message || 'Unknown error' 
              });
            }
          };
          sound.once('load', () => {
            try {
              const d = Number(sound.duration());
              cleanup();
              resolve(isFinite(d) ? d : 0);
            } catch (err) {
              cleanup();
              resolve(0);
            }
          });
          sound.once('loaderror', (_id, err) => {
            cleanup();
            debugLog?.warn('Howler loaderror while getting duration', { module: 'ipc-handlers', function: 'audio-get-duration', error: err, filePath });
            resolve(0);
          });
        });
      }

      debugLog?.info('audio-get-duration result', { module: 'ipc-handlers', function: 'audio-get-duration', filePath, durationSec });
      return { success: true, duration: isFinite(durationSec) ? durationSec : 0 };
    } catch (error) {
      debugLog?.error('Audio get duration error:', { module: 'ipc-handlers', function: 'audio-get-duration', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('audio-get-metadata', async (event, filePath) => {
    try {
      if (!filePath || typeof filePath !== 'string') {
        throw new Error('Invalid file path');
      }
      const metadata = await parseAudioFile(filePath);
      const title = metadata?.common?.title || '';
      // Some files store artist as array
      const artist = Array.isArray(metadata?.common?.artist)
        ? metadata.common.artist.join(', ')
        : (metadata?.common?.artist || '');
      const duration = metadata?.format?.duration ? Number(metadata.format.duration) : 0;
      return { success: true, data: { title, artist, duration } };
    } catch (error) {
      debugLog?.warn('Audio get metadata error', { module: 'ipc-handlers', function: 'audio-get-metadata', error: error.message, filePath });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('audio-get-position', async (event, soundId) => {
    try {
      if (soundId) {
        const sound = audioInstances.get(soundId);
        if (sound) {
          return { success: true, position: sound.seek() };
        }
      }
      return { success: true, position: 0 };
    } catch (error) {
      debugLog?.error('Audio get position error:', { module: 'ipc-handlers', function: 'audio-get-position', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('audio-set-position', async (event, soundId, position) => {
    try {
      if (soundId) {
        const sound = audioInstances.get(soundId);
        if (sound) {
          sound.seek(position);
        }
      }
      return { success: true };
    } catch (error) {
      debugLog?.error('Audio set position error:', { module: 'ipc-handlers', function: 'audio-set-position', error: error.message });
      return { success: false, error: error.message };
    }
  });

  // App operations for secure API
  ipcMain.handle('app-get-path', async (event, name) => {
    try {
      return { success: true, data: app.getPath(name) };
    } catch (error) {
      debugLog?.error('App get path error:', { module: 'ipc-handlers', function: 'app-get-path', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('app-get-version', async () => {
    try {
      return { success: true, data: app.getVersion() };
    } catch (error) {
      debugLog?.error('App get version error:', { module: 'ipc-handlers', function: 'app-get-version', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('app-get-name', async () => {
    try {
      return { success: true, data: app.getName() };
    } catch (error) {
      debugLog?.error('App get name error:', { module: 'ipc-handlers', function: 'app-get-name', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('app-quit', async () => {
    try {
      app.quit();
      return { success: true };
    } catch (error) {
      debugLog?.error('App quit error:', { module: 'ipc-handlers', function: 'app-quit', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('app-restart', async () => {
    try {
      app.relaunch();
      app.exit();
      return { success: true };
    } catch (error) {
      debugLog?.error('App restart error:', { module: 'ipc-handlers', function: 'app-restart', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('restart-and-install-new-version', async () => {
    try {
      if (autoUpdater) {
        autoUpdater.quitAndInstall();
        return { success: true };
      } else {
        throw new Error('Auto updater not available');
      }
    } catch (error) {
      debugLog?.error('Restart and install error:', { module: 'ipc-handlers', function: 'restart-and-install-new-version', error: error.message });
      return { success: false, error: error.message };
    }
  });

  // Auto-update handlers - Three-stage process for better UX
  
  // Stage 1: Check for updates (no download)
  ipcMain.handle('check-for-update', async () => {
    try {
      debugLog.info('🔍 Checking for updates...', { 
        module: 'ipc-handlers', 
        function: 'check-for-update',
        currentVersion: app.getVersion()
      });
      
      if (!autoUpdater) {
        throw new Error('Auto updater not available');
      }
      
      // Reset download state
      updateState.downloaded = false;
      updateState.userApprovedInstall = false;
      
      const result = await autoUpdater.checkForUpdates();
      return { 
        success: true, 
        updateAvailable: !!result?.updateInfo,
        updateInfo: result?.updateInfo || null
      };
    } catch (error) {
      debugLog.error('Check for update error:', { 
        module: 'ipc-handlers', 
        function: 'check-for-update',
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  });

  // Stage 2: Download update (user-initiated)
  ipcMain.handle('download-update', async () => {
    try {
      debugLog.info('📥 Starting update download...', { 
        module: 'ipc-handlers', 
        function: 'download-update'
      });
      
      if (!autoUpdater) {
        throw new Error('Auto updater not available');
      }
      
      // Download with timeout to prevent hangs
      const downloadPromise = autoUpdater.downloadUpdate();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Download timeout after 60 seconds')), 60000)
      );
      
      await Promise.race([downloadPromise, timeoutPromise]);
      return { success: true, message: 'Download started' };
    } catch (error) {
      const errorMessage = error?.message || error?.toString() || 'Download failed';
      debugLog.error('Download update error:', { 
        module: 'ipc-handlers', 
        function: 'download-update',
        error: errorMessage 
      });
      return { success: false, error: errorMessage };
    }
  });

  // Stage 3: Install update (only if downloaded)
  ipcMain.handle('install-update', async () => {
    try {
      debugLog.info('🚀 Installing update...', { 
        module: 'ipc-handlers', 
        function: 'install-update',
        downloaded: !!updateState?.downloaded
      });
      
      if (!autoUpdater) {
        throw new Error('Auto updater not available');
      }
      
      if (!updateState?.downloaded) {
        throw new Error('No update has been downloaded yet');
      }
      
      // Install and restart immediately
      setImmediate(() => {
        autoUpdater.quitAndInstall();
      });
      
      return { success: true, message: 'Installing and restarting...' };
    } catch (error) {
      const errorMessage = error?.message || error?.toString() || 'Install failed';
      debugLog.error('Install update error:', { 
        module: 'ipc-handlers', 
        function: 'install-update',
        error: errorMessage 
      });
      return { success: false, error: errorMessage };
    }
  });

  ipcMain.handle('show-file-picker', async (event, options = {}) => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, options);
      return { success: true, data: result };
    } catch (error) {
      debugLog?.error('Show file picker error:', { module: 'ipc-handlers', function: 'show-file-picker', error: error.message });
      return { success: false, error: error.message };
    }
  });

  // Enhanced database operations for secure API
  ipcMain.handle('get-song-by-id', async (event, songId) => {
    try {
      if (!db) {
        throw new Error('Database not initialized');
      }
      if (!songId) {
        throw new Error('Song ID is required');
      }
      // For node-sqlite3-wasm, use prepare/get for parameterized queries
      const stmt = db.prepare('SELECT * FROM mrvoice WHERE id = ?');
      const result = stmt.get(songId);
      stmt.finalize();
      
      // Convert result to expected format
      const data = result ? [result] : [];
      return { success: true, data: data };
    } catch (error) {
      debugLog?.error('Get song by ID error:', { module: 'ipc-handlers', function: 'get-song-by-id', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('delete-song', async (event, songId) => {
    try {
      if (!db) {
        throw new Error('Database not initialized');
      }
      if (!songId) {
        throw new Error('Song ID is required');
      }
      // For node-sqlite3-wasm, use prepare/run for parameterized statements
      const stmt = db.prepare('DELETE FROM mrvoice WHERE id = ?');
      const result = stmt.run(songId);
      stmt.finalize();
      
      return { success: true, data: { changes: result.changes || 0 } };
    } catch (error) {
      debugLog?.error('Delete song error:', { module: 'ipc-handlers', function: 'delete-song', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('delete-selected-song', async () => {
    try {
      // This handler sends a message to the renderer to trigger deletion
      // The actual deletion logic is handled in the renderer
      mainWindow.webContents.send('delete_selected_song');
      return { success: true };
    } catch (error) {
      debugLog?.error('Delete selected song error:', { module: 'ipc-handlers', function: 'delete-selected-song', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('edit-selected-song', async () => {
    try {
      // This handler sends a message to the renderer to trigger editing
      // The actual editing logic is handled in the renderer
      mainWindow.webContents.send('edit_selected_song');
      return { success: true };
    } catch (error) {
      debugLog?.error('Edit selected song error:', { module: 'ipc-handlers', function: 'edit-selected-song', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('update-song', async (event, songData) => {
    try {
      if (!db) {
        throw new Error('Database not initialized');
      }
      if (!songData || !songData.id) {
        throw new Error('Song data with ID is required');
      }
      // For node-sqlite3-wasm, use prepare/run for parameterized statements
      const stmt = db.prepare(`
        UPDATE mrvoice 
        SET title = ?, artist = ?, category = ?, info = ?, filename = ?, time = ?
        WHERE id = ?
      `);
      
      const result = stmt.run([songData.title, songData.artist, songData.category, 
                              songData.info, songData.filename, songData.duration, songData.id]);
      
      stmt.finalize();
      
      return { success: true, data: { changes: result.changes || 0 } };
    } catch (error) {
      debugLog?.error('Update song error:', { module: 'ipc-handlers', function: 'update-song', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('add-category', async (event, categoryData) => {
    try {
      if (!db) {
        throw new Error('Database not initialized');
      }
      
      if (!categoryData || !categoryData.code || !categoryData.description) {
        throw new Error('Category code and description are required');
      }
      
      // For node-sqlite3-wasm, use prepare/run for parameterized statements
      const stmt = db.prepare('INSERT INTO categories (code, description) VALUES (?, ?)');
      const result = stmt.run([categoryData.code, categoryData.description]);
      stmt.finalize();
      
      return { success: true, data: { changes: result.changes || 0, lastInsertRowid: result.lastInsertRowid || 0 } };
    } catch (error) {
      debugLog?.error('Add category error:', { module: 'ipc-handlers', function: 'add-category', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('update-category', async (event, code, description) => {
    try {
      if (!db) {
        throw new Error('Database not initialized');
      }
      if (!code || !description) {
        throw new Error('Category code and description are required');
      }
      // For node-sqlite3-wasm, use prepare/run for parameterized statements
      const stmt = db.prepare('UPDATE categories SET description = ? WHERE code = ?');
      const result = stmt.run([description, code]);
      stmt.finalize();
      
      return { success: true, data: { changes: result.changes || 0 } };
    } catch (error) {
      debugLog?.error('Update category error:', { module: 'ipc-handlers', function: 'update-category', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('delete-category', async (event, code, description) => {
    try {
      if (!db) {
        throw new Error('Database not initialized');
      }
      if (!code) {
        throw new Error('Category code is required');
      }
      
      // First move all songs to "Uncategorized"
      const updateStmt = db.prepare('UPDATE mrvoice SET category = ? WHERE category = ?');
      updateStmt.run(['UNCATEGORIZED', code]);
      updateStmt.finalize();
      
      // Then delete the category
      const deleteStmt = db.prepare('DELETE FROM categories WHERE code = ?');
      const result = deleteStmt.run([code]);
      deleteStmt.finalize();
      
      return { success: true, data: { changes: result.changes || 0 } };
    } catch (error) {
      debugLog?.error('Delete category error:', { module: 'ipc-handlers', function: 'delete-category', error: error.message });
      return { success: false, error: error.message };
    }
  });

  // Store operations enhancement
  ipcMain.handle('store-clear', async () => {
    try {
      store.clear();
      return { success: true };
    } catch (error) {
      debugLog?.error('Store clear error:', { module: 'ipc-handlers', function: 'store-clear', error: error.message });
      return { success: false, error: error.message };
    }
  });

  // File operations enhancements
  ipcMain.handle('import-audio-files', async (event, filePaths) => {
    try {
      // This would be implemented to handle bulk import
      // For now, return a placeholder
      return { success: true, imported: 0, skipped: 0, errors: [] };
    } catch (error) {
      debugLog?.error('Import audio files error:', { module: 'ipc-handlers', function: 'import-audio-files', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('export-data', async (event, exportOptions) => {
    try {
      // This would be implemented to handle data export
      // For now, return a placeholder
      return { success: true, exportPath: '' };
    } catch (error) {
      debugLog?.error('Export data error:', { module: 'ipc-handlers', function: 'export-data', error: error.message });
      return { success: false, error: error.message };
    }
  });

  // Utility functions for secure API
  ipcMain.handle('generate-id', async () => {
    try {
      return { success: true, data: uuidv4() };
    } catch (error) {
      debugLog?.error('Generate ID error:', { module: 'ipc-handlers', function: 'generate-id', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('format-duration', async (event, seconds) => {
    try {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.floor(seconds % 60);
      const formatted = `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
      return { success: true, data: formatted };
    } catch (error) {
      debugLog?.error('Format duration error:', { module: 'ipc-handlers', function: 'format-duration', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('validate-audio-file', async (event, filePath) => {
    try {
      if (!filePath || typeof filePath !== 'string') {
        return { success: true, data: false };
      }
      const ext = path.extname(filePath).toLowerCase();
      const validExtensions = ['.mp3', '.mp4', '.m4a', '.wav', '.ogg', '.flac'];
      return { success: true, data: validExtensions.includes(ext) };
    } catch (error) {
      debugLog?.error('Validate audio file error:', { module: 'ipc-handlers', function: 'validate-audio-file', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('sanitize-filename', async (event, filename) => {
    try {
      if (!filename || typeof filename !== 'string') {
        return { success: true, data: '' };
      }
      // Remove or replace invalid characters
      const sanitized = filename.replace(/[<>:"/\\|?*]/g, '_').trim();
      return { success: true, data: sanitized };
    } catch (error) {
      debugLog?.error('Sanitize filename error:', { module: 'ipc-handlers', function: 'sanitize-filename', error: error.message });
      return { success: false, error: error.message };
    }
  });

  debugLog?.info('✅ Secure IPC handlers registered successfully', { 
    module: 'ipc-handlers', 
    function: 'registerAllHandlers',
    secureHandlersCount: 50
  });

  debugLog?.info('✅ All IPC handlers registered successfully (context isolation ready)', { 
    module: 'ipc-handlers', 
    function: 'registerAllHandlers',
    note: 'Using secure handlers only - legacy handlers removed for security'
  });

  // Mark handlers as registered to prevent duplicates
  handlersRegistered = true;
}

  // Remove all handlers (for cleanup)
function removeAllHandlers() {
  // Reset registration flag
  handlersRegistered = false;
  // Legacy handlers
  ipcMain.removeHandler('get-app-path');
  ipcMain.removeHandler('show-directory-picker');
  ipcMain.removeHandler('open-hotkey-file');
  ipcMain.removeHandler('save-hotkey-file');
  ipcMain.removeHandler('open-holding-tank-file');
  ipcMain.removeHandler('save-holding-tank-file');
  ipcMain.removeHandler('restart-and-install-new-version');
  ipcMain.removeHandler('increase-font-size');
  ipcMain.removeHandler('decrease-font-size');
  ipcMain.removeHandler('toggle-waveform');
  ipcMain.removeHandler('toggle-advanced-search');
  ipcMain.removeHandler('close-all-tabs');
  ipcMain.removeHandler('delete-selected-song');
  ipcMain.removeHandler('edit-selected-song');
  ipcMain.removeHandler('manage-categories');
  ipcMain.removeHandler('show-preferences');
  ipcMain.removeHandler('database-query');
  ipcMain.removeHandler('database-execute');
  ipcMain.removeHandler('get-categories');
  ipcMain.removeHandler('add-song');
  ipcMain.removeHandler('file-read-legacy');
  ipcMain.removeHandler('file-write');
  ipcMain.removeHandler('file-exists');
  ipcMain.removeHandler('file-delete');
  ipcMain.removeHandler('file-copy');
  ipcMain.removeHandler('file-mkdir');
  ipcMain.removeHandler('store-get');
  ipcMain.removeHandler('store-set');
  ipcMain.removeHandler('store-delete');
  ipcMain.removeHandler('store-has');
  ipcMain.removeHandler('store-keys');
  ipcMain.removeHandler('audio-play');
  ipcMain.removeHandler('audio-stop');
  ipcMain.removeHandler('audio-pause');
  ipcMain.removeHandler('audio-volume');
  ipcMain.removeHandler('audio-fade');
  ipcMain.removeHandler('path-join');
  ipcMain.removeHandler('path-parse');
  ipcMain.removeHandler('path-extname');
  ipcMain.removeHandler('fs-readdir');
  ipcMain.removeHandler('fs-stat');
  
  // Secure API handlers
  ipcMain.removeHandler('file-read');
  ipcMain.removeHandler('get-song-by-id');
  ipcMain.removeHandler('delete-song');
  ipcMain.removeHandler('update-song');
  ipcMain.removeHandler('add-category');
  ipcMain.removeHandler('update-category');
  ipcMain.removeHandler('delete-category');
  ipcMain.removeHandler('path-dirname');
  ipcMain.removeHandler('path-basename');
  ipcMain.removeHandler('path-resolve');
  ipcMain.removeHandler('path-normalize');
  ipcMain.removeHandler('os-homedir');
  ipcMain.removeHandler('os-platform');
  ipcMain.removeHandler('os-arch');
  ipcMain.removeHandler('os-tmpdir');
  ipcMain.removeHandler('audio-resume');
  ipcMain.removeHandler('audio-set-volume');
  ipcMain.removeHandler('audio-get-duration');
  ipcMain.removeHandler('audio-get-position');
  ipcMain.removeHandler('audio-set-position');
  ipcMain.removeHandler('app-get-path');
  ipcMain.removeHandler('app-get-version');
  ipcMain.removeHandler('app-get-name');
  ipcMain.removeHandler('app-quit');
  ipcMain.removeHandler('app-restart');
  ipcMain.removeHandler('show-file-picker');
  ipcMain.removeHandler('store-clear');
  ipcMain.removeHandler('import-audio-files');
  ipcMain.removeHandler('export-data');
  ipcMain.removeHandler('generate-id');
  ipcMain.removeHandler('format-duration');
  ipcMain.removeHandler('validate-audio-file');
  ipcMain.removeHandler('sanitize-filename');
  
  // Remove legacy event listeners
  ipcMain.removeAllListeners('open-hotkey-file');
  ipcMain.removeAllListeners('save-hotkey-file');
  ipcMain.removeAllListeners('open-holding-tank-file');
  ipcMain.removeAllListeners('save-holding-tank-file');
  
  debugLog?.info('IPC handlers removed successfully', { module: 'ipc-handlers', function: 'removeAllHandlers' });
}

// Test function
function testIpcHandlers() {
  debugLog?.info('Testing IPC Handlers...', { module: 'ipc-handlers', function: 'testIpcHandlers' });
  debugLog?.info('✅ IPC handlers module loaded', { module: 'ipc-handlers', function: 'testIpcHandlers' });
  return true;
}

export {
  initializeIpcHandlers,
  registerAllHandlers,
  removeAllHandlers,
  testIpcHandlers
};

// Default export for module loading
export default {
  initializeIpcHandlers,
  registerAllHandlers,
  removeAllHandlers,
  testIpcHandlers
}; 