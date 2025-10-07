/**
 * Secure API Exposer Module
 * 
 * Provides secure API exposure using contextBridge for modern Electron security.
 * This module will work with context isolation enabled and provides a secure
 * alternative to direct Node.js API exposure.
 */

import { contextBridge, ipcRenderer } from 'electron';

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
  } catch (e) {
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
    query: (sql, params) => ipcRenderer.invoke('database-query', sql, params),
    execute: (sql, params) => ipcRenderer.invoke('database-execute', sql, params),
    getCategories: () => ipcRenderer.invoke('get-categories'),
    getAllSongs: () => ipcRenderer.invoke('database-query', 'SELECT * FROM mrvoice ORDER BY category, info, title, artist', []),
    addSong: (songData) => ipcRenderer.invoke('add-song', songData),
    getSongById: (songId) => ipcRenderer.invoke('get-song-by-id', songId),
    deleteSong: (songId) => ipcRenderer.invoke('delete-song', songId),
    updateSong: (songData) => ipcRenderer.invoke('update-song', songData),
    addCategory: (categoryData) => ipcRenderer.invoke('add-category', categoryData),
    updateCategory: (code, description) => ipcRenderer.invoke('update-category', code, description),
    deleteCategory: (code, description) => ipcRenderer.invoke('delete-category', code, description)
  },
  
  // Store operations - secure preference management
  store: {
    get: (key) => ipcRenderer.invoke('store-get', key),
    set: (key, value) => ipcRenderer.invoke('store-set', key, value),
    delete: (key) => ipcRenderer.invoke('store-delete', key),
    has: (key) => ipcRenderer.invoke('store-has', key),
    keys: () => ipcRenderer.invoke('store-keys'),
    clear: () => ipcRenderer.invoke('store-clear')
  },
  
  // File system operations - secure file access with validation
  fileSystem: {
    read: (filePath) => ipcRenderer.invoke('file-read', filePath),
    write: (filePath, data) => ipcRenderer.invoke('file-write', filePath, data),
    exists: (filePath) => ipcRenderer.invoke('file-exists', filePath),
    delete: (filePath) => ipcRenderer.invoke('file-delete', filePath),
    copy: (sourcePath, destPath) => ipcRenderer.invoke('file-copy', sourcePath, destPath),
    mkdir: (dirPath, options) => ipcRenderer.invoke('file-mkdir', dirPath, options),
    readdir: (dirPath) => ipcRenderer.invoke('fs-readdir', dirPath),
    stat: (filePath) => ipcRenderer.invoke('fs-stat', filePath)
  },
  
  // Path operations - secure path manipulation
  path: {
    join: (...paths) => ipcRenderer.invoke('path-join', ...paths),
    extname: (filePath) => ipcRenderer.invoke('path-extname', filePath),
    dirname: (filePath) => ipcRenderer.invoke('path-dirname', filePath),
    basename: (filePath, ext) => ipcRenderer.invoke('path-basename', filePath, ext),
    resolve: (...paths) => ipcRenderer.invoke('path-resolve', ...paths),
    normalize: (filePath) => ipcRenderer.invoke('path-normalize', filePath),
    parse: (filePath) => ipcRenderer.invoke('path-parse', filePath)
  },
  
  // OS operations - secure system information
  os: {
    homedir: () => ipcRenderer.invoke('os-homedir'),
    platform: () => ipcRenderer.invoke('os-platform'),
    arch: () => ipcRenderer.invoke('os-arch'),
    tmpdir: () => ipcRenderer.invoke('os-tmpdir')
  },
  
  // Audio operations - secure audio management
  audio: {
    play: (filePath, options) => ipcRenderer.invoke('audio-play', filePath, options),
    stop: (soundId) => ipcRenderer.invoke('audio-stop', soundId),
    pause: (soundId) => ipcRenderer.invoke('audio-pause', soundId),
    resume: (soundId) => ipcRenderer.invoke('audio-resume', soundId),
    setVolume: (volume, soundId) => ipcRenderer.invoke('audio-set-volume', volume, soundId),
    fade: (soundId, fromVolume, toVolume, duration) => ipcRenderer.invoke('audio-fade', soundId, fromVolume, toVolume, duration),
    getDuration: (filePath) => ipcRenderer.invoke('audio-get-duration', filePath),
    getPosition: (soundId) => ipcRenderer.invoke('audio-get-position', soundId),
    setPosition: (soundId, position) => ipcRenderer.invoke('audio-set-position', soundId, position),
    getMetadata: (filePath) => ipcRenderer.invoke('audio-get-metadata', filePath)
  },
  
  // App operations - secure application control
  app: {
    getPath: (name) => ipcRenderer.invoke('app-get-path', name),
    getVersion: () => ipcRenderer.invoke('app-get-version'),
    getName: () => ipcRenderer.invoke('app-get-name'),
    quit: () => ipcRenderer.invoke('app-quit'),
    restart: () => ipcRenderer.invoke('app-restart'),
    showDirectoryPicker: (defaultPath) => ipcRenderer.invoke('show-directory-picker', defaultPath),
    showFilePicker: (options) => ipcRenderer.invoke('show-file-picker', options)
  },

  // Logs API - centralized logging exposed securely
  logs: {
    write: (level, message, context = null, meta = {}) =>
      ipcRenderer.invoke('logs:write', {
        level,
        message: truncateString(message),
        context: sanitizeForIPC(context),
        meta: sanitizeForIPC({ process: 'renderer', ...meta })
      }),
    export: (options) => ipcRenderer.invoke('logs:export', options),
    getPaths: () => ipcRenderer.invoke('logs:get-paths')
  },

  // File operations - secure file management
  fileOperations: {
    openHotkeyFile: () => ipcRenderer.invoke('open-hotkey-file'),
    saveHotkeyFile: (data) => ipcRenderer.invoke('save-hotkey-file', data),
    openHoldingTankFile: () => ipcRenderer.invoke('open-holding-tank-file'),
    saveHoldingTankFile: (data) => ipcRenderer.invoke('save-holding-tank-file', data),
    pickDirectory: (defaultPath) => ipcRenderer.invoke('pick-directory', defaultPath),
    // Auto-update operations - Three-stage process
    checkForUpdate: () => {
      debugLog.info('🔍 Preload: checkForUpdate called', { 
        module: 'secure-api-exposer', 
        function: 'checkForUpdate' 
      });
      return ipcRenderer.invoke('check-for-update')
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
      return ipcRenderer.invoke('download-update')
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
      return ipcRenderer.invoke('install-update')
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
    importAudioFiles: (filePaths) => ipcRenderer.invoke('import-audio-files', filePaths),
    exportData: (exportOptions) => ipcRenderer.invoke('export-data', exportOptions)
  },
  
  // UI operations - secure UI control
  ui: {
    increaseFontSize: () => ipcRenderer.invoke('increase-font-size'),
    decreaseFontSize: () => ipcRenderer.invoke('decrease-font-size'),
    toggleWaveform: () => ipcRenderer.invoke('toggle-waveform'),
    toggleAdvancedSearch: () => ipcRenderer.invoke('toggle-advanced-search'),
    closeAllTabs: () => ipcRenderer.invoke('close-all-tabs'),
    showPreferences: () => ipcRenderer.invoke('show-preferences'),
    manageCategories: () => ipcRenderer.invoke('manage-categories'),
    editSelectedSong: () => ipcRenderer.invoke('edit-selected-song'),
    deleteSelectedSong: () => ipcRenderer.invoke('delete-selected-song')
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
      const handler = async (_event, filename) => {
        try {
          const mm = await import('music-metadata');
          const metadata = await mm.parseFile(filename);
          callback(filename, metadata);
        } catch (err) {
          // Fallback: provide filename without metadata
          if (debugLog && typeof debugLog.warn === 'function') {
            debugLog.warn('Failed to parse metadata for file', { module: 'secure-api-exposer', function: 'onAddDialogLoad', error: err?.message, filename });
          }
          callback(filename);
        }
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
    
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
  },
  
  // Profile functions
  profile: {
    getCurrent: () => ipcRenderer.invoke('profile:get-current'),
    getDirectory: (type) => ipcRenderer.invoke('profile:get-directory', type),
    switchProfile: () => ipcRenderer.invoke('profile:switch'),
    switchToProfile: (name) => ipcRenderer.invoke('profile:switch-to', name),
    saveState: (state) => ipcRenderer.invoke('profile:save-state', state),
    saveStateBeforeSwitch: (state) => ipcRenderer.invoke('profile:save-state-before-switch', state),
    getPreference: (key) => ipcRenderer.invoke('profile:get-preference', key),
    setPreference: (key, value) => ipcRenderer.invoke('profile:set-preference', key, value),
    getAllPreferences: () => ipcRenderer.invoke('profile:get-all-preferences'),
    createProfile: (name, description) => ipcRenderer.invoke('profile:create', name, description),
    deleteProfile: (name) => ipcRenderer.invoke('profile:delete', name)
  },
  
  // Utility functions
  utils: {
    generateId: () => ipcRenderer.invoke('generate-id'),
    formatDuration: (seconds) => ipcRenderer.invoke('format-duration', seconds),
    validateAudioFile: (filePath) => ipcRenderer.invoke('validate-audio-file', filePath),
    sanitizeFilename: (filename) => ipcRenderer.invoke('sanitize-filename', filename)
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
        restartAndInstall: () => ipcRenderer.invoke('restart-and-install-new-version'),
        increaseFontSize: secureElectronAPI.ui.increaseFontSize,
        decreaseFontSize: secureElectronAPI.ui.decreaseFontSize,
        toggleWaveform: secureElectronAPI.ui.toggleWaveform,
        toggleAdvancedSearch: secureElectronAPI.ui.toggleAdvancedSearch,
        closeAllTabs: secureElectronAPI.ui.closeAllTabs,
        deleteSelectedSong: () => ipcRenderer.invoke('delete-selected-song'),
        editSelectedSong: () => ipcRenderer.invoke('edit-selected-song'),
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
        // Provide logs under legacy namespace for compatibility with existing renderer code
        logs: secureElectronAPI.logs
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

export {
  secureElectronAPI,
  exposeSecureAPI
};
