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
import { parseFile as parseAudioMetadata } from 'music-metadata';

// Dependencies that will be injected
let getMainWindow = () => null;
let store;
let debugLog;

function parseHotkeyFileLines(lines) {
  const hotkeys = {};
  let title = '';
  const errors = [];

  lines.forEach((rawLine, index) => {
    const line = String(rawLine).trim();
    if (!line) return;
    const separator = line.indexOf('::');
    if (separator < 0) {
      errors.push(`Line ${index + 1}: missing :: separator`);
      return;
    }
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 2).trim();
    if (/^f(?:[1-9]|1[0-2])$/.test(key)) {
      if (value && !/^\d+$/.test(value)) errors.push(`Line ${index + 1}: invalid song ID for ${key}`);
      else hotkeys[key] = value;
    } else if (key === 'tab_name') {
      title = value.replaceAll('_', ' ');
    } else {
      errors.push(`Line ${index + 1}: unknown key "${key || '(empty)'}"`);
    }
  });

  return { hotkeys, title, errors };
}

// Initialize the module with dependencies
function initializeFileOperations(dependencies) {
  getMainWindow = dependencies.getMainWindow || (() => dependencies.mainWindow);
  store = dependencies.store;
  debugLog = dependencies.debugLog;
  
  debugLog?.info('🔍 Initializing file operations with dependencies:', { 
    module: 'file-operations', 
    function: 'initializeFileOperations', 
    mainWindowSet: !!getMainWindow(),
    storeSet: !!dependencies.store,
    autoUpdaterSet: !!dependencies.autoUpdater,
    debugLogSet: !!dependencies.debugLog
  });
}

const HOTKEY_KEYS = Array.from({ length: 12 }, (_, i) => `f${i + 1}`);
const SONG_ID = /^\d+$/;
const HOTKEY_FILTERS = [{ name: 'Mx. Voice Hotkey Files', extensions: ['mrv'] }];
const HOLDING_TANK_FILTERS = [{ name: 'Mx. Voice Holding Tank Files', extensions: ['hld'] }];

/**
 * A hotkey tab as a .mrv file: f1:: to f12:: in order, then tab_name:: (spaces
 * as _) when the tab has a name. Older versions read and write this format.
 * @param {{ tabName?: string|null, hotkeys?: Object }} tab - a tab of the hotkeys snapshot
 * @returns {string}
 */
function formatHotkeyTabFile(tab) {
  const hotkeys = tab?.hotkeys || {};
  const lines = HOTKEY_KEYS.map((key) => `${key}::${hotkeys[key] ?? ''}`);
  const tabName = typeof tab?.tabName === 'string' ? tab.tabName.trim() : '';
  if (tabName) lines.push(`tab_name::${tabName.replace(/ /g, '_')}`);
  return `${lines.join('\n')}\n`;
}

/**
 * A holding tank tab as a .hld file: one song id per line.
 * @param {Array<string|number>} songIds
 * @returns {string}
 */
function formatHoldingTankTabFile(songIds) {
  return songIds.map((id) => `${id}\n`).join('');
}

/**
 * The save dialog's default file name: the tab label plus the extension, with
 * characters that are invalid in file names replaced by -.
 * @param {string} label - "Preshow", or "Tab 2" for an unnamed tab
 * @param {string} extension - 'mrv' or 'hld'
 */
function tabFileName(label, extension) {
  // eslint-disable-next-line no-control-regex
  const base = String(label ?? '').replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-').trim();
  return `${base || 'Tab'}.${extension}`;
}

function hotkeyTabError(tab) {
  if (!tab || typeof tab !== 'object' || !tab.hotkeys || typeof tab.hotkeys !== 'object') return 'Invalid hotkey tab';
  for (const [key, songId] of Object.entries(tab.hotkeys)) {
    if (!HOTKEY_KEYS.includes(key)) return `Invalid hotkey key "${key}"`;
    if (songId !== null && songId !== undefined && songId !== '' && !SONG_ID.test(String(songId))) {
      return `Invalid song ID for ${key}`;
    }
  }
  return null;
}

