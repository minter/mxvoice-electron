// API Exposer Module
// Handles the context bridge and API exposure

const { ipcRenderer } = require('electron');

// Modern API structure - extracted from preload.js
const electronAPI = {
  // File operations
  openHotkeyFile: () => ipcRenderer.invoke('open-hotkey-file'),
  saveHotkeyFile: (hotkeyArray) => ipcRenderer.invoke('save-hotkey-file', hotkeyArray),
  openHoldingTankFile: () => ipcRenderer.invoke('open-holding-tank-file'),
  saveHoldingTankFile: (holdingTankArray) => ipcRenderer.invoke('save-holding-tank-file', holdingTankArray),
  
  // App operations
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  showDirectoryPicker: (defaultPath) => ipcRenderer.invoke('show-directory-picker', defaultPath),
  restartAndInstall: () => ipcRenderer.invoke('restart-and-install-new-version'),
  
  // UI operations
  increaseFontSize: () => ipcRenderer.invoke('increase-font-size'),
  decreaseFontSize: () => ipcRenderer.invoke('decrease-font-size'),
  toggleWaveform: () => ipcRenderer.invoke('toggle-waveform'),
  toggleAdvancedSearch: () => ipcRenderer.invoke('toggle-advanced-search'),
  closeAllTabs: () => ipcRenderer.invoke('close-all-tabs'),
  
  // Song operations
  deleteSelectedSong: () => ipcRenderer.invoke('delete-selected-song'),
  editSelectedSong: () => ipcRenderer.invoke('edit-selected-song'),
  
  // Category operations
  manageCategories: () => ipcRenderer.invoke('manage-categories'),
  
  // Preferences
  showPreferences: () => ipcRenderer.invoke('show-preferences'),
  
  // Listeners
  onFkeyLoad: (callback) => ipcRenderer.on('fkey_load', callback),
  onHoldingTankLoad: (callback) => ipcRenderer.on('holding_tank_load', callback),
  onBulkAddDialogLoad: (callback) => ipcRenderer.on('bulk_add_dialog_load', callback),
  onAddDialogLoad: (callback) => ipcRenderer.on('add_dialog_load', callback),
  onDisplayReleaseNotes: (callback) => ipcRenderer.on('display_release_notes', callback),
  
  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  
  // Database operations (new API for gradual migration)
  database: {
    query: (sql, params) => ipcRenderer.invoke('database-query', sql, params),
    execute: (sql, params) => ipcRenderer.invoke('database-execute', sql, params),
    getCategories: () => ipcRenderer.invoke('get-categories'),
    addSong: (songData) => ipcRenderer.invoke('add-song', songData)
  },
  
  // File system operations (new API for gradual migration)
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
  
  // Path operations (new API for gradual migration)
  path: {
    join: (...paths) => ipcRenderer.invoke('path-join', ...paths),
    parse: (filePath) => ipcRenderer.invoke('path-parse', filePath),
    extname: (filePath) => ipcRenderer.invoke('path-extname', filePath)
  },
  
  // Store operations (new API for gradual migration)
  store: {
    get: (key) => ipcRenderer.invoke('store-get', key),
    set: (key, value) => ipcRenderer.invoke('store-set', key, value),
    delete: (key) => ipcRenderer.invoke('store-delete', key),
    has: (key) => ipcRenderer.invoke('store-has', key),
    keys: () => ipcRenderer.invoke('store-keys')
  },
  
  // Audio operations (new API for gradual migration)
  audio: {
    play: (filePath) => ipcRenderer.invoke('audio-play', filePath),
    stop: (soundId) => ipcRenderer.invoke('audio-stop', soundId),
    pause: (soundId) => ipcRenderer.invoke('audio-pause', soundId),
    setVolume: (volume) => ipcRenderer.invoke('audio-volume', volume),
    fade: (soundId, fromVolume, toVolume, duration) => ipcRenderer.invoke('audio-fade', soundId, fromVolume, toVolume, duration)
  }
};

// Legacy global exposure (backward compatibility)
let legacyGlobals = {
  homedir: require('os').homedir(),
  path: require('path'),
  store: require('electron-store'),
  Mousetrap: require('mousetrap'),
  ipcRenderer: ipcRenderer,
  uuidv4: require('uuid').v4,
  util: require('util'),
  fs: require('fs'),
  db: null // Will be set after database initialization
};

// Setup global exposure
function setupGlobalExposure(dbInstance = null) {
  // Update legacy globals with database instance
  if (dbInstance) {
    legacyGlobals.db = dbInstance;
  }
  
  process.once('loaded', () => {
    // Legacy globals
    Object.entries(legacyGlobals).forEach(([key, value]) => {
      global[key] = value;
    });
    
    // Modern API
    global.electronAPI = electronAPI;
    
    console.log('Global exposure setup completed');
  });
}

// Update database instance
function setDatabaseInstance(dbInstance) {
  legacyGlobals.db = dbInstance;
  if (global.db) {
    global.db = dbInstance;
  }
}

// Test function to verify API exposer is working
function testApiExposer() {
  console.log('Testing API Exposer...');
  console.log('ElectronAPI methods:', Object.keys(electronAPI));
  console.log('Legacy globals:', Object.keys(legacyGlobals));
  return true;
}

module.exports = {
  electronAPI,
  legacyGlobals,
  setupGlobalExposure,
  setDatabaseInstance,
  testApiExposer
}; 