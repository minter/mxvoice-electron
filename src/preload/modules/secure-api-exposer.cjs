/**
 * Secure API Exposer Module
 * 
 * Provides secure API exposure using contextBridge for modern Electron security.
 * This module will work with context isolation enabled and provides a secure
 * alternative to direct Node.js API exposure.
 */

const { contextBridge, ipcRenderer, webUtils } = require('electron');
const { IPC } = require('../../shared/ipc-channels.cjs');

// debugLog will be injected by the calling module
let debugLog = null;

// Secure API structure for context isolation
// Helpers to make payloads structured-clone safe for IPC
const MAX_DEPTH = 3;
const MAX_KEYS = 50;
const MAX_STRING = 1000;

function truncateString(str) {
  try {
    const s = String(str);
    return s.length > MAX_STRING ? s.slice(0, MAX_STRING) + '…' : s;
  } catch (_e) {
    return '[Unprintable]';
  }
}

function sanitizeForIPC(value, depth = 0, seen = new WeakSet()) {
  if (value === null || value === undefined) return value;
  const t = typeof value;
  if (t === 'string') return truncateString(value);
  if (t === 'number' || t === 'boolean' || t === 'bigint') return value;
  if (t === 'symbol') return '[Symbol]';
  if (t === 'function') return '[Function]';
  if (depth >= MAX_DEPTH) return '[MaxDepth]';
  if (seen.has(value)) return '[Circular]';

  // Error objects
  if (value instanceof Error) {
    return {
      name: value.name,
      message: truncateString(value.message),
      stack: truncateString(value.stack || '')
    };
  }

  // DOM/Event-like objects
  if (typeof Event !== 'undefined' && value instanceof Event) {
    return { type: value.type, isTrusted: !!value.isTrusted };
  }

  // Promises / thenables
  if (typeof value === 'object' && (typeof value.then === 'function')) {
    return '[Promise]';
  }

  // Array
  if (Array.isArray(value)) {
    seen.add(value);
    return value.slice(0, MAX_KEYS).map((v) => sanitizeForIPC(v, depth + 1, seen));
  }

  // Generic object
  try {
    const out = {};
    seen.add(value);
    let count = 0;
    for (const key of Object.keys(value)) {
      out[key] = sanitizeForIPC(value[key], depth + 1, seen);
      if (++count >= MAX_KEYS) {
        out['[truncated]'] = `Only first ${MAX_KEYS} keys included`;
        break;
      }
    }
    return out;
  } catch (error) {
    // Log error in error handling to avoid infinite recursion
    try {
      debugLog.error('Failed to serialize object for IPC', { 
        module: 'secure-api-exposer', 
        function: 'sanitizeForIPC',
        error: error?.message || 'Unknown error' 
      });
    } catch (_) {
      // Fallback to prevent infinite recursion
    }
    return '[Unserializable]';
  }
}

