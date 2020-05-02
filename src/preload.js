const { ipcRenderer, remote } = require('electron');
const { Howl, Howler } = require('howler');
const preferences = ipcRenderer.sendSync('getPreferences')
const path = require('path');
console.log(`DB path is ${path.join(preferences.locations.database_directory, 'mrvoice.db')}`)
const db = require('better-sqlite3')(path.join(preferences.locations.database_directory, 'mrvoice.db'));

ipcRenderer.on('fkey_load', function(event, fkeys) {
  populateHotkeys(fkeys);
});

ipcRenderer.on('holding_tank_load', function(event, songIds) {
  populateHoldingTank(songIds);
});


ipcRenderer.on('start_hotkey_save', function(event, fkeys) {
  saveHotkeyFile();
})

process.once('loaded', () => {
  global.homedir = require('os').homedir(),
  global.path = path,
  global.preferences = preferences,
  global.Mousetrap = require('mousetrap'),
  global.ipcRenderer = ipcRenderer,
  global.db = db,
  global.prompt = require('electron-prompt')
})
