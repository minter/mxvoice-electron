/**
 * File Operations Module
 * 
 * Handles file system operations for the MxVoice Electron application.
 */

import { dialog, app } from 'electron';
import fs from 'fs';
import path from 'path';
import readlines from 'n-readlines';

// Dependencies that will be injected
let mainWindow;
let store;

// Initialize the module with dependencies
function initializeFileOperations(dependencies) {
  console.log('🔍 Initializing file operations with dependencies:', dependencies);
  mainWindow = dependencies.mainWindow;
  store = dependencies.store;
  console.log('🔍 mainWindow set:', !!mainWindow);
  console.log('🔍 store set:', !!store);
}

// Load hotkeys file
function loadHotkeysFile() {
  if (!mainWindow) {
    console.error('❌ mainWindow is not available');
    return;
  }
  
  var fkey_mapping = [];
  console.log("Loading hotkeys file");
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
      console.log('Silently exiting hotkey load');
      return;
    }
    else {
      var filename = result.filePaths[0];
      console.log(`Processing file ${filename}`);
      const line_reader = new readlines(filename);
      var title

      let line;
      while (line = line_reader.next()) {
        let [key, val] = line.toString().trim().split('::');
        if (/^\D\d+$/.test(key)) {
          fkey_mapping[key] = val;
        } else {
          title = val.replace('_', ' ')
        }
      }
      mainWindow.webContents.send('fkey_load', fkey_mapping, title);
    }
  }).catch(err => {
    console.log(err)
  })
}

// Load holding tank file
function loadHoldingTankFile() {
  if (!mainWindow) {
    console.error('❌ mainWindow is not available');
    return;
  }
  
  var song_ids = [];
  console.log("Loading holding tank file");
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
      console.log('Silently exiting holding tank load');
      return;
    }
    else {
      var filename = result.filePaths[0];
      console.log(`Processing file ${filename}`);
      const line_reader = new readlines(filename);

      let line;
      while (line = line_reader.next()) {
        song_ids.push(line.toString().trim());
      }
      mainWindow.webContents.send('holding_tank_load', song_ids);
    }
  }).catch(err => {
    console.log(err)
  })
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
      console.log('Silently exiting hotkey save');
      return;
    }
    else {
      var filename = result.filePath;
      console.log(`Processing file ${filename}`);
      var file = fs.createWriteStream(filename);
      for (let i = 0; i < hotkeyArray.length; i++) {
        var keyId = `f${i + 1}`;
        console.log(`Hotkey array ${i} is ${hotkeyArray[i]}`)
        if (hotkeyArray[i] === undefined || /^\d+$/.test(hotkeyArray[i])) {
          file.write([keyId, hotkeyArray[i]].join('::') + '\n');
        } else {
          file.write(['tab_name', hotkeyArray[i].replace(' ', '_')].join('::') + '\n')
        }
      }
      file.end();
    }
  }).catch(err => {
    console.log(err)
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
      console.log('Silently exiting holding tank save');
      return;
    }
    else {
      var filename = result.filePath;
      console.log(`Processing file ${filename}`);
      var file = fs.createWriteStream(filename);
      for (let i = 0; i < holdingTankArray.length; i++) {
        file.write(holdingTankArray[i] + '\n');
      }
      file.end();
    }
  }).catch(err => {
    console.log(err)
  })
}

// Add directory dialog
function addDirectoryDialog() {
  console.log("Adding directory of songs");
  dialog.showOpenDialog(mainWindow, {
    buttonLabel: 'Add All',
    message: 'Choose directory of music to add',
    properties: ['openDirectory']
  }).then(result => {
    if (result.canceled == true) {
      console.log('Silently exiting add file');
      return;
    } else {
      var dirname = result.filePaths[0];
      console.log(`Processing directory ${dirname}`);
      mainWindow.webContents.send('bulk_add_dialog_load', dirname);
    }
  }).catch(err => {
    console.log(err)
  })
}

// Add file dialog
function addFileDialog() {
  console.log("Adding new file");
  dialog.showOpenDialog(mainWindow, {
    buttonLabel: 'Add',
    filters: [
      { name: 'Audio Files', extensions: ['mp3', 'mp4', 'm4a', 'wav', 'ogg'] }
    ],
    message: 'Choose audio file to add to Mx. Voice',
    properties: ['openFile']
  }).then(result => {
    if (result.canceled == true) {
      console.log('Silently exiting add file');
      return;
    }
    else {
      var filename = result.filePaths[0];
      console.log(`Processing file ${filename}`);
      mainWindow.webContents.send('add_dialog_load', filename);
    }
  }).catch(err => {
    console.log(err)
  })
}

// Migrate old preferences
function migrateOldPreferences() {
  const old_prefs_path = path.resolve(app.getPath('userData'), 'preferences.json');
  if (fs.existsSync(old_prefs_path)) {
    // There is an old preferences file we need to migrate
    console.log('Migrating old preferences.json to new config.json file');
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
  console.log('Testing File Operations...');
  console.log('✅ File operations module loaded');
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