/**
 * File Operations Module
 * 
 * Handles file system operations for the MxVoice Electron application.
 */

import electron from 'electron';

// Destructure from electron (handles both named and default exports)
const { dialog, app } = electron;
import fs from 'fs';
import path from 'path';
import readlines from 'n-readlines';

// Dependencies that will be injected
let mainWindow;
let store;
let debugLog;

// Initialize the module with dependencies
function initializeFileOperations(dependencies) {
  mainWindow = dependencies.mainWindow;
  store = dependencies.store;
  debugLog = dependencies.debugLog;
  
  debugLog?.info('🔍 Initializing file operations with dependencies:', { 
    module: 'file-operations', 
    function: 'initializeFileOperations', 
    mainWindowSet: !!dependencies.mainWindow,
    storeSet: !!dependencies.store,
    autoUpdaterSet: !!dependencies.autoUpdater,
    debugLogSet: !!dependencies.debugLog
  });
}

// Load hotkeys file
function loadHotkeysFile() {
  if (!mainWindow) {
    debugLog?.error('❌ mainWindow is not available', { module: 'file-operations', function: 'loadHotkeysFile' });
    return Promise.reject(new Error('mainWindow not available'));
  }
  
  return new Promise((resolve, reject) => {
    const fkey_mapping = {};
    debugLog?.info("Loading hotkeys file", { module: 'file-operations', function: 'loadHotkeysFile' });
    dialog.showOpenDialog(mainWindow, {
      buttonLabel: 'Open',
      filters: [
        { name: 'Mx. Voice Hotkey Files', extensions: ['mrv'] }
      ],
      defaultPath: store.get('hotkey_directory'),
      message: 'Select your Mx. Voice hotkey file',
      properties: ['openFile']
    }).then(result => {
      if (result.canceled == true) {
        debugLog?.info('Silently exiting hotkey load', { module: 'file-operations', function: 'loadHotkeysFile' });
        resolve({ success: false, canceled: true });
        return;
      }
      else {
        const filename = result.filePaths[0];
        debugLog?.info(`Processing file ${filename}`, { module: 'file-operations', function: 'loadHotkeysFile', filename: filename });
        const line_reader = new readlines(filename);
        let title;

        let line;
         
        while ((line = line_reader.next())) {
          const lineStr = line.toString().trim();
          debugLog?.info('📁 Reading line:', { module: 'file-operations', function: 'loadHotkeysFile', line: lineStr });
          let [key, val] = lineStr.split('::');
          debugLog?.info('📁 Parsed key:', { module: 'file-operations', function: 'loadHotkeysFile', key: key, value: val });
          if (/^\D\d+$/.test(key)) {
            fkey_mapping[key] = val;
            debugLog?.info('📁 Added to fkey_mapping:', { module: 'file-operations', function: 'loadHotkeysFile', key: key, value: val });
          } else {
            title = val.replace('_', ' ')
            debugLog?.info('📁 Set title to:', { module: 'file-operations', function: 'loadHotkeysFile', title: title });
          }
        }
        debugLog?.info('📁 Main process: Sending fkey_load with:', { module: 'file-operations', function: 'loadHotkeysFile', fkey_mapping: fkey_mapping, title: title });
        debugLog?.info('📁 fkey_mapping type:', { module: 'file-operations', function: 'loadHotkeysFile', type: typeof fkey_mapping });
        debugLog?.info('📁 fkey_mapping keys:', { module: 'file-operations', function: 'loadHotkeysFile', keys: Object.keys(fkey_mapping) });
        debugLog?.info('📁 fkey_mapping length:', { module: 'file-operations', function: 'loadHotkeysFile', length: fkey_mapping.length });
        debugLog?.info('📁 fkey_mapping content:', { module: 'file-operations', function: 'loadHotkeysFile', content: JSON.stringify(fkey_mapping) });
        mainWindow.webContents.send('fkey_load', fkey_mapping, title);
        resolve({ success: true, fkey_mapping, title });
      }
    }).catch(err => {
      debugLog?.error('Error loading hotkeys file:', { module: 'file-operations', function: 'loadHotkeysFile', error: err });
      reject(err);
    });
  });
}

