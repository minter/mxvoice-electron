/**
 * Data Population Module
 * 
 * Handles populating UI elements with data from the database.
 * This module uses the preload database API to fetch data and
 * populate various UI components.
 */

/**
 * Populate category select dropdown
 * Fetches categories from database and populates the category select dropdown
 */
function populateCategorySelect() {
  console.log("Populating categories");
  $("#category_select option").remove();
  $("#category_select").append(`<option value="*">All Categories</option>`);
  
  return new Promise((resolve, reject) => {
    // Use new database API for getting categories
    if (window.electronAPI && window.electronAPI.database) {
      window.electronAPI.database.getCategories().then(result => {
        if (result.success) {
          result.data.forEach(row => {
            categories[row.code] = row.description;
            $("#category_select").append(
              `<option value="${row.code}">${row.description}</option>`
            );
          });
          console.log('✅ Categories populated successfully via API');
          resolve();
        } else {
          console.warn('❌ Failed to get categories:', result.error);
          // Fallback to legacy database access
          if (typeof db !== 'undefined') {
            try {
              var stmt = db.prepare("SELECT * FROM categories ORDER BY description ASC");
              for (const row of stmt.iterate()) {
                categories[row.code] = row.description;
                $("#category_select").append(
                  `<option value="${row.code}">${row.description}</option>`
                );
              }
              console.log('✅ Categories populated successfully via legacy DB');
              resolve();
            } catch (error) {
              console.error('❌ Legacy database error:', error);
              reject(error);
            }
          } else {
            reject(new Error('No database access available'));
          }
        }
      }).catch(error => {
        console.warn('❌ Database API error:', error);
        // Fallback to legacy database access
        if (typeof db !== 'undefined') {
          try {
            var stmt = db.prepare("SELECT * FROM categories ORDER BY description ASC");
            for (const row of stmt.iterate()) {
              categories[row.code] = row.description;
              $("#category_select").append(
                `<option value="${row.code}">${row.description}</option>`
              );
            }
            console.log('✅ Categories populated successfully via legacy DB (fallback)');
            resolve();
          } catch (dbError) {
            console.error('❌ Legacy database error:', dbError);
            reject(dbError);
          }
        } else {
          reject(error);
        }
      });
    } else {
      // Fallback to legacy database access
      if (typeof db !== 'undefined') {
        try {
          var stmt = db.prepare("SELECT * FROM categories ORDER BY description ASC");
          for (const row of stmt.iterate()) {
            categories[row.code] = row.description;
            $("#category_select").append(
              `<option value="${row.code}">${row.description}</option>`
            );
          }
          console.log('✅ Categories populated successfully via legacy DB (no API)');
          resolve();
        } catch (error) {
          console.error('❌ Legacy database error:', error);
          reject(error);
        }
      } else {
        reject(new Error('No database access available'));
      }
    }
  });
}

/**
 * Set label from song ID
 * Fetches song data by ID and sets the label for a UI element
 * 
 * @param {string} song_id - The song ID to fetch
 * @param {jQuery} element - The element to set the label for
 */
