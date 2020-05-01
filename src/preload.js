const { ipcRenderer, remote } = require('electron');
const { Howl, Howler } = require('howler');

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
  global.path = require('path'),
  global.sqlite3 = require('sqlite3').verbose(),
  global.preferences = ipcRenderer.sendSync('getPreferences'),
  global.Mousetrap = require('mousetrap'),
  global.ipcRenderer = ipcRenderer,
  global.prompt = require('electron-prompt')
})