// Load holding tank file
function loadHoldingTankFile() {
  if (!mainWindow) {
    debugLog?.error('❌ mainWindow is not available', { module: 'file-operations', function: 'loadHoldingTankFile' });
    return Promise.reject(new Error('mainWindow not available'));
  }
  
  return new Promise((resolve, reject) => {
    const song_ids = [];
    debugLog?.info("Loading holding tank file", { module: 'file-operations', function: 'loadHoldingTankFile' });
    dialog.showOpenDialog(mainWindow, {
      buttonLabel: 'Open',
      filters: [
        { name: 'Mx. Voice Holding Tank Files', extensions: ['hld'] }
      ],
      defaultPath: store.get('hotkey_directory'),
      message: 'Select your Mx. Voice holding tank file',
      properties: ['openFile']
    }).then(result => {
      if (result.canceled == true) {
        debugLog?.info('Silently exiting holding tank load', { module: 'file-operations', function: 'loadHoldingTankFile' });
        resolve({ success: false, canceled: true });
        return;
      }
      else {
        const filename = result.filePaths[0];
        debugLog?.info(`Processing file ${filename}`, { module: 'file-operations', function: 'loadHoldingTankFile', filename: filename });
        const line_reader = new readlines(filename);

        let line;
         
        while ((line = line_reader.next())) {
          song_ids.push(line.toString().trim());
        }
        debugLog?.info('📁 Main process: Sending holding_tank_load with:', { module: 'file-operations', function: 'loadHoldingTankFile', song_ids: song_ids });
        mainWindow.webContents.send('holding_tank_load', song_ids);
        resolve({ success: true, song_ids });
      }
    }).catch(err => {
      debugLog?.error('Error loading holding tank file:', { module: 'file-operations', function: 'loadHoldingTankFile', error: err });
      reject(err);
    });
  });
}

// Save hotkeys file
function saveHotkeysFile(hotkeyArray) {
  dialog.showSaveDialog(mainWindow, {
    buttonLabel: 'Save',
    filters: [
      { name: 'Mx. Voice Hotkey Files', extensions: ['mrv'] }
    ],
    defaultPath: store.get('hotkey_directory'),
    message: 'Save your Mx. Voice hotkey file'
  }).then(result => {
    if (result.canceled == true) {
      debugLog?.info('Silently exiting hotkey save', { module: 'file-operations', function: 'saveHotkeysFile' });
      return;
    }
    else {
      const filename = result.filePath;
      debugLog?.info(`Processing file ${filename}`, { module: 'file-operations', function: 'saveHotkeysFile', filename: filename });
      debugLog?.info(`Hotkey array received:`, { module: 'file-operations', function: 'saveHotkeysFile', hotkeyArray: hotkeyArray });
      
      const file = fs.createWriteStream(filename);
      
      // Process the first 12 elements as hotkeys (f1 through f12)
      for (let i = 0; i < 12; i++) {
        const keyId = `f${i + 1}`;
        const hotkeyValue = hotkeyArray[i];
        
        debugLog?.info(`Processing hotkey ${keyId}:`, { 
          module: 'file-operations', 
          function: 'saveHotkeysFile', 
          index: i, 
          value: hotkeyValue,
          type: typeof hotkeyValue
        });
        
        // Handle null, undefined, or empty values as empty hotkeys
        if (hotkeyValue === null || hotkeyValue === undefined || hotkeyValue === '') {
          file.write(`${keyId}::\n`);
        } else if (/^\d+$/.test(hotkeyValue)) {
          // Valid song ID
          file.write(`${keyId}::${hotkeyValue}\n`);
        } else {
          // Invalid value - treat as empty
          debugLog?.warn(`Invalid hotkey value for ${keyId}:`, { 
            module: 'file-operations', 
            function: 'saveHotkeysFile', 
            value: hotkeyValue 
          });
          file.write(`${keyId}::\n`);
        }
      }
      
      // Process the 13th element as tab name if it exists
      if (hotkeyArray.length > 12 && hotkeyArray[12]) {
        const tabName = hotkeyArray[12];
        if (typeof tabName === 'string' && tabName.trim()) {
          file.write(`tab_name::${tabName.replace(/ /g, '_')}\n`);
        }
      }
      
      file.end();
      
      debugLog?.info(`Hotkey file saved successfully to ${filename}`, { 
        module: 'file-operations', 
        function: 'saveHotkeysFile', 
        filename: filename,
        totalHotkeys: 12,
        tabNameIncluded: hotkeyArray.length > 12 && !!hotkeyArray[12]
      });
    }
  }).catch(err => {
    debugLog?.error('Error saving hotkeys file:', { module: 'file-operations', function: 'saveHotkeysFile', error: err });
  })
}