const secureElectronAPI = {
  // Database operations - all go through secure IPC
  database: {
    getCategories: () => ipcRenderer.invoke(IPC.DATABASE.GET_CATEGORIES),
    addSong: (songData) => ipcRenderer.invoke(IPC.DATABASE.ADD_SONG, songData),
    getSongById: (songId) => ipcRenderer.invoke(IPC.DATABASE.GET_SONG_BY_ID, songId),
    deleteSong: (songId) => ipcRenderer.invoke(IPC.DATABASE.DELETE_SONG, songId),
    updateSong: (songData) => ipcRenderer.invoke(IPC.DATABASE.UPDATE_SONG, songData),
    addCategory: (categoryData) => ipcRenderer.invoke(IPC.DATABASE.ADD_CATEGORY, categoryData),
    updateCategory: (code, description) => ipcRenderer.invoke(IPC.DATABASE.UPDATE_CATEGORY, code, description),
    deleteCategory: (code, description) => ipcRenderer.invoke(IPC.DATABASE.DELETE_CATEGORY, code, description),
    searchSongs: (searchParams) => ipcRenderer.invoke(IPC.DATABASE.SEARCH_SONGS, searchParams),
    getCategoryByCode: (code) => ipcRenderer.invoke(IPC.DATABASE.GET_CATEGORY_BY_CODE, code),
    getSongsByIds: (ids) => ipcRenderer.invoke(IPC.DATABASE.GET_SONGS_BY_IDS, ids),
    reassignSongCategory: (fromCode, toCode) => ipcRenderer.invoke(IPC.DATABASE.REASSIGN_SONG_CATEGORY, fromCode, toCode),
    findCategoryCodesLike: (code, pattern) => ipcRenderer.invoke(IPC.DATABASE.FIND_CATEGORY_CODES_LIKE, code, pattern),
    countSongs: () => ipcRenderer.invoke(IPC.DATABASE.COUNT_SONGS)
  },
  
  // Store operations - secure preference management
  store: {
    get: (key) => ipcRenderer.invoke(IPC.STORE.GET, key),
    set: (key, value) => ipcRenderer.invoke(IPC.STORE.SET, key, value),
    delete: (key) => ipcRenderer.invoke(IPC.STORE.DELETE, key),
    has: (key) => ipcRenderer.invoke(IPC.STORE.HAS, key),
    keys: () => ipcRenderer.invoke(IPC.STORE.KEYS),
    clear: () => ipcRenderer.invoke(IPC.STORE.CLEAR)
  },
  
  // File system operations - secure file access with validation
  fileSystem: {
    exists: (filePath) => ipcRenderer.invoke(IPC.FILESYSTEM.FILE_EXISTS, filePath),
    delete: (filePath) => ipcRenderer.invoke(IPC.FILESYSTEM.FILE_DELETE, filePath),
    copy: (sourcePath, destPath) => ipcRenderer.invoke(IPC.FILESYSTEM.FILE_COPY, sourcePath, destPath),
    scanAudioDirectory: (rootPath) => ipcRenderer.invoke(IPC.FILESYSTEM.SCAN_AUDIO_DIRECTORY, rootPath)
  },
  
  // Path operations - secure path manipulation
  path: {
    join: (...paths) => ipcRenderer.invoke(IPC.PATH_OS.PATH_JOIN, ...paths),
    extname: (filePath) => ipcRenderer.invoke(IPC.PATH_OS.PATH_EXTNAME, filePath),
    dirname: (filePath) => ipcRenderer.invoke(IPC.PATH_OS.PATH_DIRNAME, filePath),
    basename: (filePath, ext) => ipcRenderer.invoke(IPC.PATH_OS.PATH_BASENAME, filePath, ext),
    resolve: (...paths) => ipcRenderer.invoke(IPC.PATH_OS.PATH_RESOLVE, ...paths),
    normalize: (filePath) => ipcRenderer.invoke(IPC.PATH_OS.PATH_NORMALIZE, filePath),
    parse: (filePath) => ipcRenderer.invoke(IPC.PATH_OS.PATH_PARSE, filePath)
  },
  
  // OS operations - secure system information
  os: {
    homedir: () => ipcRenderer.invoke(IPC.PATH_OS.OS_HOMEDIR),
    platform: () => ipcRenderer.invoke(IPC.PATH_OS.OS_PLATFORM),
    arch: () => ipcRenderer.invoke(IPC.PATH_OS.OS_ARCH),
    tmpdir: () => ipcRenderer.invoke(IPC.PATH_OS.OS_TMPDIR)
  },
  
  // Audio operations - secure audio management
  audio: {
    play: (filePath, options) => ipcRenderer.invoke(IPC.AUDIO.PLAY, filePath, options),
    stop: (soundId) => ipcRenderer.invoke(IPC.AUDIO.STOP, soundId),
    pause: (soundId) => ipcRenderer.invoke(IPC.AUDIO.PAUSE, soundId),
    resume: (soundId) => ipcRenderer.invoke(IPC.AUDIO.RESUME, soundId),
    setVolume: (volume, soundId) => ipcRenderer.invoke(IPC.AUDIO.SET_VOLUME, volume, soundId),
    fade: (soundId, fromVolume, toVolume, duration) => ipcRenderer.invoke(IPC.AUDIO.FADE, soundId, fromVolume, toVolume, duration),
    getDuration: (filePath) => ipcRenderer.invoke(IPC.AUDIO.GET_DURATION, filePath),
    getPosition: (soundId) => ipcRenderer.invoke(IPC.AUDIO.GET_POSITION, soundId),
    setPosition: (soundId, position) => ipcRenderer.invoke(IPC.AUDIO.SET_POSITION, soundId, position),
    getMetadata: (filePath) => ipcRenderer.invoke(IPC.AUDIO.GET_METADATA, filePath)
  },
  
  // App operations - secure application control
  app: {
    getPath: (name) => ipcRenderer.invoke(IPC.APP.GET_PATH, name),
    getVersion: () => ipcRenderer.invoke(IPC.APP.GET_VERSION),
    getName: () => ipcRenderer.invoke(IPC.APP.GET_NAME),
    quit: () => ipcRenderer.invoke(IPC.APP.QUIT),
    restart: () => ipcRenderer.invoke(IPC.APP.RESTART),
    showDirectoryPicker: (defaultPath) => ipcRenderer.invoke(IPC.DIALOG.SHOW_DIRECTORY_PICKER, defaultPath),
    showFilePicker: (options) => ipcRenderer.invoke(IPC.DIALOG.SHOW_FILE_PICKER, options)
  },

  // Logs API - centralized logging exposed securely
  logs: {
    write: (level, message, context = null, meta = {}) =>
      ipcRenderer.invoke(IPC.LOGGING.WRITE, {
        level,
        message: truncateString(message),
        context: sanitizeForIPC(context),
        meta: sanitizeForIPC({ process: 'renderer', ...meta })
      }),
    export: (options) => ipcRenderer.invoke(IPC.LOGGING.EXPORT, options),
    getPaths: () => ipcRenderer.invoke(IPC.LOGGING.GET_PATHS)
  },

  // File operations - secure file management
  fileOperations: {
    openHotkeyFile: () => ipcRenderer.invoke(IPC.DIALOG.OPEN_HOTKEY_FILE),
    saveHotkeyFile: (data) => ipcRenderer.invoke(IPC.DIALOG.SAVE_HOTKEY_FILE, data),
    openHoldingTankFile: () => ipcRenderer.invoke(IPC.DIALOG.OPEN_HOLDING_TANK_FILE),
    saveHoldingTankFile: (data) => ipcRenderer.invoke(IPC.DIALOG.SAVE_HOLDING_TANK_FILE, data),
    // Auto-update operations - Three-stage process
    checkForUpdate: () => {
      debugLog.info('🔍 Preload: checkForUpdate called', { 
        module: 'secure-api-exposer', 
        function: 'checkForUpdate' 
      });
      return ipcRenderer.invoke(IPC.APP.CHECK_FOR_UPDATE)
        .then(result => {
          debugLog.info('🔍 Preload: check-for-update result', { 
            module: 'secure-api-exposer', 
            function: 'checkForUpdate',
            result: result 
          });
          return result;
        })
        .catch(error => {
          const errorMessage = error?.message || error?.toString() || 'Unknown error';
          debugLog.error('❌ Preload: check-for-update failed', { 
            module: 'secure-api-exposer', 
            function: 'checkForUpdate',
            error: errorMessage 
          });
          throw error;
        });
    },
    
    downloadUpdate: () => {
      debugLog.info('📥 Preload: downloadUpdate called', { 
        module: 'secure-api-exposer', 
        function: 'downloadUpdate' 
      });
      return ipcRenderer.invoke(IPC.APP.DOWNLOAD_UPDATE)
        .then(result => {
          debugLog.info('📥 Preload: download-update result', { 
            module: 'secure-api-exposer', 
            function: 'downloadUpdate',
            result: result 
          });
          return result;
        })
        .catch(error => {
          const errorMessage = error?.message || error?.toString() || 'Unknown error';
          debugLog.error('❌ Preload: download-update failed', { 
            module: 'secure-api-exposer', 
            function: 'downloadUpdate',
            error: errorMessage 
          });
          throw error;
        });
    },
    
    installUpdate: () => {
      debugLog.info('🚀 Preload: installUpdate called', { 
        module: 'secure-api-exposer', 
        function: 'installUpdate' 
      });
      return ipcRenderer.invoke(IPC.APP.INSTALL_UPDATE)
        .then(result => {
          debugLog.info('🚀 Preload: install-update result', { 
            module: 'secure-api-exposer', 
            function: 'installUpdate',
            result: result 
          });
          return result;
        })
        .catch(error => {
          const errorMessage = error?.message || error?.toString() || 'Unknown error';
          debugLog.error('❌ Preload: install-update failed', { 
            module: 'secure-api-exposer', 
            function: 'installUpdate',
            error: errorMessage 
          });
          throw error;
        });
    },
    importAudioFiles: (filePaths) => ipcRenderer.invoke(IPC.UTILITY.IMPORT_AUDIO_FILES, filePaths),
    exportData: (exportOptions) => ipcRenderer.invoke(IPC.UTILITY.EXPORT_DATA, exportOptions)
  },
  
  // UI operations - secure UI control
  ui: {
    increaseFontSize: () => ipcRenderer.invoke(IPC.UI.INCREASE_FONT_SIZE),
    decreaseFontSize: () => ipcRenderer.invoke(IPC.UI.DECREASE_FONT_SIZE),
    toggleWaveform: () => ipcRenderer.invoke(IPC.UI.TOGGLE_WAVEFORM),
    toggleAdvancedSearch: () => ipcRenderer.invoke(IPC.UI.TOGGLE_ADVANCED_SEARCH),
    closeAllTabs: () => ipcRenderer.invoke(IPC.UI.CLOSE_ALL_TABS),
    showPreferences: () => ipcRenderer.invoke(IPC.UI.SHOW_PREFERENCES),
    manageCategories: () => ipcRenderer.invoke(IPC.UI.MANAGE_CATEGORIES),
    editSelectedSong: () => ipcRenderer.invoke(IPC.DATABASE.EDIT_SELECTED_SONG),
    deleteSelectedSong: () => ipcRenderer.invoke(IPC.DATABASE.DELETE_SELECTED_SONG)
  },
  
  // Event listeners - secure event handling (limited and safe)
  events: {
    onFkeyLoad: (callback) => {
      const handler = (_event, ...args) => callback(...args);
      ipcRenderer.on('fkey_load', handler);
      return () => ipcRenderer.removeListener('fkey_load', handler);
    },
    
    onHoldingTankLoad: (callback) => {
      const handler = (_event, ...args) => callback(...args);
      ipcRenderer.on('holding_tank_load', handler);
      return () => ipcRenderer.removeListener('holding_tank_load', handler);
    },
    
    onBulkAddDialogLoad: (callback) => {
      const handler = (_event, ...args) => callback(...args);
      ipcRenderer.on('bulk_add_dialog_load', handler);
      return () => ipcRenderer.removeListener('bulk_add_dialog_load', handler);
    },
    
    onAddDialogLoad: (callback) => {
      const handler = (_event, filename, metadata) => {
        callback(filename, metadata || null);
      };
      ipcRenderer.on('add_dialog_load', handler);
      return () => ipcRenderer.removeListener('add_dialog_load', handler);
    },
    
    onDisplayReleaseNotes: (callback) => {
      const handler = (_event, ...args) => callback(...args);
      ipcRenderer.on('display_release_notes', handler);
      return () => ipcRenderer.removeListener('display_release_notes', handler);
    },
    
    // Font size events
    onIncreaseFontSize: (callback) => {
      const handler = (_event, ...args) => callback(...args);
      ipcRenderer.on('increase_font_size', handler);
      return () => ipcRenderer.removeListener('increase_font_size', handler);
    },
    onDecreaseFontSize: (callback) => {
      const handler = (_event, ...args) => callback(...args);
      ipcRenderer.on('decrease_font_size', handler);
      return () => ipcRenderer.removeListener('decrease_font_size', handler);
    },

    // UI toggle events
    onToggleWaveform: (callback) => {
      const handler = (_event, ...args) => callback(...args);
      ipcRenderer.on('toggle_wave_form', handler);
      return () => ipcRenderer.removeListener('toggle_wave_form', handler);
    },
    onToggleAdvancedSearch: (callback) => {
      const handler = (_event, ...args) => callback(...args);
      ipcRenderer.on('toggle_advanced_search', handler);
      return () => ipcRenderer.removeListener('toggle_advanced_search', handler);
    },

    // Close all tabs event
    onCloseAllTabs: (callback) => {
      const handler = (_event, ...args) => callback(...args);
      ipcRenderer.on('close_all_tabs', handler);
      return () => ipcRenderer.removeListener('close_all_tabs', handler);
    },
    
    // Additional UI events
    onManageCategories: (callback) => {
      const handler = (_event, ...args) => callback(...args);
      ipcRenderer.on('manage_categories', handler);
      return () => ipcRenderer.removeListener('manage_categories', handler);
    },
    
    onShowPreferences: (callback) => {
      const handler = (_event, ...args) => callback(...args);
      ipcRenderer.on('show_preferences', handler);
      return () => ipcRenderer.removeListener('show_preferences', handler);
    },

    onEditSelectedSong: (callback) => {
      const handler = (_event, ...args) => callback(...args);
      ipcRenderer.on('edit_selected_song', handler);
      return () => ipcRenderer.removeListener('edit_selected_song', handler);
    },

    onDeleteSelectedSong: (callback) => {
      const handler = (_event, ...args) => callback(...args);
      ipcRenderer.on('delete_selected_song', handler);
      return () => ipcRenderer.removeListener('delete_selected_song', handler);
    },
    
    onSwitchProfile: (callback) => {
      const handler = (_event, ...args) => callback(...args);
      ipcRenderer.on('menu:switch-profile', handler);
      return () => ipcRenderer.removeListener('menu:switch-profile', handler);
    },
    
    
    onLogout: (callback) => {
      const handler = (_event, ...args) => callback(...args);
      ipcRenderer.on('menu:logout', handler);
      return () => ipcRenderer.removeListener('menu:logout', handler);
    },
    
    onNewProfile: (callback) => {
      const handler = (_event, ...args) => callback(...args);
      ipcRenderer.on('menu:new-profile', handler);
      return () => ipcRenderer.removeListener('menu:new-profile', handler);
    },
    
    onDeleteCurrentProfile: (callback) => {
      const handler = (_event, ...args) => callback(...args);
      ipcRenderer.on('menu:delete-current-profile', handler);
      return () => ipcRenderer.removeListener('menu:delete-current-profile', handler);
    },
    
    onDuplicateProfile: (callback) => {
      const handler = (_event, ...args) => callback(...args);
      ipcRenderer.on('menu:duplicate-profile', handler);
      return () => ipcRenderer.removeListener('menu:duplicate-profile', handler);
    },
    
    onCreateBackup: (callback) => {
      const handler = (_event, ...args) => callback(...args);
      ipcRenderer.on('menu:create-backup', handler);
      return () => ipcRenderer.removeListener('menu:create-backup', handler);
    },
    
    onRestoreBackup: (callback) => {
      const handler = (_event, ...args) => callback(...args);
      ipcRenderer.on('menu:restore-backup', handler);
      return () => ipcRenderer.removeListener('menu:restore-backup', handler);
    },
    
    onBackupSettings: (callback) => {
      const handler = (_event, ...args) => callback(...args);
      ipcRenderer.on('menu:backup-settings', handler);
      return () => ipcRenderer.removeListener('menu:backup-settings', handler);
    },

    onExportLibrary: (callback) => {
      const handler = (_event, ...args) => callback(...args);
      ipcRenderer.on('menu:export-library', handler);
      return () => ipcRenderer.removeListener('menu:export-library', handler);
    },

    onImportLibrary: (callback) => {
      const handler = (_event, ...args) => callback(...args);
      ipcRenderer.on('menu:import-library', handler);
      return () => ipcRenderer.removeListener('menu:import-library', handler);
    },

    onWhatsNew: (callback) => {
      const handler = (_event, ...args) => callback(...args);
      ipcRenderer.on('menu:whats-new', handler);
      return () => ipcRenderer.removeListener('menu:whats-new', handler);
    },

    onExternalFilesDrop: (callback) => {
      const handler = (_event, files) => callback(files);
      ipcRenderer.on('external-files-dropped', handler);
      return () => ipcRenderer.removeListener('external-files-dropped', handler);
    },

    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
  },
  
  // Profile functions
  profile: {
    getCurrent: () => ipcRenderer.invoke(IPC.PROFILE.GET_CURRENT),
    getDirectory: (type) => ipcRenderer.invoke(IPC.PROFILE.GET_DIRECTORY, type),
    switchProfile: () => ipcRenderer.invoke(IPC.PROFILE.SWITCH),
    switchToProfile: (name) => ipcRenderer.invoke(IPC.PROFILE.SWITCH_TO, name),
    saveState: (state, profileName) => ipcRenderer.invoke(IPC.PROFILE.SAVE_STATE, state, profileName),
    loadState: () => ipcRenderer.invoke(IPC.PROFILE.LOAD_STATE),
    saveStateBeforeSwitch: (state, profileName) => ipcRenderer.invoke(IPC.PROFILE.SAVE_STATE_BEFORE_SWITCH, state, profileName),
    getPreference: (key) => ipcRenderer.invoke(IPC.PROFILE.GET_PREFERENCE, key),
    setPreference: (key, value) => ipcRenderer.invoke(IPC.PROFILE.SET_PREFERENCE, key, value),
    setPreferences: (preferencesObject) => ipcRenderer.invoke(IPC.PROFILE.SET_PREFERENCES, preferencesObject),
    getAllPreferences: () => ipcRenderer.invoke(IPC.PROFILE.GET_ALL_PREFERENCES),
    createProfile: (name, description) => ipcRenderer.invoke(IPC.PROFILE.CREATE, name, description),
    duplicateProfile: (sourceName, targetName, description) => ipcRenderer.invoke(IPC.PROFILE.DUPLICATE, sourceName, targetName, description),
    deleteProfile: (name) => ipcRenderer.invoke(IPC.PROFILE.DELETE, name),
    // Backup functions
    createBackup: () => ipcRenderer.invoke(IPC.PROFILE_BACKUP.CREATE),
    listBackups: () => ipcRenderer.invoke(IPC.PROFILE_BACKUP.LIST),
    getBackupMetadata: () => ipcRenderer.invoke(IPC.PROFILE_BACKUP.GET_METADATA),
    restoreBackup: (backupId) => ipcRenderer.invoke(IPC.PROFILE_BACKUP.RESTORE, backupId),
    deleteBackup: (backupId) => ipcRenderer.invoke(IPC.PROFILE_BACKUP.DELETE, backupId),
    getBackupSettings: () => ipcRenderer.invoke(IPC.PROFILE_BACKUP.GET_SETTINGS),
    saveBackupSettings: (settings) => ipcRenderer.invoke(IPC.PROFILE_BACKUP.SAVE_SETTINGS, settings)
  },

  // Library transfer functions
  library: {
    exportLibrary: () => ipcRenderer.invoke(IPC.LIBRARY.EXPORT),
    importLibrary: () => ipcRenderer.invoke(IPC.LIBRARY.IMPORT),
    confirmImport: (archivePath) => ipcRenderer.invoke(IPC.LIBRARY.IMPORT_CONFIRM, archivePath),
    onExportProgress: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on('library:export-progress', handler);
      return () => ipcRenderer.removeListener('library:export-progress', handler);
    },
    onImportProgress: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on('library:import-progress', handler);
      return () => ipcRenderer.removeListener('library:import-progress', handler);
    }
  },

  // Utility functions
  utils: {
    generateId: () => ipcRenderer.invoke(IPC.UTILITY.GENERATE_ID),
    formatDuration: (seconds) => ipcRenderer.invoke(IPC.UTILITY.FORMAT_DURATION, seconds),
    validateAudioFile: (filePath) => ipcRenderer.invoke(IPC.UTILITY.VALIDATE_AUDIO_FILE, filePath),
    sanitizeFilename: (filename) => ipcRenderer.invoke(IPC.UTILITY.SANITIZE_FILENAME, filename),
    getPathForFile: (file) => webUtils.getPathForFile(file)
  },
  
  // Analytics
  analytics: {
    trackEvent: (name, properties) => ipcRenderer.invoke(IPC.ANALYTICS.TRACK_EVENT, name, properties),
    getOptOutStatus: () => ipcRenderer.invoke(IPC.ANALYTICS.GET_OPT_OUT_STATUS),
    setOptOut: (value) => ipcRenderer.invoke(IPC.ANALYTICS.SET_OPT_OUT, value),
  },

  // Testing and debugging functions
  testing: {
    testModularPreload: () => {
      debugLog.info('🧪 Testing Modular Preload via secure API...');
      return { success: true, message: 'Secure API test function called successfully' };
    }
  }
};

