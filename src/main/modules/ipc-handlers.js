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
import { Howl, Howler } from 'howler';
import { parseFile as parseAudioFile } from 'music-metadata';
import { v4 as uuidv4 } from 'uuid';

// Import file operations module
import fileOperations from './file-operations.js';
import * as profileManager from './profile-manager.js';
import * as profileBackupManager from './profile-backup-manager.js';
import * as libraryTransferManager from './library-transfer-manager.js';
import { isSupportedAudioFile, copyFileStreaming } from './file-utils.js';
import { isPathInside, canonicalizeForAuthorization } from './ipc/guards.js';
import * as storeHandlers from './ipc/store-handlers.js';
import * as pathOsHandlers from './ipc/path-os-handlers.js';
import * as databaseHandlers from './ipc/database-handlers.js';

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

  // Preload logging — fire-and-forget via ipcRenderer.send (sandbox-safe)
  ipcMain.on('preload-log', (_event, level, message, context) => {
    if (debugLog && typeof debugLog[level] === 'function') {
      debugLog[level](message, context);
    }
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

  ipcMain.handle('file-exists', async (event, filePath) => {
    try {
      if (!filePath || typeof filePath !== 'string') throw new Error('Invalid file path');
      const musicDirectory = store.get('music_directory');
      if (!musicDirectory || !isPathInside(filePath, musicDirectory)) {
        throw new Error('Access denied: Path must be inside the managed music directory');
      }
      return { success: true, exists: fs.existsSync(path.resolve(filePath)) };
    } catch (error) {
      debugLog?.error('File exists error:', { module: 'ipc-handlers', function: 'file-exists', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('file-delete', async (event, filePath) => {
    try {
      // Security: Validate input
      if (!filePath || typeof filePath !== 'string') {
        throw new Error('Invalid file path');
      }

      // Security: Restrict to allowed directories (same pattern as file-read)
      const musicDirectory = store.get('music_directory');
      if (!musicDirectory) throw new Error('Music directory is not configured');
      const allowedPaths = [musicDirectory];

      const resolvedPath = path.resolve(filePath);
      const { canonicalPath, allowed: isAllowed } = await canonicalizeForAuthorization(resolvedPath, allowedPaths);

      if (!isAllowed) {
        debugLog?.warn('File delete access denied', {
          module: 'ipc-handlers',
          function: 'file-delete',
          filePath: filePath,
          resolvedPath: resolvedPath
        });
        throw new Error('Access denied: File path not in allowed directories');
      }

      await fs.promises.unlink(canonicalPath);
      return { success: true };
    } catch (error) {
      // ENOENT means file doesn't exist - treat as success since goal is achieved
      if (error.code === 'ENOENT') {
        debugLog?.info('File already deleted (not found):', {
          module: 'ipc-handlers',
          function: 'file-delete',
          filePath: filePath
        });
        return { success: true, alreadyDeleted: true };
      }
      debugLog?.error('File delete error:', { module: 'ipc-handlers', function: 'file-delete', error: error.message, filePath: filePath });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('file-copy', async (event, sourcePath, destPath) => {
    try {
      if (!sourcePath || !destPath || !isSupportedAudioFile(sourcePath)) {
        throw new Error('Only supported audio files can be imported');
      }
      const musicDirectory = store.get('music_directory');
      if (!musicDirectory || !isPathInside(destPath, musicDirectory)) {
        throw new Error('Access denied: Destination must be inside the managed music directory');
      }
      // Use streaming for better memory efficiency with large files
      return await copyFileStreaming(sourcePath, destPath, { debugLog });
    } catch (error) {
      debugLog?.error('File copy error:', { module: 'ipc-handlers', function: 'file-copy', error: error.message });
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

  ipcMain.handle('library:scan-audio-directory', async (_event, rootPath) => {
    try {
      if (!rootPath || typeof rootPath !== 'string') throw new Error('Invalid directory path');
      const canonicalRoot = await fsPromises.realpath(path.resolve(rootPath));
      const rootStats = await fsPromises.stat(canonicalRoot);
      if (!rootStats.isDirectory()) throw new Error('Selected path is not a directory');

      const audioFiles = [];
      const visit = async directory => {
        const entries = await fsPromises.readdir(directory, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith('.')) continue;
          const entryPath = path.join(directory, entry.name);
          if (entry.isSymbolicLink()) continue;
          if (entry.isDirectory()) await visit(entryPath);
          else if (entry.isFile() && isSupportedAudioFile(entry.name)) {
            audioFiles.push(entryPath);
          }
        }
      };
      await visit(canonicalRoot);
      return { success: true, data: audioFiles };
    } catch (error) {
      debugLog?.error('Audio directory scan error', {
        module: 'ipc-handlers',
        function: 'library:scan-audio-directory',
        error: error.message
      });
      return { success: false, error: error.message };
    }
  });

  // ===============================================
  // SECURE IPC HANDLERS FOR CONTEXT ISOLATION
  // ===============================================
  
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
      // First attempt: music-metadata with duration calculation enabled
      let durationSec = 0;
      try {
        const metadata = await parseAudioFile(filePath, { duration: true });
        durationSec = metadata?.format?.duration ? Number(metadata.format.duration) : 0;
      } catch (e) {
        debugLog?.warn('music-metadata parse failed for duration', { module: 'ipc-handlers', function: 'audio-get-duration', error: e?.message, filePath });
      }

      // Fallback: Howler (loads audio to get accurate duration)
      if (!(durationSec > 0.5)) {
        await new Promise((resolve) => setImmediate(resolve));
        durationSec = await new Promise((resolve, _reject) => {
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
            } catch (_err) {
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
      // Enable duration calculation to get accurate duration for OGG and other formats
      // Without this option, music-metadata may report incorrect durations for OGG/Vorbis files
      const metadata = await parseAudioFile(filePath, { duration: true });
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
      if (analytics) {
        analytics.trackEvent('auto_update_action', { action: 'accepted' });
      }
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

  // File operations enhancements
  ipcMain.handle('import-audio-files', async (_event, _filePaths) => {
    // This would be implemented to handle bulk import
    // For now, return a placeholder
    return { success: true, imported: 0, skipped: 0, errors: [] };
  });

  ipcMain.handle('export-data', async (_event, _exportOptions) => {
    // This would be implemented to handle data export
    // For now, return a placeholder
    return { success: true, exportPath: '' };
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
      return { success: true, data: isSupportedAudioFile(filePath) };
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
