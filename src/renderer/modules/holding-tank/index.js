/**
 * Holding Tank Module
 * 
 * This module manages the holding tank functionality for Mx. Voice.
 * The holding tank can operate in two modes:
 * - Storage mode: Simple storage of songs for later use
 * - Playlist mode: Automatic playback of songs in sequence
 * 
 * Features:
 * - Add/remove songs from holding tank
 * - Save/load holding tank data
 * - Drag and drop functionality
 * - Mode switching (storage vs playlist)
 * - File import/export
 * - Tab management
 */

// Use global electronAPI instead of importing services
const store = window.electronAPI.store;
const database = window.electronAPI.database;
const fileSystem = window.electronAPI.fileSystem;
const path = window.electronAPI.path;

// Module state
let holdingTankMode = "storage"; // 'storage' or 'playlist'
let autoplay = false;
let loop = false;

/**
 * Initialize the holding tank module
 */
export function initHoldingTank() {
  console.log('Initializing Holding Tank module...');
  
  // Load saved mode or default to storage
  return store.has("holding_tank_mode").then(hasMode => {
    if (hasMode) {
      return store.get("holding_tank_mode").then(mode => {
        holdingTankMode = mode;
        setHoldingTankMode(holdingTankMode);
        return { success: true, mode: holdingTankMode };
      });
    } else {
      holdingTankMode = "storage"; // Default to storage mode
      setHoldingTankMode(holdingTankMode);
      return { success: true, mode: holdingTankMode };
    }
  }).catch(error => {
    console.warn('Failed to initialize holding tank:', error);
    return { success: false, error: error.message };
  });
}

/**
 * Save holding tank data to store
 */
export function saveHoldingTankToStore() {
  // Only save if we have the new HTML format with mode toggle
  var currentHtml = $("#holding-tank-column").html();
  if (currentHtml.includes("mode-toggle")) {
    return store.set("holding_tank", currentHtml).then(result => {
      if (result.success) {
        console.log('✅ Holding tank saved to store');
      } else {
        console.warn('❌ Failed to save holding tank:', result.error);
      }
      return result;
    }).catch(error => {
      console.warn('❌ Store save error:', error);
      return { success: false, error: error.message };
    });
  }
  return Promise.resolve({ success: false, error: 'Invalid HTML format' });
}

/**
 * Load holding tank data from store
 */
export function loadHoldingTankFromStore() {
  return store.has("holding_tank").then(hasHoldingTank => {
    if (hasHoldingTank) {
      return store.get("holding_tank").then(storedHtml => {
        if (storedHtml && typeof storedHtml === 'string') {
          $("#holding-tank-column").html(storedHtml);
          $("#selected_row").removeAttr("id");
          console.log('✅ Holding tank loaded from store');
          return { success: true, data: storedHtml };
        } else {
          console.warn('❌ Invalid holding tank data in store');
          return { success: false, error: 'Invalid data format' };
        }
      });
    } else {
      console.log('No holding tank data in store');
      return { success: true, data: null };
    }
  }).catch(error => {
    console.warn('❌ Store load error:', error);
    return { success: false, error: error.message };
  });
}

/**
 * Populate holding tank with song IDs
 */
export function populateHoldingTank(songIds) {
  console.log('🔄 populateHoldingTank called with:', songIds);
  console.log('🔄 database API available:', !!window.electronAPI?.database);
  
  if (!songIds || songIds.length === 0) {
    console.log('⚠️ No song IDs provided to populateHoldingTank');
    return { success: false, error: 'No song IDs provided' };
  }
  
  $(".holding_tank.active").empty();
  console.log('✅ Cleared active holding tank');
  
  songIds.forEach((songId) => {
    console.log('🔄 Adding song ID to holding tank:', songId);
    addToHoldingTank(songId, $(".holding_tank.active"));
  });
  
  scale_scrollable();
  console.log('✅ populateHoldingTank completed successfully');
  return { success: true, count: songIds.length };
}

/**
 * Add a song to the holding tank
 */
export function addToHoldingTank(song_id, element) {
  return database.query("SELECT * from mrvoice WHERE id = ?", [song_id]).then(result => {
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
        song_row.style.fontSize = `${getFontSize()}px`;
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
      return { success: true, songId: song_id, title: title };
    } else {
      console.warn('❌ Failed to get song by ID:', result.error);
      return { success: false, error: 'Song not found' };
    }
  }).catch(error => {
    console.warn('❌ Database API error:', error);
    return { success: false, error: error.message };
  });
}

/**
 * Remove a song from the holding tank
 */
