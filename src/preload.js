const { ipcRenderer, remote } = require('electron');
const { Howl, Howler } = require('howler');
const NodeID3 = require('node-id3');
const { v4: uuidv4 } = require('uuid');

ipcRenderer.on('fkey_load', function(event, fkeys) {
  populateHotkeys(fkeys);
});

ipcRenderer.on('holding_tank_load', function(event, songIds) {
  populateHoldingTank(songIds);
});


ipcRenderer.on('start_hotkey_save', function(event, fkeys) {
  saveHotkeyFile();
})

ipcRenderer.on('add_dialog_load', function(event, filename) {
  console.log(`Renderer received filename ${filename}`);

  NodeID3.read(filename, function(err, tags) {
    console.log(`Title is ${tags['title']}`);
    $('#song-form-title').val(tags['title']);
    $('#song-form-artist').val(tags['artist']);
    $('#song-form-filename').val(filename);
  });
  db.each("SELECT * FROM categories ORDER BY description ASC", [], function(err, row) {
  if (err) {
    throw err;
  }
    categories[row.code] = row.description;
    $('#song-form-category').append(`<option value="${row.code}">${row.description}</option>`);
  });
  $('#addSongModal').modal();
})

process.once('loaded', () => {
  global.homedir = require('os').homedir(),
  global.path = require('path'),
  global.sqlite3 = require('sqlite3').verbose(),
  global.preferences = ipcRenderer.sendSync('getPreferences'),
  global.Mousetrap = require('mousetrap'),
  global.ipcRenderer = ipcRenderer,
  global.prompt = require('electron-prompt'),
  global.uuidv4 = uuidv4,
  global.fs = require('fs')
})