// Electron's dialogs take the window first when there is one
function showDialog(kind, options) {
  const win = getMainWindow();
  return win ? dialog[kind](win, options) : dialog[kind](options);
}

function tabDefaultPath(label, extension) {
  const name = tabFileName(label, extension);
  const directory = store?.get?.('hotkey_directory');
  return directory ? path.join(directory, name) : name;
}

async function saveTabFile({ label, extension, filters, message, contents, functionName }) {
  try {
    const result = await showDialog('showSaveDialog', {
      buttonLabel: 'Save',
      filters,
      defaultPath: tabDefaultPath(label, extension),
      message
    });
    if (result?.canceled || !result?.filePath) {
      debugLog?.info('Tab save canceled', { module: 'file-operations', function: functionName });
      return { success: true, data: { canceled: true } };
    }
    await fs.promises.writeFile(result.filePath, contents, 'utf8');
    debugLog?.info('Tab saved to file', { module: 'file-operations', function: functionName, filename: result.filePath });
    return { success: true, data: { path: result.filePath } };
  } catch (error) {
    debugLog?.error('Error saving tab file', { module: 'file-operations', function: functionName, error: error?.message });
    return { success: false, error: error?.message || String(error) };
  }
}

/**
 * Save a hotkey tab to a .mrv file the user picks.
 * @param {{ tabName?: string|null, hotkeys: Object }} tab - a tab of the hotkeys snapshot
 * @param {string} label - the tab label, for the default file name
 * @returns {Promise<{ success: true, data: { path: string } | { canceled: true } } | { success: false, error: string }>}
 */
async function saveHotkeyTabFile(tab, label) {
  const error = hotkeyTabError(tab);
  if (error) {
    debugLog?.warn(error, { module: 'file-operations', function: 'saveHotkeyTabFile' });
    return { success: false, error };
  }
  return saveTabFile({
    label,
    extension: 'mrv',
    filters: HOTKEY_FILTERS,
    message: 'Save your Mx. Voice hotkey file',
    contents: formatHotkeyTabFile(tab),
    functionName: 'saveHotkeyTabFile'
  });
}

/**
 * Save a holding tank tab to a .hld file the user picks.
 * @param {Array<string|number>} songIds - the tab's songs, in order
 * @param {string} label - the tab label, for the default file name
 */
async function saveHoldingTankTabFile(songIds, label) {
  if (!Array.isArray(songIds) || !songIds.every((id) => SONG_ID.test(String(id)))) {
    const error = 'Invalid holding tank song IDs';
    debugLog?.warn(error, { module: 'file-operations', function: 'saveHoldingTankTabFile' });
    return { success: false, error };
  }
  return saveTabFile({
    label,
    extension: 'hld',
    filters: HOLDING_TANK_FILTERS,
    message: 'Save your Mx. Voice holding tank file',
    contents: formatHoldingTankTabFile(songIds),
    functionName: 'saveHoldingTankTabFile'
  });
}

// Show the open dialog and read the picked file's lines; null when canceled
async function openTabFile({ filters, message, functionName }) {
  const result = await showDialog('showOpenDialog', {
    buttonLabel: 'Open',
    filters,
    defaultPath: store?.get?.('hotkey_directory'),
    message,
    properties: ['openFile']
  });
  if (result?.canceled || !result?.filePaths?.length) {
    debugLog?.info('Tab load canceled', { module: 'file-operations', function: functionName });
    return null;
  }
  const filename = result.filePaths[0];
  debugLog?.info(`Processing file ${filename}`, { module: 'file-operations', function: functionName, filename });
  const text = await fs.promises.readFile(filename, 'utf8');
  return { filename, lines: text.split(/\r?\n/) };
}

/**
 * Pick a .mrv file and parse it.
 * @returns {Promise<{ success: true, data: { hotkeys: Object, tabName: string|null } | { canceled: true } } | { success: false, error: string }>}
 */