export function removeFromHoldingTank() {
  var songId = $("#selected_row").attr("songid");
  if (songId) {
    console.log(`Preparing to remove song ${songId} from holding tank`);
    
    return database.query("SELECT * FROM mrvoice WHERE ID = ?", [songId]).then(result => {
      if (result.success && result.data.length > 0) {
        var songRow = result.data[0];
        
        return new Promise((resolve) => {
          customConfirm(`Are you sure you want to remove ${songRow.title} from the holding tank?`, function() {
            console.log("Proceeding with removal from holding tank");
            // Remove the selected row from the holding tank
            $("#selected_row").remove();
            // Clear the selection
            $("#selected_row").removeAttr("id");
            // Save the updated holding tank to store
            saveHoldingTankToStore();
            resolve({ success: true, songId: songId, title: songRow.title });
          });
        });
      } else {
        console.error("Song not found in database for ID:", songId);
        return { success: false, error: 'Song not found' };
      }
    }).catch(error => {
      console.warn('❌ Database API error:', error);
      return { success: false, error: error.message };
    });
  } else {
    console.log("No songId found on selected row");
    return Promise.resolve({ success: false, error: 'No song selected' });
  }
}

/**
 * Clear all songs from the holding tank
 */
export function clearHoldingTank() {
  return new Promise((resolve) => {
    customConfirm("Are you sure you want clear your holding tank?", function() {
      $(".holding_tank.active").empty();
      saveHoldingTankToStore();
      resolve({ success: true });
    });
  });
}

/**
 * Open holding tank file
 */
export function openHoldingTankFile() {
  if (window.electronAPI) {
    return window.electronAPI.openHoldingTankFile().catch(error => {
      console.warn('Modern API failed, falling back to legacy:', error);
      ipcRenderer.send("open-holding-tank-file");
      return { success: false, error: error.message };
    });
  } else {
    ipcRenderer.send("open-holding-tank-file");
    return Promise.resolve({ success: true });
  }
}

/**
 * Save holding tank to file
 */
export function saveHoldingTankFile() {
  console.log("Renderer starting saveHoldingTankFile");
  var holdingTankArray = [];
  $(".holding_tank.active .list-group-item").each(function () {
    holdingTankArray.push($(this).attr("songid"));
  });
  
  if (window.electronAPI) {
    return window.electronAPI.saveHoldingTankFile(holdingTankArray).catch(error => {
      console.warn('Modern API failed, falling back to legacy:', error);
      ipcRenderer.send("save-holding-tank-file", holdingTankArray);
      return { success: false, error: error.message };
    });
  } else {
    ipcRenderer.send("save-holding-tank-file", holdingTankArray);
    return Promise.resolve({ success: true });
  }
}

// Mode management functions moved to dedicated mode-management module

/**
 * Handle drag and drop for holding tank
 */
export function holdingTankDrop(event) {
  event.preventDefault();
  addToHoldingTank(event.dataTransfer.getData("text"), $(event.target));
}

/**
 * Send selected song to holding tank
 */
export function sendToHoldingTank() {
  target = $(".holding_tank.active");
  song_id = $("#selected_row").attr("songid");
  if (song_id) {
    addToHoldingTank(song_id, target);
  }
  return false;
}

/**
 * Rename holding tank tab
 */
export function renameHoldingTankTab() {
  const currentName = $("#holding_tank_tabs .nav-link.active").text();
  return new Promise((resolve) => {
    customPrompt("Rename Holding Tank Tab", "Enter a new name for this tab:", currentName, function(newName) {
      if (newName && newName.trim() !== "") {
        $("#holding_tank_tabs .nav-link.active").text(newName);
        saveHoldingTankToStore();
        resolve({ success: true, newName: newName });
      } else {
        resolve({ success: false, error: 'Invalid name' });
      }
    });
  });
}

// toggleAutoPlay function moved to mode-management module

/**
 * Cancel autoplay
 */
export function cancel_autoplay() {
  if (!$("#holding-tank-column").has($("#selected_row")).length) {
    // Only cancel autoplay if we're not in the holding tank
    if (holdingTankMode === "playlist") {
      autoplay = false;
      setHoldingTankMode("storage");
    }
  }
}

/**
 * Get font size for UI elements
 */
function getFontSize() {
  return window.fontSize || 11;
}

/**
 * Scale scrollable elements
 */
function scale_scrollable() {
  var advanced_search_height = $("#advanced-search").is(":visible") ? 38 : 0;
  if ($("#advanced-search").is(":visible")) {
    advanced_search_height = 38;
  }
  $(".table-wrapper-scroll-y").height(
    $(window).height() - 240 - advanced_search_height + "px"
  );
}

// Export all functions
export default {
  initHoldingTank,
  saveHoldingTankToStore,
  loadHoldingTankFromStore,
  populateHoldingTank,
  addToHoldingTank,
  removeFromHoldingTank,
  clearHoldingTank,
  openHoldingTankFile,
  saveHoldingTankFile,
  holdingTankDrop,
  sendToHoldingTank,
  renameHoldingTankTab,
  cancel_autoplay,
  scale_scrollable
}; 