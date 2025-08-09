/**
 * Song CRUD Operations
 * 
 * Handles creating, reading, updating, and deleting songs in the database
 * and managing the song form modal interface
 */

// Import debug logger
let debugLog = null;
try {
  if (window.debugLog) {
    debugLog = window.debugLog;
  }
} catch (error) {
  // Debug logger not available
}

/**
 * Saves an edited song to the database
 * Updates song information and refreshes the search results
 * 
 * @param {Event} event - The form submission event
 */
export function saveEditedSong(event) {
  event.preventDefault();
  $(`#songFormModal`).modal("hide");
  debugLog?.info("Starting edit process", { module: 'song-management', function: 'saveEditedSong' });
  const songId = $("#song-form-songid").val();
  const title = $("#song-form-title").val();
  const artist = $("#song-form-artist").val();
  const info = $("#song-form-info").val();
  const category = $("#song-form-category").val();

  const stmt = db.prepare(
    "UPDATE mrvoice SET title = ?, artist = ?, category = ?, info = ? WHERE id = ?"
  );
  stmt.run(title, artist, category, info, songId);

  $("#omni_search").val(title);
  searchData();
}

/**
 * Saves a new song to the database
 * Handles file copying, category creation, and database insertion
 * 
 * @param {Event} event - The form submission event
 */
export function saveNewSong(event) {
  event.preventDefault();
  $(`#songFormModal`).modal("hide");
  debugLog?.info("Starting save process", { module: 'song-management', function: 'saveNewSong' });
  const filename = $("#song-form-filename").val();
  window.electronAPI.path.parse(filename).then(result => {
    if (result.success) {
      const pathData = result.data;
      const title = $("#song-form-title").val();
      const artist = $("#song-form-artist").val();
      const info = $("#song-form-info").val();
      const category = $("#song-form-category").val();

      if (category == "--NEW--") {
        const description = $("#song-form-new-category").val();
        let code = description.replace(/\s/g, "").substr(0, 4).toUpperCase();
        const codeCheckStmt = db.prepare("SELECT * FROM categories WHERE code = ?");
        let loopCount = 1;
        let newCode = code;
        while ((row = codeCheckStmt.get(newCode))) {
          debugLog?.info(`Found a code collision on ${code}`, { module: 'song-management', function: 'saveNewSong' });
          newCode = `${code}${loopCount}`;
          loopCount = loopCount + 1;
          debugLog?.info(`NewCode is ${newCode}`, { module: 'song-management', function: 'saveNewSong' });
        }
        debugLog?.info(`Out of loop, setting code to ${newCode}`, { module: 'song-management', function: 'saveNewSong' });
        code = newCode;
        const categoryInsertStmt = db.prepare(
          "INSERT INTO categories VALUES (?, ?)"
        );
        try {
          const categoryInfo = categoryInsertStmt.run(
            code,
            $("#song-form-new-category").val()
          );
          if (categoryInfo.changes == 1) {
            debugLog?.info(`Added new row into database`, { module: 'song-management', function: 'saveNewSong' });
            populateCategorySelect();
            populateCategoriesModal();
            category = code;
          }
        } catch (err) {
          if (err.message.match(/UNIQUE constraint/)) {
            const description = $("#song-form-new-category").val();
            $("#song-form-new-category").val("");
            alert(
              `Couldn't add a category named "${description}" - apparently one already exists!`
            );
            return;
          }
        }
      }

      const duration = $("#song-form-duration").val();
      const uuid = uuidv4();
      const newFilename = `${artist}-${title}-${uuid}${pathData.ext}`.replace(
        /[^-.\w]/g,
        ""
      );
      window.electronAPI.path.join(store.get("music_directory"), newFilename).then(joinResult => {
        if (joinResult.success) {
          const newPath = joinResult.data;
          const stmt = db.prepare(
            "INSERT INTO mrvoice (title, artist, category, info, filename, time, modtime) VALUES (?, ?, ?, ?, ?, ?, ?)"
          );
          stmt.run(
            title,
            artist,
            category,
            info,
            newFilename,
            duration,
            Math.floor(Date.now() / 1000)
          );
          window.electronAPI.fileSystem.copy(filename, newPath).then(result => {
            if (result.success) {
              debugLog?.info('✅ File copied successfully', { module: 'song-management', function: 'saveNewSong' });
            } else {
              debugLog?.warn('❌ Failed to copy file:', { module: 'song-management', function: 'saveNewSong', error: result.error });
            }
          }).catch(error => {
            debugLog?.warn('❌ File copy error:', { module: 'song-management', function: 'saveNewSong', error: error });
          });

          // Song has been saved, now let's show item
          $("#omni_search").val(title);
          searchData();
        } else {
          debugLog?.warn('❌ Failed to join path:', { module: 'song-management', function: 'saveNewSong', error: joinResult.error });
        }
      }).catch(error => {
        debugLog?.warn('❌ Path join error:', { module: 'song-management', function: 'saveNewSong', error: error });
      });
    } else {
      debugLog?.warn('❌ Failed to parse path:', { module: 'song-management', function: 'saveNewSong', error: result.error });
    }
  }).catch(error => {
    debugLog?.warn('❌ Path parse error:', { module: 'song-management', function: 'saveNewSong', error: error });
  });
}

