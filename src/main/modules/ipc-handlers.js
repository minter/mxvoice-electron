/**
 * IPC Handlers Module
 * 
 * Handles all IPC (Inter-Process Communication) between main and renderer processes
 * for the MxVoice Electron application.
 */

import { ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { Howl, Howler } from 'howler';

// Import file operations module
import fileOperations from './file-operations.js';

// Dependencies that will be injected
let mainWindow;
let db;
let store;
let audioInstances;
let autoUpdater;
let debugLog;

// Initialize the module with dependencies
function initializeIpcHandlers(dependencies) {
  mainWindow = dependencies.mainWindow;
  db = dependencies.db;
  store = dependencies.store;
  audioInstances = dependencies.audioInstances;
  autoUpdater = dependencies.autoUpdater;
  debugLog = dependencies.debugLog;
  
  // Initialize file operations module
  fileOperations.initializeFileOperations(dependencies);
  
  registerAllHandlers();
}

// Register all IPC handlers
function registerAllHandlers() {
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
  ipcMain.handle('restart-and-install-new-version', async () => {
    autoUpdater.quitAndInstall();
  });

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
  ipcMain.handle('delete-selected-song', async () => {
    mainWindow.webContents.send('delete_selected_song');
  });

  ipcMain.handle('edit-selected-song', async () => {
    mainWindow.webContents.send('edit_selected_song');
  });

  // Category operations
  ipcMain.handle('manage-categories', async () => {
    mainWindow.webContents.send('manage_categories');
  });

  // Preferences
  ipcMain.handle('show-preferences', async () => {
    mainWindow.webContents.send('show_preferences');
  });

  // Database API handlers
  ipcMain.handle('database-query', async (event, sql, params) => {
    try {
      if (!db) {
        throw new Error('Database not initialized');
      }
      const stmt = db.prepare(sql);
      return { success: true, data: stmt.all(params || []) };
    } catch (error) {
      debugLog?.error('Database query error:', { module: 'ipc-handlers', function: 'database-query', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('database-execute', async (event, sql, params) => {
    try {
      if (!db) {
        throw new Error('Database not initialized');
      }
      const stmt = db.prepare(sql);
      return { success: true, data: stmt.run(params || []) };
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
      const stmt = db.prepare('SELECT * FROM categories ORDER BY description ASC');
      return { success: true, data: stmt.all() };
    } catch (error) {
      debugLog?.error('Get categories error:', { module: 'ipc-handlers', function: 'get-categories', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('add-song', async (event, songData) => {
    try {
      if (!db) {
        throw new Error('Database not initialized');
      }
      const stmt = db.prepare(`
        INSERT INTO songs (title, artist, category_id, filename, duration, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(songData.title, songData.artist, songData.category_id, 
                             songData.filename, songData.duration, songData.notes);
      return { success: true, data: result };
    } catch (error) {
      debugLog?.error('Add song error:', { module: 'ipc-handlers', function: 'add-song', error: error.message });
      return { success: false, error: error.message };
    }
  });

  // File System API handlers
  ipcMain.handle('file-read', async (event, filePath) => {
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      return { success: true, data };
    } catch (error) {
      debugLog?.error('File read error:', { module: 'ipc-handlers', function: 'file-read', error: error.message });
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

  ipcMain.handle('file-copy', async (event, sourcePath, destPath) => {
    try {
      fs.copyFileSync(sourcePath, destPath);
      return { success: true };
    } catch (error) {
      debugLog?.error('File copy error:', { module: 'ipc-handlers', function: 'file-copy', error: error.message });
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
      return { success: true, value: store.get(key) };
    } catch (error) {
      debugLog?.error('Store get error:', { module: 'ipc-handlers', function: 'store-get', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('store-set', async (event, key, value) => {
    try {
      store.set(key, value);
      return { success: true };
    } catch (error) {
      debugLog?.error('Store set error:', { module: 'ipc-handlers', function: 'store-set', error: error.message });
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
      return { success: true, keys: store.store };
    } catch (error) {
      debugLog?.error('Store keys error:', { module: 'ipc-handlers', function: 'store-keys', error: error.message });
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
      return path.parse(filePath);
    } catch (error) {
      debugLog?.error('Path parse error:', { module: 'ipc-handlers', function: 'path-parse', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('path-extname', async (event, filePath) => {
    try {
      return path.extname(filePath);
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

  // Legacy handlers for backward compatibility
  ipcMain.on('open-hotkey-file', (event, arg) => {
    debugLog?.info("Main process starting hotkey open", { module: 'ipc-handlers', function: 'open-hotkey-file' });
    fileOperations.loadHotkeysFile();
  });

  ipcMain.on('save-hotkey-file', (event, arg) => {
    debugLog?.info("Main process starting hotkey save", { module: 'ipc-handlers', function: 'save-hotkey-file' });
    debugLog?.info(`Arg is ${arg}`, { module: 'ipc-handlers', function: 'save-hotkey-file', arg: arg });
    debugLog?.info(`First element is ${arg[0]}`, { module: 'ipc-handlers', function: 'save-hotkey-file', firstElement: arg[0] });
    fileOperations.saveHotkeysFile(arg);
  });

  ipcMain.on('open-holding-tank-file', (event, arg) => {
    debugLog?.info("Main process starting holding tank open", { module: 'ipc-handlers', function: 'open-holding-tank-file' });
    fileOperations.loadHoldingTankFile();
  });

  ipcMain.on('save-holding-tank-file', (event, arg) => {
    debugLog?.info("Main process starting holding tank save", { module: 'ipc-handlers', function: 'save-holding-tank-file' });
    debugLog?.info(`Arg is ${arg}`, { module: 'ipc-handlers', function: 'save-holding-tank-file', arg: arg });
    debugLog?.info(`First element is ${arg[0]}`, { module: 'ipc-handlers', function: 'save-holding-tank-file', firstElement: arg[0] });
    fileOperations.saveHoldingTankFile(arg);
  });

  debugLog?.info('IPC handlers registered successfully', { module: 'ipc-handlers', function: 'registerAllHandlers' });
}

// Remove all handlers (for cleanup)
function removeAllHandlers() {
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
  ipcMain.removeHandler('file-read');
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