function setLabelFromSongId(song_id, element) {
  // Use new database API for getting song by ID
  if (window.electronAPI && window.electronAPI.database) {
    window.electronAPI.database.query("SELECT * from mrvoice WHERE id = ?", [song_id]).then(result => {
      if (result.success && result.data.length > 0) {
        var row = result.data[0];
        var title = row.title || "[Unknown Title]";
        var artist = row.artist || "[Unknown Artist]";
        var time = row.time || "[??:??]";
        
        // Handle swapping
        var original_song_node = $(`.hotkeys.active li[songid=${song_id}]`).not(
          element
        );
        console.log(original_song_node);
        if (original_song_node.length) {
          var old_song = original_song_node.find("span").detach();
          var destination_song = $(element).find("span").detach();
          original_song_node.append(destination_song);
          if (destination_song.attr("songid")) {
            original_song_node.attr("songid", destination_song.attr("songid"));
          } else {
            original_song_node.removeAttr("songid");
          }

          $(element).append(old_song);
        } else {
          $(element).find("span").html(`${title} by ${artist} (${time})`);
          $(element).find("span").attr("songid", song_id);
        }
        saveHotkeysToStore();
      } else {
        console.warn('❌ Failed to get song by ID:', result.error);
        // Fallback to legacy database access
        if (typeof db !== 'undefined') {
          var stmt = db.prepare("SELECT * from mrvoice WHERE id = ?");
          var row = stmt.get(song_id);
          var title = row.title || "[Unknown Title]";
          var artist = row.artist || "[Unknown Artist]";
          var time = row.time || "[??:??]";

          // Handle swapping
          var original_song_node = $(`.hotkeys.active li[songid=${song_id}]`).not(
            element
          );
          console.log(original_song_node);
          if (original_song_node.length) {
            var old_song = original_song_node.find("span").detach();
            var destination_song = $(element).find("span").detach();
            original_song_node.append(destination_song);
            if (destination_song.attr("songid")) {
              original_song_node.attr("songid", destination_song.attr("songid"));
            } else {
              original_song_node.removeAttr("songid");
            }

            $(element).append(old_song);
          } else {
            $(element).find("span").html(`${title} by ${artist} (${time})`);
            $(element).find("span").attr("songid", song_id);
          }
          saveHotkeysToStore();
        }
      }
    }).catch(error => {
      console.warn('❌ Database API error:', error);
      // Fallback to legacy database access
      if (typeof db !== 'undefined') {
        var stmt = db.prepare("SELECT * from mrvoice WHERE id = ?");
        var row = stmt.get(song_id);
        var title = row.title || "[Unknown Title]";
        var artist = row.artist || "[Unknown Artist]";
        var time = row.time || "[??:??]";

        // Handle swapping
        var original_song_node = $(`.hotkeys.active li[songid=${song_id}]`).not(
          element
        );
        console.log(original_song_node);
        if (original_song_node.length) {
          var old_song = original_song_node.find("span").detach();
          var destination_song = $(element).find("span").detach();
          original_song_node.append(destination_song);
          if (destination_song.attr("songid")) {
            original_song_node.attr("songid", destination_song.attr("songid"));
          } else {
            original_song_node.removeAttr("songid");
          }

          $(element).append(old_song);
        } else {
          $(element).find("span").html(`${title} by ${artist} (${time})`);
          $(element).find("span").attr("songid", song_id);
        }
        saveHotkeysToStore();
      }
    });
  } else {
    // Fallback to legacy database access
    if (typeof db !== 'undefined') {
      var stmt = db.prepare("SELECT * from mrvoice WHERE id = ?");
      var row = stmt.get(song_id);
      var title = row.title || "[Unknown Title]";
      var artist = row.artist || "[Unknown Artist]";
      var time = row.time || "[??:??]";

      // Handle swapping
      var original_song_node = $(`.hotkeys.active li[songid=${song_id}]`).not(
        element
      );
      console.log(original_song_node);
      if (original_song_node.length) {
        var old_song = original_song_node.find("span").detach();
        var destination_song = $(element).find("span").detach();
        original_song_node.append(destination_song);
        if (destination_song.attr("songid")) {
          original_song_node.attr("songid", destination_song.attr("songid"));
        } else {
          original_song_node.removeAttr("songid");
        }

        $(element).append(old_song);
      } else {
        $(element).find("span").html(`${title} by ${artist} (${time})`);
        $(element).find("span").attr("songid", song_id);
      }
      saveHotkeysToStore();
    }
  }
}

/**
 * Add song to holding tank
 * Fetches song data by ID and adds it to the holding tank UI
 * 
 * @param {string} song_id - The song ID to add
 * @param {jQuery} element - The element to add the song to
 */
function addToHoldingTank(song_id, element) {
  // Use new database API for getting song by ID
  if (window.electronAPI && window.electronAPI.database) {
    window.electronAPI.database.query("SELECT * from mrvoice WHERE id = ?", [song_id]).then(result => {
      if (result.success && result.data.length > 0) {
        var row = result.data[0];
        var title = row.title || "[Unknown Title]";
        var artist = row.artist || "[Unknown Artist]";
        var time = row.time || "[??:??]";

        var existing_song = $(
          `.holding_tank.active .list-group-item[songid=${song_id}]`
        );
        if (existing_song.length) {
          var song_row = existing_song.detach();
        } else {
          var song_row = document.createElement("li");
          song_row.style.fontSize = `${fontSize}px`;
          song_row.className = "song list-group-item context-menu";
          song_row.setAttribute("draggable", "true");
          song_row.setAttribute("ondragstart", "songDrag(event)");
          song_row.setAttribute("songid", song_id);
          song_row.textContent = `${title} by ${artist} (${time})`;
        }

        if ($(element).is("li")) {
          $(element).after(song_row);
        } else if ($(element).is("div")) {
          $(element).find("ul.active").append(song_row);
        } else {
          $(element).append(song_row);
        }
        saveHoldingTankToStore();
      } else {
        console.warn('❌ Failed to get song by ID:', result.error);
        // Fallback to legacy database access
        if (typeof db !== 'undefined') {
          var stmt = db.prepare("SELECT * from mrvoice WHERE id = ?");
          var row = stmt.get(song_id);
          var title = row.title || "[Unknown Title]";
          var artist = row.artist || "[Unknown Artist]";
          var time = row.time || "[??:??]";

          var existing_song = $(
            `.holding_tank.active .list-group-item[songid=${song_id}]`
          );
          if (existing_song.length) {
            var song_row = existing_song.detach();
          } else {
            var song_row = document.createElement("li");
            song_row.style.fontSize = `${fontSize}px`;
            song_row.className = "song list-group-item context-menu";
            song_row.setAttribute("draggable", "true");
            song_row.setAttribute("ondragstart", "songDrag(event)");
            song_row.setAttribute("songid", song_id);
            song_row.textContent = `${title} by ${artist} (${time})`;
          }

          if ($(element).is("li")) {
            $(element).after(song_row);
          } else if ($(element).is("div")) {
            $(element).find("ul.active").append(song_row);
          } else {
            $(element).append(song_row);
          }
          saveHoldingTankToStore();
        }
      }
    }).catch(error => {
      console.warn('❌ Database API error:', error);
      // Fallback to legacy database access
      if (typeof db !== 'undefined') {
        var stmt = db.prepare("SELECT * from mrvoice WHERE id = ?");
        var row = stmt.get(song_id);
        var title = row.title || "[Unknown Title]";
        var artist = row.artist || "[Unknown Artist]";
        var time = row.time || "[??:??]";

        var existing_song = $(
          `.holding_tank.active .list-group-item[songid=${song_id}]`
        );
        if (existing_song.length) {
          var song_row = existing_song.detach();
        } else {
          var song_row = document.createElement("li");
          song_row.style.fontSize = `${fontSize}px`;
          song_row.className = "song list-group-item context-menu";
          song_row.setAttribute("draggable", "true");
          song_row.setAttribute("ondragstart", "songDrag(event)");
          song_row.setAttribute("songid", song_id);
          song_row.textContent = `${title} by ${artist} (${time})`;
        }

        if ($(element).is("li")) {
          $(element).after(song_row);
        } else if ($(element).is("div")) {
          $(element).find("ul.active").append(song_row);
        } else {
          $(element).append(song_row);
        }
        saveHoldingTankToStore();
      }
    });
  } else {
    // Fallback to legacy database access
    if (typeof db !== 'undefined') {
      var stmt = db.prepare("SELECT * from mrvoice WHERE id = ?");
      var row = stmt.get(song_id);
      var title = row.title || "[Unknown Title]";
      var artist = row.artist || "[Unknown Artist]";
      var time = row.time || "[??:??]";

      var existing_song = $(
        `.holding_tank.active .list-group-item[songid=${song_id}]`
      );
      if (existing_song.length) {
        var song_row = existing_song.detach();
      } else {
        var song_row = document.createElement("li");
        song_row.style.fontSize = `${fontSize}px`;
        song_row.className = "song list-group-item context-menu";
        song_row.setAttribute("draggable", "true");
        song_row.setAttribute("ondragstart", "songDrag(event)");
        song_row.setAttribute("songid", song_id);
        song_row.textContent = `${title} by ${artist} (${time})`;
      }

      if ($(element).is("li")) {
        $(element).after(song_row);
      } else if ($(element).is("div")) {
        $(element).find("ul.active").append(song_row);
      } else {
        $(element).append(song_row);
      }
      saveHoldingTankToStore();
    }
  }
}

