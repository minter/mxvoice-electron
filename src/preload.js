const { ipcRenderer, remote, Menu, MenuItem, dialog } = require('electron');
window.preferences = ipcRenderer.sendSync('getPreferences');
window.Mousetrap = require('mousetrap');

window.sqlite3 = require('sqlite3').verbose();
const { Howl, Howler } = require('howler');
window.path = require('path');
window.homedir = require('os').homedir();

window.platform = remote.process.platform;
window.app = remote.app;
