const { ipcRenderer } = require('electron')
const { Howl, Howler } = require('howler')
const Store = require('electron-store');
const store = new Store();
const path = require('path')
const fs = require('fs')
const log = require('electron-log');
console.log = log.log;
var dbName = 'mxvoice.db'
console.log(`Looking for database in ${store.get('database_directory')}`)
if (fs.existsSync(path.join(store.get('database_directory'), 'mrvoice.db'))) {
  dbName = 'mrvoice.db'
}
console.log(`Attempting to open database file ${path.join(store.get('database_directory'), dbName)}`)
const db = require('better-sqlite3')(path.join(store.get('database_directory'), dbName));
const { v4: uuidv4 } = require('uuid');
const mm = require('music-metadata');

ipcRenderer.on('fkey_load', function(event, fkeys, title) {
  populateHotkeys(fkeys, title);
});

ipcRenderer.on('manage_categories', function(event) {
  openCategoriesModal();
});


ipcRenderer.on('holding_tank_load', function(event, songIds) {
  populateHoldingTank(songIds);
});


ipcRenderer.on('start_hotkey_save', function(event, fkeys) {
  saveHotkeyFile();
})

ipcRenderer.on('show_preferences', function(event) {
  openPreferencesModal();
})

ipcRenderer.on('bulk_add_dialog_load', function(event, dirname) {
  console.log(`Renderer received directory ${dirname}`)
  showBulkAddModal(dirname);
});

ipcRenderer.on('add_dialog_load', function(event, filename) {
  console.log(`Renderer received filename ${filename}`);
  mm.parseFile(filename)
  .then( metadata => {
    var pathData = path.parse(filename);
    var duration = metadata.format.duration
    var durationSeconds = 0
    if(duration) {
      durationSeconds = duration.toFixed(0);
    }
    var durationString = new Date(durationSeconds * 1000).toISOString().substr(14, 5);
    $('#song-form-duration').val(durationString);
    $('#song-form-title').val(metadata.common.title);
    $('#song-form-artist').val(metadata.common.artist);
    $('#song-form-filename').val(filename);
    $('#song-form-category').empty();
    const stmt = db.prepare("SELECT * FROM categories ORDER BY description ASC");
    for (const row of stmt.iterate()) {
      categories[row.code] = row.description;
      $('#song-form-category').append(`<option value="${row.code}">${row.description}</option>`);
    }
    $('#song-form-category').append(`<option value="" disabled>-----------------------</option>`);
    $('#song-form-category').append(`<option value="--NEW--">ADD NEW CATEGORY...</option>`);

    $('#songFormModal form').attr('onsubmit', 'saveNewSong(event)')
    $('#songFormModalTitle').html('Add New Song To Mx. Voice')
    $('#songFormSubmitButton').html('Add Song');
    $('#songFormModal').modal();

  })
  .catch( err => {
    console.error(err.message);
  });
})

ipcRenderer.on('delete_selected_song', function(event) {
  console.log('Received delete_selected_song message')
  deleteSelectedSong();
});

ipcRenderer.on('edit_selected_song', function(event) {
  editSelectedSong();
});

ipcRenderer.on('display_release_notes', function(event, releaseName, releaseNotes) {
  $('#newReleaseModal .modal-title').html(`Downloaded New Version: ${releaseName}`);
  $('#newReleaseModal .modal-body').html(releaseNotes);
  $('#newReleaseModal').modal();
})

process.once('loaded', () => {

  // Ensure that there is a unique index on category code
  global.homedir = require('os').homedir(),
  global.path = path,
  global.store = store,
  global.Mousetrap = require('mousetrap'),
  global.ipcRenderer = ipcRenderer,
  global.prompt = require('electron-prompt'),
  global.uuidv4 = uuidv4,
  global.mm = mm,
  global.util = require('util'),
  global.fs = fs,
  global.db = db

  if (db.pragma('index_info(category_code_index)').length == 0) {
    console.log(`Creating unique index on category codes`)
    const stmt = db.prepare("CREATE UNIQUE INDEX 'category_code_index' ON categories(code)")
    const info = stmt.run()
  }

  if (db.pragma('index_info(category_description_index)').length == 0) {
    console.log(`Creating unique index on category descriptions`)
    const stmt = db.prepare("CREATE UNIQUE INDEX 'category_description_index' ON categories(description)")
    const info = stmt.run()
  }


})