// Function to expose secure API
function exposeSecureAPI(injectedDebugLog) {
  debugLog = injectedDebugLog;
  try {
    // Check if context isolation is enabled
    if (typeof contextBridge !== 'undefined') {
      // Expose the secure API via contextBridge
      contextBridge.exposeInMainWorld('secureElectronAPI', secureElectronAPI);
      
      
      // Also expose a legacy compatibility layer for existing code
      contextBridge.exposeInMainWorld('electronAPI', {
        // Legacy API compatibility
        openHotkeyFile: secureElectronAPI.fileOperations.openHotkeyFile,
        saveHotkeyFile: secureElectronAPI.fileOperations.saveHotkeyFile,
        openHoldingTankFile: secureElectronAPI.fileOperations.openHoldingTankFile,
        saveHoldingTankFile: secureElectronAPI.fileOperations.saveHoldingTankFile,
        getAppPath: secureElectronAPI.app.getPath,
        showDirectoryPicker: secureElectronAPI.app.showDirectoryPicker,
        restartAndInstall: () => ipcRenderer.invoke(IPC.APP.RESTART_AND_INSTALL),
        increaseFontSize: secureElectronAPI.ui.increaseFontSize,
        decreaseFontSize: secureElectronAPI.ui.decreaseFontSize,
        toggleWaveform: secureElectronAPI.ui.toggleWaveform,
        toggleAdvancedSearch: secureElectronAPI.ui.toggleAdvancedSearch,
        closeAllTabs: secureElectronAPI.ui.closeAllTabs,
        deleteSelectedSong: () => ipcRenderer.invoke(IPC.DATABASE.DELETE_SELECTED_SONG),
        editSelectedSong: () => ipcRenderer.invoke(IPC.DATABASE.EDIT_SELECTED_SONG),
        manageCategories: secureElectronAPI.ui.manageCategories,
        showPreferences: secureElectronAPI.ui.showPreferences,
        onFkeyLoad: secureElectronAPI.events.onFkeyLoad,
        onHoldingTankLoad: secureElectronAPI.events.onHoldingTankLoad,
        onBulkAddDialogLoad: secureElectronAPI.events.onBulkAddDialogLoad,
        onAddDialogLoad: secureElectronAPI.events.onAddDialogLoad,
        onDisplayReleaseNotes: secureElectronAPI.events.onDisplayReleaseNotes,
        onSwitchProfile: secureElectronAPI.events.onSwitchProfile,
        removeAllListeners: secureElectronAPI.events.removeAllListeners,
        database: secureElectronAPI.database,
        fileSystem: secureElectronAPI.fileSystem,
        path: secureElectronAPI.path,
        store: secureElectronAPI.store,
        audio: secureElectronAPI.audio,
        os: secureElectronAPI.os,
        utils: secureElectronAPI.utils,
        testing: secureElectronAPI.testing,
        profile: secureElectronAPI.profile,
        library: secureElectronAPI.library,
        // Provide logs under legacy namespace for compatibility with existing renderer code
        logs: secureElectronAPI.logs,
        analytics: secureElectronAPI.analytics
      });
      
      if (debugLog && typeof debugLog.info === 'function') {
        debugLog.info('✅ Secure API exposed via contextBridge (context isolation enabled)');
        debugLog.info('✅ Legacy API compatibility layer exposed');
      }
      return true;
    } else {
      if (debugLog && typeof debugLog.warn === 'function') {
        debugLog.warn('❌ Context isolation disabled - secure API not exposed');
      }
      return false;
    }
  } catch (error) {
    const errorMessage = error && error.message ? error.message : 'Unknown error';
    if (debugLog && typeof debugLog.error === 'function') {
      debugLog.error('❌ Failed to expose secure API:', errorMessage);
    } else {
      debugLog.error('❌ Failed to expose secure API', { 
        module: 'secure-api-exposer', 
        function: 'exposeSecureAPI',
        error: errorMessage 
      });
    }
    return false;
  }
}

// Note: Secure API exposure is now handled by the calling module
// to avoid duplicate exposure conflicts

module.exports = {
  secureElectronAPI,
  exposeSecureAPI
};
