const { ipcRenderer, remote } = require('electron');
const { Howl, Howler } = require('howler');
const preferences = ipcRenderer.sendSync('getPreferences')
const path = require('path');
const db = require('better-sqlite3')(path.join(preferences.locations.database_directory, 'mrvoice.db'));
const NodeID3 = require('node-id3');
var mp4 = require('mp4js');
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
  var sound = new Howl({
    src: filename
  });
  sound.once('load', function(){
    var durationSeconds = sound.duration().toFixed(0);
    var durationString = new Date(durationSeconds * 1000).toISOString().substr(14, 5);
    $('#song-form-duration').val(durationString);
    sound.unload();
  });

  var pathData = path.parse(filename);

  if(pathData.ext.toLowerCase() == '.mp3') {
    NodeID3.read(filename, function(err, tags) {
      $('#song-form-title').val(tags['title']);
      $('#song-form-artist').val(tags['artist']);
    });
  } else if (['.mp4', '.m4a'].includes(pathData.ext.toLowerCase())) {
    console.log('Checking an MP4 file');
    mp4({ file: filename, type: 'local' }, function(err, tags) {
      $('#song-form-title').val(tags['title']);
      $('#song-form-artist').val(tags['artist']);
     });
  }

  $('#song-form-filename').val(filename);

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
  global.path = path,
  global.preferences = preferences,
  global.Mousetrap = require('mousetrap'),
  global.ipcRenderer = ipcRenderer,
  global.prompt = require('electron-prompt'),
  global.uuidv4 = uuidv4,
  global.fs = require('fs'),
  global.db = db
})