/**
 * Opens the song edit modal for the selected song
 * Populates the form with the song's current information
 */
export function editSelectedSong() {
  const songId = $("#selected_row").attr("songid");
  const stmt = db.prepare("SELECT * FROM mrvoice WHERE id = ?");

  if (songId) {
    const songInfo = stmt.get(songId);

    $("#song-form-songid").val(songId);
    $("#song-form-category").empty();
    const categoryStmt = db.prepare(
      "SELECT * FROM categories ORDER BY description ASC"
    );
    for (const row of categoryStmt.iterate()) {
      categories[row.code] = row.description;
      if (row.code == songInfo.category) {
        $("#song-form-category").append(
          `<option selected="selected" value="${row.code}">${row.description}</option>`
        );
      } else {
        $("#song-form-category").append(
          `<option value="${row.code}">${row.description}</option>`
        );
      }
    }

    $("#song-form-title").val(songInfo.title);
    $("#song-form-artist").val(songInfo.artist);
    $("#song-form-info").val(songInfo.info);
    $("#song-form-duration").val(songInfo.time);
    $("#songFormModal form").attr("onsubmit", "saveEditedSong(event)");
    $("#songFormModalTitle").html("Edit This Song");
    $("#songFormSubmitButton").html("Save");
    $("#songFormModal").modal();
  }
}

/**
 * Determines the appropriate delete action based on the selected row's location
 * Handles deletion from holding tank, hotkeys, or database
 */
export function deleteSelectedSong() {
  debugLog?.info("deleteSelectedSong called", { module: 'song-management', function: 'deleteSelectedSong' });
  debugLog?.info("selected_row:", { module: 'song-management', function: 'deleteSelectedSong', selectedRow: $("#selected_row") });
  debugLog?.info("holding-tank-column has selected_row:", { module: 'song-management', function: 'deleteSelectedSong', hasSelectedRow: $("#holding-tank-column").has($("#selected_row")).length });
  debugLog?.info("hotkey-tab-content has selected_row:", { module: 'song-management', function: 'deleteSelectedSong', hasSelectedRow: $("#hotkey-tab-content").has($("#selected_row")).length });
  
  // Check if the selected row is in the holding tank
  if ($("#holding-tank-column").has($("#selected_row")).length) {
    debugLog?.info("Selected row is in holding tank", { module: 'song-management', function: 'deleteSelectedSong' });
    // If in holding tank, remove from holding tank
    removeFromHoldingTank();
  } else if ($("#hotkey-tab-content").has($("#selected_row")).length) {
    debugLog?.info("Selected row is in hotkey tab", { module: 'song-management', function: 'deleteSelectedSong' });
    // If in hotkey tab, remove from hotkey
    removeFromHotkey();
  } else {
    debugLog?.info("Selected row is in search results", { module: 'song-management', function: 'deleteSelectedSong' });
    // If not in holding tank or hotkey, delete from database
    deleteSong();
  }
} 