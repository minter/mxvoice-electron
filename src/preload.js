const { ipcRenderer, remote } = require('electron');
window.preferences = ipcRenderer.sendSync('getPreferences');

window.sqlite3 = require('sqlite3').verbose();
const { Howl, Howler } = require('howler');
window.path = require('path');
window.homedir = require('os').homedir();