/**
 * Populate hotkeys with data
 * Sets song IDs and labels for hotkey elements
 * 
 * @param {Object} fkeys - Object containing hotkey data
 * @param {string} title - Title for the hotkey tab
 */
function populateHotkeys(fkeys, title) {
  for (var key in fkeys) {
    if (fkeys[key]) {
      try {
        $(`.hotkeys.active #${key}_hotkey`).attr("songid", fkeys[key]);
        setLabelFromSongId(fkeys[key], $(`.hotkeys.active #${key}_hotkey`));
      } catch (err) {
        console.log(`Error loading fkey ${key} (DB ID: ${fkeys[key]})`);
      }
    } else {
      $(`.hotkeys.active #${key}_hotkey`).removeAttr("songid");
      $(`.hotkeys.active #${key}_hotkey span`).html("");
    }
  }
  if (title) {
    $("#hotkey_tabs li a.active").text(title);
  }
}

/**
 * Populate holding tank with song IDs
 * Adds songs to the holding tank UI based on song IDs
 * 
 * @param {Array} songIds - Array of song IDs to add
 */
function populateHoldingTank(songIds) {
  $(".holding_tank.active").empty();
  songIds.forEach((songId) => {
    addToHoldingTank(songId, $(".holding_tank.active"));
  });
  scale_scrollable();
  return false;
}

/**
 * Populate categories modal
 * Fetches categories from database and populates the categories modal
 */
function populateCategoriesModal() {
  $("#categoryList").find("div.row").remove();

  const stmt = db.prepare("SELECT * FROM categories ORDER BY description ASC");
  for (const row of stmt.iterate()) {
    $("#categoryList").append(`<div class="form-group row">

      <div class="col-sm-8">
        <div catcode="${row.code}" class="category-description">${row.description}</div>
        <input style="display: none;" type="text" class="form-control form-control-sm categoryDescription" catcode="${row.code}" id="categoryDescription-${row.code}" value="${row.description}" required>
      </div>
      <div class="col-sm-4">
      <a href="#" class="btn btn-primary btn-xs" onclick="editCategory('${row.code}')">Edit</a>&nbsp;
      <a class="delete_link btn btn-danger btn-xs" href="#" onclick="deleteCategory(event,'${row.code}','${row.description}')">Delete</a>
      </div>

    `);
  }
}

export {
  populateCategorySelect,
  setLabelFromSongId,
  addToHoldingTank,
  populateHotkeys,
  populateHoldingTank,
  populateCategoriesModal
};

// Default export for module loading
export default {
  populateCategorySelect,
  setLabelFromSongId,
  addToHoldingTank,
  populateHotkeys,
  populateHoldingTank,
  populateCategoriesModal
}; 