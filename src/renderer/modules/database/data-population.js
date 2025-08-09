/**
 * Data Population Module
 * 
 * Handles populating UI elements with data from the database
 */

// Import debug logger
let debugLog = null;
try {
  // Try to get debug logger from global scope
  if (window.debugLog) {
    debugLog = window.debugLog;
  }
} catch (error) {
  // Debug logger not available
}

// Import shared state
import sharedState from '../shared-state.js';

// Global variables
let fontSize = 11;
let categories = {};

/**
 * Get fontSize from shared state or use default
 * 
 * @returns {number} - Font size to use
 */
function getFontSize() {
  try {
    const sharedFontSize = sharedState.get('fontSize');
    if (sharedFontSize !== undefined && sharedFontSize !== null) {
      return sharedFontSize;
    }
  } catch (error) {
    debugLog?.warn('Error getting fontSize from shared state', { 
      module: 'data-population',
      function: 'getFontSize',
      error: error.message
    });
  }
  
  // Fallback to global fontSize if available
  if (typeof window.fontSize !== 'undefined') {
    return window.fontSize;
  }
  
  return fontSize; // Default fallback
}

/**
 * Populate category select dropdown
 * Fetches categories from database and populates the category select dropdown
 */
function populateCategorySelect() {
  debugLog?.info('Populating categories', { 
    module: 'data-population',
    function: 'populateCategorySelect'
  });
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
          debugLog?.info('Categories populated successfully via API', { 
            module: 'data-population',
            function: 'populateCategorySelect'
          });
          resolve();
        } else {
          debugLog?.warn('Failed to get categories', { 
            module: 'data-population',
            function: 'populateCategorySelect',
            error: result.error
          });
          // Fallback to legacy database access
          if (typeof db !== 'undefined') {
            try {
              const stmt = db.prepare("SELECT * FROM categories ORDER BY description ASC");
              for (const row of stmt.iterate()) {
                categories[row.code] = row.description;
                $("#category_select").append(
                  `<option value="${row.code}">${row.description}</option>`
                );
              }
              debugLog?.info('Categories populated successfully via legacy DB', { 
                module: 'data-population',
                function: 'populateCategorySelect'
              });
              resolve();
            } catch (error) {
              debugLog?.error('Legacy database error', { 
                module: 'data-population',
                function: 'populateCategorySelect',
                error: error.message
              });
              reject(error);
            }
          } else {
            reject(new Error('No database access available'));
          }
        }
      }).catch(error => {
        debugLog?.warn('Database API error', { 
          module: 'data-population',
          function: 'populateCategorySelect',
          error: error.message
        });
        // Fallback to legacy database access
        if (typeof db !== 'undefined') {
          try {
            const stmt = db.prepare("SELECT * FROM categories ORDER BY description ASC");
            for (const row of stmt.iterate()) {
              categories[row.code] = row.description;
              $("#category_select").append(
                `<option value="${row.code}">${row.description}</option>`
              );
            }
            debugLog?.info('Categories populated successfully via legacy DB (fallback)', { 
              module: 'data-population',
              function: 'populateCategorySelect'
            });
            resolve();
          } catch (dbError) {
            debugLog?.error('Legacy database error', { 
              module: 'data-population',
              function: 'populateCategorySelect',
              error: dbError.message
            });
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
          const stmt = db.prepare("SELECT * FROM categories ORDER BY description ASC");
          for (const row of stmt.iterate()) {
            categories[row.code] = row.description;
            $("#category_select").append(
              `<option value="${row.code}">${row.description}</option>`
            );
          }
          debugLog?.info('Categories populated successfully via legacy DB (no API)', { 
            module: 'data-population',
            function: 'populateCategorySelect'
          });
          resolve();
        } catch (error) {
          debugLog?.error('Legacy database error', { 
            module: 'data-population',
            function: 'populateCategorySelect',
            error: error.message
          });
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
        const row = result.data[0];
        const title = row.title || "[Unknown Title]";
        const artist = row.artist || "[Unknown Artist]";
        const time = row.time || "[??:??]";
        
        // Handle swapping
        const original_song_node = $(`.hotkeys.active li[songid=${song_id}]`).not(
          element
        );
        debugLog?.info('Original song node found', { 
          module: 'data-population',
          function: 'setLabelFromSongId',
          songId: song_id,
          originalNode: original_song_node.length
        });
        if (original_song_node.length) {
          const old_song = original_song_node.find("span").detach();
          const destination_song = $(element).find("span").detach();
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
        debugLog?.warn('Failed to get song by ID', { 
          module: 'data-population',
          function: 'setLabelFromSongId',
          songId: song_id,
          error: result.error
        });
        // Fallback to legacy database access
        if (typeof db !== 'undefined') {
          const stmt = db.prepare("SELECT * from mrvoice WHERE id = ?");
          const row = stmt.get(song_id);
          const title = row.title || "[Unknown Title]";
          const artist = row.artist || "[Unknown Artist]";
          const time = row.time || "[??:??]";

          // Handle swapping
          const original_song_node = $(`.hotkeys.active li[songid=${song_id}]`).not(
            element
          );
          debugLog?.info('Original song node found (legacy)', { 
            module: 'data-population',
            function: 'setLabelFromSongId',
            songId: song_id,
            originalNode: original_song_node.length
          });
          if (original_song_node.length) {
            const old_song = original_song_node.find("span").detach();
            const destination_song = $(element).find("span").detach();
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
      debugLog?.warn('Database API error', { 
        module: 'data-population',
        function: 'setLabelFromSongId',
        songId: song_id,
        error: error.message
      });
      // Fallback to legacy database access
      if (typeof db !== 'undefined') {
        const stmt = db.prepare("SELECT * from mrvoice WHERE id = ?");
        const row = stmt.get(song_id);
        const title = row.title || "[Unknown Title]";
        const artist = row.artist || "[Unknown Artist]";
        const time = row.time || "[??:??]";

        // Handle swapping
        const original_song_node = $(`.hotkeys.active li[songid=${song_id}]`).not(
          element
        );
        debugLog?.info('Original song node found (legacy fallback)', { 
          module: 'data-population',
          function: 'setLabelFromSongId',
          songId: song_id,
          originalNode: original_song_node.length
        });
        if (original_song_node.length) {
          const old_song = original_song_node.find("span").detach();
          const destination_song = $(element).find("span").detach();
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
      const stmt = db.prepare("SELECT * from mrvoice WHERE id = ?");
      const row = stmt.get(song_id);
      const title = row.title || "[Unknown Title]";
      const artist = row.artist || "[Unknown Artist]";
      const time = row.time || "[??:??]";

      // Handle swapping
      const original_song_node = $(`.hotkeys.active li[songid=${song_id}]`).not(
        element
      );
      debugLog?.info('Original song node found (legacy no API)', { 
        module: 'data-population',
        function: 'setLabelFromSongId',
        songId: song_id,
        originalNode: original_song_node.length
      });
      if (original_song_node.length) {
        const old_song = original_song_node.find("span").detach();
        const destination_song = $(element).find("span").detach();
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
  const currentFontSize = getFontSize();
  debugLog?.info('addToHoldingTank called with song_id', { 
    module: 'data-population',
    function: 'addToHoldingTank',
    songId: song_id,
    fontSize: currentFontSize
  });
  
  // Use new database API for getting song by ID
  if (window.electronAPI && window.electronAPI.database) {
    window.electronAPI.database.query("SELECT * from mrvoice WHERE id = ?", [song_id]).then(result => {
      if (result.success && result.data.length > 0) {
        const row = result.data[0];
        const title = row.title || "[Unknown Title]";
        const artist = row.artist || "[Unknown Artist]";
        const time = row.time || "[??:??]";

        debugLog?.info('Song data retrieved', { 
          module: 'data-population',
          function: 'addToHoldingTank',
          songId: song_id,
          title: title,
          artist: artist,
          time: time
        });

        const existing_song = $(
          `.holding_tank.active .list-group-item[songid=${song_id}]`
        );
        if (existing_song.length) {
          const song_row = existing_song.detach();
        } else {
          const song_row = document.createElement("li");
          song_row.style.fontSize = `${currentFontSize}px`;
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
        
        debugLog?.info('Song added to holding tank successfully', { 
          module: 'data-population',
          function: 'addToHoldingTank',
          songId: song_id
        });
        if (typeof window.saveHoldingTankToStore === 'function') {
          window.saveHoldingTankToStore();
        } else {
          debugLog?.warn('saveHoldingTankToStore function not available', { 
            module: 'data-population',
            function: 'addToHoldingTank'
          });
        }
      } else {
        debugLog?.warn('Failed to get song by ID', { 
          module: 'data-population',
          function: 'addToHoldingTank',
          songId: song_id,
          error: result.error
        });
        // Fallback to legacy database access
        if (typeof db !== 'undefined') {
          const stmt = db.prepare("SELECT * from mrvoice WHERE id = ?");
          const row = stmt.get(song_id);
          const title = row.title || "[Unknown Title]";
          const artist = row.artist || "[Unknown Artist]";
          const time = row.time || "[??:??]";

          const existing_song = $(
            `.holding_tank.active .list-group-item[songid=${song_id}]`
          );
          if (existing_song.length) {
            const song_row = existing_song.detach();
          } else {
            const song_row = document.createElement("li");
            song_row.style.fontSize = `${currentFontSize}px`;
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
          if (typeof window.saveHoldingTankToStore === 'function') {
            window.saveHoldingTankToStore();
          } else {
            debugLog?.warn('saveHoldingTankToStore function not available', { 
              module: 'data-population',
              function: 'addToHoldingTank'
            });
          }
        }
      }
    }).catch(error => {
      debugLog?.warn('Database API error', { 
        module: 'data-population',
        function: 'addToHoldingTank',
        songId: song_id,
        error: error.message
      });
      // Fallback to legacy database access
      if (typeof db !== 'undefined') {
        const stmt = db.prepare("SELECT * from mrvoice WHERE id = ?");
        const row = stmt.get(song_id);
        if (!row) {
          debugLog?.warn('Song not found in database', { 
            module: 'data-population',
            function: 'addToHoldingTank',
            songId: song_id
          });
          return;
        }
        const title = row.title || "[Unknown Title]";
        const artist = row.artist || "[Unknown Artist]";
        const time = row.time || "[??:??]";

        const existing_song = $(
          `.holding_tank.active .list-group-item[songid=${song_id}]`
        );
        if (existing_song.length) {
          const song_row = existing_song.detach();
        } else {
          const song_row = document.createElement("li");
          song_row.style.fontSize = `${currentFontSize}px`;
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
        if (typeof window.saveHoldingTankToStore === 'function') {
          window.saveHoldingTankToStore();
        } else {
          debugLog?.warn('saveHoldingTankToStore function not available', { 
            module: 'data-population',
            function: 'addToHoldingTank'
          });
        }
      }
    });
  } else {
    // Fallback to legacy database access
    if (typeof db !== 'undefined') {
      const stmt = db.prepare("SELECT * from mrvoice WHERE id = ?");
      const row = stmt.get(song_id);
      const title = row.title || "[Unknown Title]";
      const artist = row.artist || "[Unknown Artist]";
      const time = row.time || "[??:??]";

      const existing_song = $(
        `.holding_tank.active .list-group-item[songid=${song_id}]`
      );
      if (existing_song.length) {
        const song_row = existing_song.detach();
      } else {
        const song_row = document.createElement("li");
        song_row.style.fontSize = `${currentFontSize}px`;
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
      if (typeof window.saveHoldingTankToStore === 'function') {
        window.saveHoldingTankToStore();
      } else {
        debugLog?.warn('saveHoldingTankToStore function not available', { 
          module: 'data-population',
          function: 'addToHoldingTank'
        });
      }
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
  for (const key in fkeys) {
    if (fkeys[key]) {
      try {
        $(`.hotkeys.active #${key}_hotkey`).attr("songid", fkeys[key]);
        setLabelFromSongId(fkeys[key], $(`.hotkeys.active #${key}_hotkey`));
      } catch (err) {
        debugLog?.warn('Error loading fkey', { 
          module: 'data-population',
          function: 'populateHotkeys',
          key: key,
          dbId: fkeys[key],
          error: err.message
        });
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
  debugLog?.info('populateHoldingTank called with song IDs', { 
    module: 'data-population',
    function: 'populateHoldingTank',
    songIds: songIds
  });
  
  if (!songIds || songIds.length === 0) {
    debugLog?.warn('No song IDs provided to populateHoldingTank', { 
      module: 'data-population',
      function: 'populateHoldingTank'
    });
    return false;
  }
  
  $(".holding_tank.active").empty();
  songIds.forEach((songId) => {
    if (songId && songId.trim()) {
      debugLog?.info('Adding song ID to holding tank', { 
        module: 'data-population',
        function: 'populateHoldingTank',
        songId: songId
      });
      addToHoldingTank(songId.trim(), $(".holding_tank.active"));
    } else {
      debugLog?.warn('Skipping empty or invalid song ID', { 
        module: 'data-population',
        function: 'populateHoldingTank',
        songId: songId
      });
    }
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