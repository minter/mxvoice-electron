/**
 * Data Population Module
 * 
 * Handles populating UI elements with data from the database
 * 
 * PHASE 2 SECURITY MIGRATION: Now uses secure adapters for all database operations
 */

// Import secure adapters for Phase 2 migration
import { secureDatabase, secureStore } from '../adapters/secure-adapter.js';
import { songDrag } from '../drag-drop/drag-drop-functions.js';

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
async function populateCategorySelect() {
  try {
    debugLog?.info('Populating categories', { 
      module: 'data-population',
      function: 'populateCategorySelect'
    });
    
    $("#category_select option").remove();
    $("#category_select").append(`<option value="*">All Categories</option>`);
    
    const result = await secureDatabase.getCategories();
    const data = result.data || result;
    
    if (data && Array.isArray(data)) {
      data.forEach(row => {
        categories[row.code] = row.description;
        $("#category_select").append(
          `<option value="${row.code}">${row.description}</option>`
        );
      });
      
      debugLog?.info('Categories populated successfully', { 
        module: 'data-population',
        function: 'populateCategorySelect',
        count: data.length
      });
    } else {
      debugLog?.warn('No categories found or invalid data format', { 
        module: 'data-population',
        function: 'populateCategorySelect',
        result: result
      });
    }
  } catch (error) {
    debugLog?.error('Failed to populate categories', { 
      module: 'data-population',
      function: 'populateCategorySelect',
      error: error.message
    });
    throw error;
  }
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
      }
    }).catch(error => {
      debugLog?.warn('Database API error', { 
        module: 'data-population',
        function: 'setLabelFromSongId',
        songId: song_id,
        error: error.message
      });
    });
  }
}

/**
 * Add song to holding tank
 * Fetches song data by ID and adds it to the holding tank UI
 * 
 * @param {string} song_id - The song ID to add
 * @param {jQuery} element - The element to add the song to
 */
async function addToHoldingTank(song_id, element) {
  try {
    const currentFontSize = getFontSize();
    debugLog?.info('addToHoldingTank called with song_id', { 
      module: 'data-population',
      function: 'addToHoldingTank',
      songId: song_id,
      fontSize: currentFontSize
    });
    
    const result = await secureDatabase.query("SELECT * from mrvoice WHERE id = ?", [song_id]);
    const data = result.data || result;
    
    if (data && data.length > 0) {
      const row = data[0];
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
      let song_row;
      if (existing_song.length) {
        song_row = existing_song.detach();
      } else {
        song_row = document.createElement("li");
        song_row.style.fontSize = `${currentFontSize}px`;
        song_row.className = "song list-group-item context-menu";
        song_row.setAttribute("draggable", "true");
        song_row.addEventListener('dragstart', songDrag);
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
      
      debugLog?.info('Song added to holding tank successfully', { 
        module: 'data-population',
        function: 'addToHoldingTank',
        songId: song_id
      });
      
      return { success: true, songId: song_id, title: title };
    } else {
      debugLog?.warn('No song data found', { 
        module: 'data-population',
        function: 'addToHoldingTank',
        songId: song_id
      });
      return { success: false, error: 'Song not found' };
    }
  } catch (error) {
    debugLog?.error('Error in addToHoldingTank', { 
      module: 'data-population',
      function: 'addToHoldingTank',
      songId: song_id,
      error: error.message
    });
    return { success: false, error: error.message };
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
  // Removed legacy direct DB usage
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