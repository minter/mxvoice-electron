// IPC Handlers Module
// Contains all IPC handlers for the main process

const { ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { Howl, Howler } = require('howler');

// Dependencies that will be injected
let mainWindow;
let db;
let store;
let audioInstances;
let autoUpdater;

// Initialize the module with dependencies
function initializeIpcHandlers(dependencies) {
  mainWindow = dependencies.mainWindow;
  db = dependencies.db;
  store = dependencies.store;
  audioInstances = dependencies.audioInstances;
  autoUpdater = dependencies.autoUpdater;
  
  registerAllHandlers();
}

// Register all IPC handlers
function registerAllHandlers() {
  // App operations
  ipcMain.handle('get-app-path', async (event) => {
    const result = await require('electron').app.getAppPath();
    return result;
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
    return await loadHotkeysFile();
  });

  ipcMain.handle('save-hotkey-file', async (event, hotkeyArray) => {
    return await saveHotkeysFile(hotkeyArray);
  });

  ipcMain.handle('open-holding-tank-file', async () => {
    return await loadHoldingTankFile();
  });

  ipcMain.handle('save-holding-tank-file', async (event, holdingTankArray) => {
    return await saveHoldingTankFile(holdingTankArray);
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
      console.error('Database query error:', error);
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
      console.error('Database execute error:', error);
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
      console.error('Get categories error:', error);
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
      console.error('Add song error:', error);
      return { success: false, error: error.message };
    }
  });

  // File System API handlers
  ipcMain.handle('file-read', async (event, filePath) => {
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      return { success: true, data };
    } catch (error) {
      console.error('File read error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('file-write', async (event, filePath, data) => {
    try {
      fs.writeFileSync(filePath, data, 'utf8');
      return { success: true };
    } catch (error) {
      console.error('File write error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('file-exists', async (event, filePath) => {
    try {
      return { success: true, exists: fs.existsSync(filePath) };
    } catch (error) {
      console.error('File exists error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('file-delete', async (event, filePath) => {
    try {
      fs.unlinkSync(filePath);
      return { success: true };
    } catch (error) {
      console.error('File delete error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('file-copy', async (event, sourcePath, destPath) => {
    try {
      fs.copyFileSync(sourcePath, destPath);
      return { success: true };
    } catch (error) {
      console.error('File copy error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('file-mkdir', async (event, dirPath, options = {}) => {
    try {
      fs.mkdirSync(dirPath, { recursive: true, ...options });
      return { success: true };
    } catch (error) {
      console.error('Directory creation error:', error);
      return { success: false, error: error.message };
    }
  });

  // Store API handlers
  ipcMain.handle('store-get', async (event, key) => {
    try {
      return { success: true, value: store.get(key) };
    } catch (error) {
      console.error('Store get error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('store-set', async (event, key, value) => {
    try {
      store.set(key, value);
      return { success: true };
    } catch (error) {
      console.error('Store set error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('store-delete', async (event, key) => {
    try {
      store.delete(key);
      return { success: true };
    } catch (error) {
      console.error('Store delete error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('store-has', async (event, key) => {
    try {
      return { success: true, has: store.has(key) };
    } catch (error) {
      console.error('Store has error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('store-keys', async () => {
    try {
      return { success: true, keys: store.store };
    } catch (error) {
      console.error('Store keys error:', error);
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
      console.error('Audio play error:', error);
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
      console.error('Audio stop error:', error);
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
      console.error('Audio pause error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('audio-volume', async (event, volume) => {
    try {
      Howler.volume(volume);
      return { success: true };
    } catch (error) {
      console.error('Audio volume error:', error);
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
      console.error('Audio fade error:', error);
      return { success: false, error: error.message };
    }
  });

  // Path operations
  ipcMain.handle('path-join', async (event, ...paths) => {
    try {
      const joinedPath = path.join(...paths);
      return { success: true, data: joinedPath };
    } catch (error) {
      console.error('Path join error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('path-parse', async (event, filePath) => {
    try {
      return path.parse(filePath);
    } catch (error) {
      console.error('Path parse error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('path-extname', async (event, filePath) => {
    try {
      return path.extname(filePath);
    } catch (error) {
      console.error('Path extname error:', error);
      return { success: false, error: error.message };
    }
  });

  // File system operations
  ipcMain.handle('fs-readdir', async (event, dirPath) => {
    try {
      return fs.readdirSync(dirPath);
    } catch (error) {
      console.error('File system readdir error:', error);
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
      console.error('File system stat error:', error);
      return { success: false, error: error.message };
    }
  });

  // Legacy handlers for backward compatibility
  ipcMain.on('open-hotkey-file', (event, arg) => {
    console.log("Main process starting hotkey open");
    loadHotkeysFile();
  });

  ipcMain.on('save-hotkey-file', (event, arg) => {
    console.log("Main process starting hotkey save");
    console.log(`Arg is ${arg}`);
    console.log(`First element is ${arg[0]}`);
    saveHotkeysFile(arg);
  });

  ipcMain.on('open-holding-tank-file', (event, arg) => {
    console.log("Main process starting holding tank open");
    loadHoldingTankFile();
  });

  ipcMain.on('save-holding-tank-file', (event, arg) => {
    console.log("Main process starting holding tank save");
    console.log(`Arg is ${arg}`);
    console.log(`First element is ${arg[0]}`);
    saveHoldingTankFile(arg);
  });

  console.log('IPC handlers registered successfully');
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
  
  console.log('IPC handlers removed successfully');
}

// Test function
function testIpcHandlers() {
  console.log('Testing IPC Handlers...');
  console.log('✅ IPC handlers module loaded');
  return true;
}

module.exports = {
  initializeIpcHandlers,
  registerAllHandlers,
  removeAllHandlers,
  testIpcHandlers
}; 