// Save holding tank file
function saveHoldingTankFile(holdingTankArray) {
  dialog.showSaveDialog(mainWindow, {
    buttonLabel: 'Save',
    filters: [
      { name: 'Mx. Voice Holding Tank Files', extensions: ['hld'] }
    ],
    defaultPath: store.get('hotkey_directory'),
    message: 'Save your Mx. Voice holding tank file'
  }).then(result => {
    if (result.canceled == true) {
      debugLog?.info('Silently exiting holding tank save', { module: 'file-operations', function: 'saveHoldingTankFile' });
      return;
    }
    else {
      const filename = result.filePath;
      debugLog?.info(`Processing file ${filename}`, { module: 'file-operations', function: 'saveHoldingTankFile', filename: filename });
      const file = fs.createWriteStream(filename);
      for (let i = 0; i < holdingTankArray.length; i++) {
        file.write(holdingTankArray[i] + '\n');
      }
      file.end();
    }
  }).catch(err => {
    debugLog?.error('Error saving holding tank file:', { module: 'file-operations', function: 'saveHoldingTankFile', error: err });
  })
}

// Add directory dialog
function addDirectoryDialog() {
  debugLog?.info("Adding directory of songs", { module: 'file-operations', function: 'addDirectoryDialog' });
  dialog.showOpenDialog(mainWindow, {
    buttonLabel: 'Add All',
    message: 'Choose directory of music to add',
    properties: ['openDirectory']
  }).then(result => {
    if (result.canceled == true) {
      debugLog?.info('Silently exiting add file', { module: 'file-operations', function: 'addDirectoryDialog' });
      return;
    } else {
      const dirname = result.filePaths[0];
      debugLog?.info(`Processing directory ${dirname}`, { module: 'file-operations', function: 'addDirectoryDialog', dirname: dirname });
      mainWindow.webContents.send('bulk_add_dialog_load', dirname);
    }
  }).catch(err => {
    debugLog?.error('Error adding directory:', { module: 'file-operations', function: 'addDirectoryDialog', error: err });
  })
}

// Add file dialog
function addFileDialog() {
  debugLog?.info("Adding new file", { module: 'file-operations', function: 'addFileDialog' });
  dialog.showOpenDialog(mainWindow, {
    buttonLabel: 'Add',
    filters: [
      { name: 'Audio Files', extensions: ['mp3', 'mp4', 'm4a', 'wav', 'ogg'] }
    ],
    message: 'Choose audio file to add to Mx. Voice',
    properties: ['openFile']
  }).then(result => {
    if (result.canceled == true) {
      debugLog?.info('Silently exiting add file', { module: 'file-operations', function: 'addFileDialog' });
      return;
    }
    else {
      const filename = result.filePaths[0];
      debugLog?.info(`Processing file ${filename}`, { module: 'file-operations', function: 'addFileDialog', filename: filename });
      mainWindow.webContents.send('add_dialog_load', filename);
    }
  }).catch(err => {
    debugLog?.error('Error adding file:', { module: 'file-operations', function: 'addFileDialog', error: err });
  })
}

// Migrate old preferences
function migrateOldPreferences() {
  const old_prefs_path = path.resolve(app.getPath('userData'), 'preferences.json');
  if (fs.existsSync(old_prefs_path)) {
    // There is an old preferences file we need to migrate
    debugLog?.info('Migrating old preferences.json to new config.json file', { module: 'file-operations', function: 'migrateOldPreferences' });
    let rawdata = fs.readFileSync(old_prefs_path);
    let old_prefs = JSON.parse(rawdata);
    store.set('music_directory', old_prefs.locations.music_directory);
    store.set('hotkey_directory', old_prefs.locations.hotkey_directory);
    store.set('database_directory', old_prefs.locations.database_directory);
    store.set('browser_width', (old_prefs?.config?.browser_width || 1280));
    store.set('browser_height', (old_prefs?.config?.browser_height || 1024));
    store.set('fade_out_seconds', (old_prefs?.audio?.fade_out_seconds || 3));
    store.set('first_run_completed', (old_prefs?.system?.first_run_completed || true));

    fs.renameSync(old_prefs_path, `${old_prefs_path}.migrated`);
  }
}

// Test function
function testFileOperations() {
  debugLog?.info('Testing File Operations...', { module: 'file-operations', function: 'testFileOperations' });
  debugLog?.info('✅ File operations module loaded', { module: 'file-operations', function: 'testFileOperations' });
  return true;
}

export {
  initializeFileOperations,
  loadHotkeysFile,
  loadHoldingTankFile,
  saveHotkeysFile,
  saveHoldingTankFile,
  addDirectoryDialog,
  addFileDialog,
  migrateOldPreferences,
  testFileOperations
};

// Default export for module loading
export default {
  initializeFileOperations,
  loadHotkeysFile,
  loadHoldingTankFile,
  saveHotkeysFile,
  saveHoldingTankFile,
  addDirectoryDialog,
  addFileDialog,
  migrateOldPreferences,
  testFileOperations
}; 