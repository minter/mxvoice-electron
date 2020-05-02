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
  $('#song-form-category').empty();
  const stmt = db.prepare("SELECT * FROM categories ORDER BY description ASC");
  for (const row of stmt.iterate()) {
    categories[row.code] = row.description;
    $('#song-form-category').append(`<option value="${row.code}">${row.description}</option>`);
  }
  $('#songFormModal form').attr('onsubmit', 'saveNewSong(event)')
  $('#songFormModalTitle').html('Add New Song To Mx. Voice')
  $('#songFormSubmitButton').html('Add Song');
  $('#songFormModal').modal();
})

ipcRenderer.on('delete_selected_song', function(event) {
  console.log('Received delete_selected_song message')
  deleteSelectedSong();
});

ipcRenderer.on('edit_selected_song', function(event) {
  console.log('Received edit_selected_song message')
  var songId = $('#selected_row').attr('songid');
  const stmt = db.prepare("SELECT * FROM mrvoice WHERE id = ?");

  if (songId) {
    var songInfo = stmt.get(songId);

    $('#song-form-songid').val(songId);
    $('#song-form-category').empty();
    const categoryStmt = db.prepare("SELECT * FROM categories ORDER BY description ASC");
    for (const row of categoryStmt.iterate()) {
      categories[row.code] = row.description;
      if (row.code == songInfo.category) {
        $('#song-form-category').append(`<option selected="selected" value="${row.code}">${row.description}</option>`);
      } else {
        $('#song-form-category').append(`<option value="${row.code}">${row.description}</option>`);
      }
    }


    $('#song-form-title').val(songInfo.title);
    $('#song-form-artist').val(songInfo.artist);
    $('#song-form-info').val(songInfo.info);
    $('#song-form-duration').val(songInfo.time);
    $('#songFormModal form').attr('onsubmit', 'saveEditedSong(event)')
    $('#songFormModalTitle').html('Edit This Song')
    $('#songFormSubmitButton').html('Save');
    $('#songFormModal').modal();

  }
});


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
