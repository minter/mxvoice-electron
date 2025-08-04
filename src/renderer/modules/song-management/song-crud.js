/**
 * Song CRUD Operations
 * 
 * Handles creating, reading, updating, and deleting songs in the database
 * and managing the song form modal interface
 */

/**
 * Saves an edited song to the database
 * Updates song information and refreshes the search results
 * 
 * @param {Event} event - The form submission event
 */
export function saveEditedSong(event) {
  event.preventDefault();
  $(`#songFormModal`).modal("hide");
  console.log("Starting edit process");
  var songId = $("#song-form-songid").val();
  var title = $("#song-form-title").val();
  var artist = $("#song-form-artist").val();
  var info = $("#song-form-info").val();
  var category = $("#song-form-category").val();

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
  console.log("Starting save process");
  var filename = $("#song-form-filename").val();
  window.electronAPI.path.parse(filename).then(result => {
    if (result.success) {
      var pathData = result.data;
      var title = $("#song-form-title").val();
      var artist = $("#song-form-artist").val();
      var info = $("#song-form-info").val();
      var category = $("#song-form-category").val();

      if (category == "--NEW--") {
        var description = $("#song-form-new-category").val();
        var code = description.replace(/\s/g, "").substr(0, 4).toUpperCase();
        var codeCheckStmt = db.prepare("SELECT * FROM categories WHERE code = ?");
        var loopCount = 1;
        var newCode = code;
        while ((row = codeCheckStmt.get(newCode))) {
          console.log(`Found a code collision on ${code}`);
          var newCode = `${code}${loopCount}`;
          loopCount = loopCount + 1;
          console.log(`NewCode is ${newCode}`);
        }
        console.log(`Out of loop, setting code to ${newCode}`);
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
            console.log(`Added new row into database`);
            populateCategorySelect();
            populateCategoriesModal();
            category = code;
          }
        } catch (err) {
          if (err.message.match(/UNIQUE constraint/)) {
            var description = $("#song-form-new-category").val();
            $("#song-form-new-category").val("");
            alert(
              `Couldn't add a category named "${description}" - apparently one already exists!`
            );
            return;
          }
        }
      }

      var duration = $("#song-form-duration").val();
      var uuid = uuidv4();
      var newFilename = `${artist}-${title}-${uuid}${pathData.ext}`.replace(
        /[^-.\w]/g,
        ""
      );
      window.electronAPI.path.join(store.get("music_directory"), newFilename).then(joinResult => {
        if (joinResult.success) {
          var newPath = joinResult.data;
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
              console.log('✅ File copied successfully');
            } else {
              console.warn('❌ Failed to copy file:', result.error);
            }
          }).catch(error => {
            console.warn('❌ File copy error:', error);
          });

          // Song has been saved, now let's show item
          $("#omni_search").val(title);
          searchData();
        } else {
          console.warn('❌ Failed to join path:', joinResult.error);
        }
      }).catch(error => {
        console.warn('❌ Path join error:', error);
      });
    } else {
      console.warn('❌ Failed to parse path:', result.error);
    }
  }).catch(error => {
    console.warn('❌ Path parse error:', error);
  });
}

/**
 * Opens the song edit modal for the selected song
 * Populates the form with the song's current information
 */
export function editSelectedSong() {
  var songId = $("#selected_row").attr("songid");
  const stmt = db.prepare("SELECT * FROM mrvoice WHERE id = ?");

  if (songId) {
    var songInfo = stmt.get(songId);

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
  console.log("deleteSelectedSong called");
  console.log("selected_row:", $("#selected_row"));
  console.log("holding-tank-column has selected_row:", $("#holding-tank-column").has($("#selected_row")).length);
  console.log("hotkey-tab-content has selected_row:", $("#hotkey-tab-content").has($("#selected_row")).length);
  
  // Check if the selected row is in the holding tank
  if ($("#holding-tank-column").has($("#selected_row")).length) {
    console.log("Selected row is in holding tank");
    // If in holding tank, remove from holding tank
    removeFromHoldingTank();
  } else if ($("#hotkey-tab-content").has($("#selected_row")).length) {
    console.log("Selected row is in hotkey tab");
    // If in hotkey tab, remove from hotkey
    removeFromHotkey();
  } else {
    console.log("Selected row is in search results");
    // If not in holding tank or hotkey, delete from database
    deleteSong();
  }
} 