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
  debugLog?.info('Initializing Holding Tank module', { 
    module: 'holding-tank',
    function: 'initHoldingTank'
  });
  
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
    debugLog?.warn('Failed to initialize holding tank', { 
      module: 'holding-tank',
      function: 'initHoldingTank',
      error: error.message
    });
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
        debugLog?.info('Holding tank saved to store', { 
          module: 'holding-tank',
          function: 'saveHoldingTankToStore'
        });
      } else {
        debugLog?.warn('Failed to save holding tank', { 
          module: 'holding-tank',
          function: 'saveHoldingTankToStore',
          error: result.error
        });
      }
      return result;
    }).catch(error => {
      debugLog?.warn('Store save error', { 
        module: 'holding-tank',
        function: 'saveHoldingTankToStore',
        error: error.message
      });
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
          debugLog?.info('Holding tank loaded from store', { 
            module: 'holding-tank',
            function: 'loadHoldingTankFromStore'
          });
          return { success: true, data: storedHtml };
        } else {
          debugLog?.warn('Invalid holding tank data in store', { 
            module: 'holding-tank',
            function: 'loadHoldingTankFromStore'
          });
          return { success: false, error: 'Invalid data format' };
        }
      });
    } else {
      debugLog?.info('No holding tank data in store', { 
        module: 'holding-tank',
        function: 'loadHoldingTankFromStore'
      });
      return { success: true, data: null };
    }
  }).catch(error => {
    debugLog?.warn('Store load error', { 
      module: 'holding-tank',
      function: 'loadHoldingTankFromStore',
      error: error.message
    });
    return { success: false, error: error.message };
  });
}

/**
 * Populate holding tank with song IDs
 */
export function populateHoldingTank(songIds) {
  debugLog?.info('populateHoldingTank called with song IDs', { 
    module: 'holding-tank',
    function: 'populateHoldingTank',
    songIds: songIds,
    databaseAvailable: !!window.electronAPI?.database
  });
  
  if (!songIds || songIds.length === 0) {
    debugLog?.warn('No song IDs provided to populateHoldingTank', { 
      module: 'holding-tank',
      function: 'populateHoldingTank'
    });
    return { success: false, error: 'No song IDs provided' };
  }
  
  $(".holding_tank.active").empty();
  debugLog?.info('Cleared active holding tank', { 
    module: 'holding-tank',
    function: 'populateHoldingTank'
  });
  
  songIds.forEach((songId) => {
    debugLog?.info('Adding song ID to holding tank', { 
      module: 'holding-tank',
      function: 'populateHoldingTank',
      songId: songId
    });
    addToHoldingTank(songId, $(".holding_tank.active"));
  });
  
  scale_scrollable();
  debugLog?.info('populateHoldingTank completed successfully', { 
    module: 'holding-tank',
    function: 'populateHoldingTank',
    count: songIds.length
  });
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
      debugLog?.warn('Failed to get song by ID', { 
        module: 'holding-tank',
        function: 'addToHoldingTank',
        songId: song_id,
        error: result.error
      });
      return { success: false, error: 'Song not found' };
    }
  }).catch(error => {
    debugLog?.warn('Database API error', { 
      module: 'holding-tank',
      function: 'addToHoldingTank',
      songId: song_id,
      error: error.message
    });
    return { success: false, error: error.message };
  });
}

/**
 * Remove a song from the holding tank
 */
export function removeFromHoldingTank() {
  var songId = $("#selected_row").attr("songid");
  if (songId) {
    debugLog?.info('Preparing to remove song from holding tank', { 
      module: 'holding-tank',
      function: 'removeFromHoldingTank',
      songId: songId
    });
    
    return database.query("SELECT * FROM mrvoice WHERE ID = ?", [songId]).then(result => {
      if (result.success && result.data.length > 0) {
        var songRow = result.data[0];
        
        return customConfirm(`Are you sure you want to remove ${songRow.title} from the holding tank?`).then(confirmed => {
          if (confirmed) {
            debugLog?.info('Proceeding with removal from holding tank', { 
              module: 'holding-tank',
              function: 'removeFromHoldingTank',
              songId: songId
            });
            // Remove the selected row from the holding tank
            $("#selected_row").remove();
            // Clear the selection
            $("#selected_row").removeAttr("id");
            // Save the updated holding tank to store
            saveHoldingTankToStore();
            return { success: true, songId: songId, title: songRow.title };
          } else {
            return { success: false, error: 'User cancelled' };
          }
        });
      } else {
        debugLog?.error('Song not found in database for ID', { 
          module: 'holding-tank',
          function: 'removeFromHoldingTank',
          songId: songId
        });
        return { success: false, error: 'Song not found' };
      }
    }).catch(error => {
      debugLog?.warn('Database API error', { 
        module: 'holding-tank',
        function: 'removeFromHoldingTank',
        songId: songId,
        error: error.message
      });
      return { success: false, error: error.message };
    });
  } else {
    debugLog?.info('No songId found on selected row', { 
      module: 'holding-tank',
      function: 'removeFromHoldingTank'
    });
    return Promise.resolve({ success: false, error: 'No song selected' });
  }
}

/**
 * Clear all songs from the holding tank
 */
export async function clearHoldingTank() {
  const confirmed = await customConfirm("Are you sure you want clear your holding tank?");
  if (confirmed) {
    $(".holding_tank.active").empty();
    saveHoldingTankToStore();
    return { success: true };
  } else {
    return { success: false, error: 'User cancelled' };
  }
}

/**
 * Open holding tank file
 */
export function openHoldingTankFile() {
  if (window.electronAPI) {
    return window.electronAPI.openHoldingTankFile().catch(error => {
      debugLog?.warn('Modern API failed, falling back to legacy', { 
        module: 'holding-tank',
        function: 'openHoldingTankFile',
        error: error.message
      });
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
  debugLog?.info('Renderer starting saveHoldingTankFile', { 
    module: 'holding-tank',
    function: 'saveHoldingTankFile'
  });
  var holdingTankArray = [];
  $(".holding_tank.active .list-group-item").each(function () {
    holdingTankArray.push($(this).attr("songid"));
  });
  
  if (window.electronAPI) {
    return window.electronAPI.saveHoldingTankFile(holdingTankArray).catch(error => {
      debugLog?.warn('Modern API failed, falling back to legacy', { 
        module: 'holding-tank',
        function: 'saveHoldingTankFile',
        error: error.message
      });
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
export async function renameHoldingTankTab() {
  const currentName = $("#holding_tank_tabs .nav-link.active").text();
  const newName = await customPrompt("Enter a new name for this tab:", currentName, "Rename Holding Tank Tab");
  if (newName && newName.trim() !== "") {
    $("#holding_tank_tabs .nav-link.active").text(newName);
    saveHoldingTankToStore();
    return { success: true, newName: newName };
  } else {
    return { success: false, error: 'Invalid name' };
  }
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