async function loadHotkeyTabFile() {
  try {
    const file = await openTabFile({ filters: HOTKEY_FILTERS, message: 'Select your Mx. Voice hotkey file', functionName: 'loadHotkeyTabFile' });
    if (!file) return { success: true, data: { canceled: true } };
    const parsed = parseHotkeyFileLines(file.lines);
    if (parsed.errors.length) {
      const error = `This isn't a valid hotkey file: ${parsed.errors.join('; ')}.`;
      debugLog?.warn(error, { module: 'file-operations', function: 'loadHotkeyTabFile', filename: file.filename });
      return { success: false, error };
    }
    return { success: true, data: { hotkeys: parsed.hotkeys, tabName: parsed.title || null } };
  } catch (error) {
    debugLog?.error('Error loading hotkey file', { module: 'file-operations', function: 'loadHotkeyTabFile', error: error?.message });
    return { success: false, error: error?.message || String(error) };
  }
}

/**
 * Pick a .hld file and read its song ids. Lines that aren't ids are ignored.
 * @returns {Promise<{ success: true, data: { songIds: string[] } | { canceled: true } } | { success: false, error: string }>}
 */
async function loadHoldingTankTabFile() {
  try {
    const file = await openTabFile({ filters: HOLDING_TANK_FILTERS, message: 'Select your Mx. Voice holding tank file', functionName: 'loadHoldingTankTabFile' });
    if (!file) return { success: true, data: { canceled: true } };
    const songIds = file.lines.map((line) => line.trim()).filter((id) => SONG_ID.test(id));
    return { success: true, data: { songIds } };
  } catch (error) {
    debugLog?.error('Error loading holding tank file', { module: 'file-operations', function: 'loadHoldingTankTabFile', error: error?.message });
    return { success: false, error: error?.message || String(error) };
  }
}

// Add directory dialog
function addDirectoryDialog() {
  debugLog?.info("Adding directory of songs", { module: 'file-operations', function: 'addDirectoryDialog' });
  dialog.showOpenDialog(getMainWindow(), {
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
      getMainWindow().webContents.send('bulk_add_dialog_load', dirname);
    }
  }).catch(err => {
    debugLog?.error('Error adding directory:', { module: 'file-operations', function: 'addDirectoryDialog', error: err });
  })
}

// Add file dialog
function addFileDialog() {
  debugLog?.info("Adding new file", { module: 'file-operations', function: 'addFileDialog' });
  dialog.showOpenDialog(getMainWindow(), {
    buttonLabel: 'Add',
    filters: [
      { name: 'Audio Files', extensions: ['mp3', 'mp4', 'm4a', 'wav', 'ogg', 'flac', 'opus'] }
    ],
    message: 'Choose audio file to add to Mx. Voice',
    properties: ['openFile']
  }).then(async result => {
    if (result.canceled == true) {
      debugLog?.info('Silently exiting add file', { module: 'file-operations', function: 'addFileDialog' });
      return;
    }
    else {
      const filename = result.filePaths[0];
      debugLog?.info(`Processing file ${filename}`, { module: 'file-operations', function: 'addFileDialog', filename: filename });
      // Parse audio metadata in main process (preload cannot access fs in sandbox mode)
      let metadata = null;
      try {
        metadata = await parseAudioMetadata(filename);
      } catch (err) {
        debugLog?.warn('Failed to parse audio metadata', { module: 'file-operations', function: 'addFileDialog', error: err?.message, filename });
      }
      getMainWindow().webContents.send('add_dialog_load', filename, metadata);
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

export {
  initializeFileOperations,
  saveHotkeyTabFile,
  saveHoldingTankTabFile,
  loadHotkeyTabFile,
  loadHoldingTankTabFile,
  formatHotkeyTabFile,
  formatHoldingTankTabFile,
  tabFileName,
  addDirectoryDialog,
  addFileDialog,
  migrateOldPreferences,
  parseHotkeyFileLines
};

// Default export for module loading
export default {
  initializeFileOperations,
  saveHotkeyTabFile,
  saveHoldingTankTabFile,
  loadHotkeyTabFile,
  loadHoldingTankTabFile,
  formatHotkeyTabFile,
  formatHoldingTankTabFile,
  tabFileName,
  addDirectoryDialog,
  addFileDialog,
  migrateOldPreferences,
  parseHotkeyFileLines
};
