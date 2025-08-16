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
// Import secure adapters
import { secureStore, secureDatabase } from '../adapters/secure-adapter.js';
import { songDrag } from '../drag-drop/drag-drop-functions.js';
const store = secureStore;
const database = secureDatabase;
import Dom from '../dom-utils/index.js';
// Import secure adapters
import { secureFileSystem, securePath, secureFileDialog } from '../adapters/secure-adapter.js';
const fileSystem = secureFileSystem;
const path = securePath;

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
  const currentHtml = Dom.html('#holding-tank-column');
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
          Dom.html('#holding-tank-column', storedHtml);
          Dom.removeAttr('#selected_row', 'id');
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
  
  Dom.empty('.holding_tank.active');
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
    addToHoldingTank(songId, Dom.$('.holding_tank.active'));
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
      const row = result.data[0];
      const title = row.title || "[Unknown Title]";
      const artist = row.artist || "[Unknown Artist]";
      const time = row.time || "[??:??]";

      const existing_song = document.querySelector(`.holding_tank.active .list-group-item[songid="${song_id}"]`);
      let song_row;
      if (existing_song) {
        song_row = existing_song; // already in DOM; will be moved below
      } else {
        const song_row = document.createElement("li");
        song_row.style.fontSize = `${getFontSize()}px`;
        song_row.className = "song list-group-item context-menu";
        song_row.setAttribute("draggable", "true");
        song_row.addEventListener('dragstart', songDrag);
        song_row.setAttribute("songid", song_id);
        song_row.textContent = `${title} by ${artist} (${time})`;
      }

      const targetEl = element && element.nodeType ? element : Dom.$(element);
      if (targetEl?.matches?.('li')) {
        targetEl.insertAdjacentElement('afterend', song_row);
      } else if (targetEl?.matches?.('div')) {
        const ul = targetEl.querySelector('ul.active');
        (ul || targetEl).appendChild(song_row);
      } else if (targetEl?.appendChild) {
        targetEl.appendChild(song_row);
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
  const songId = Dom.attr('#selected_row', 'songid');
  if (songId) {
    debugLog?.info('Preparing to remove song from holding tank', { 
      module: 'holding-tank',
      function: 'removeFromHoldingTank',
      songId: songId
    });
    
    return database.query("SELECT * FROM mrvoice WHERE ID = ?", [songId]).then(result => {
      if (result.success && result.data.length > 0) {
        const songRow = result.data[0];
        
        return customConfirm(`Are you sure you want to remove ${songRow.title} from the holding tank?`).then(confirmed => {
          if (confirmed) {
            debugLog?.info('Proceeding with removal from holding tank', { 
              module: 'holding-tank',
              function: 'removeFromHoldingTank',
              songId: songId
            });
            // Remove the selected row from the holding tank
            const selected = document.getElementById('selected_row');
            if (selected) selected.parentElement?.removeChild(selected);
            // Clear the selection
            document.getElementById('selected_row')?.removeAttribute('id');
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
    Dom.empty('.holding_tank.active');
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
  return secureFileDialog.openHoldingTankFile();
}

/**
 * Save holding tank to file
 */
export function saveHoldingTankFile() {
  debugLog?.info('Renderer starting saveHoldingTankFile', { 
    module: 'holding-tank',
    function: 'saveHoldingTankFile'
  });
  const holdingTankArray = [];
  document.querySelectorAll('.holding_tank.active .list-group-item').forEach(el => {
    holdingTankArray.push(el.getAttribute('songid'));
  });
  return secureFileDialog.saveHoldingTankFile(holdingTankArray);
}

// Mode management functions moved to dedicated mode-management module

/**
 * Handle drag and drop for holding tank
 */
export function holdingTankDrop(event) {
  event.preventDefault();
  addToHoldingTank(event.dataTransfer.getData("text"), event.target);
}

/**
 * Send selected song to holding tank
 */
export function sendToHoldingTank() {
  target = Dom.$('.holding_tank.active');
  song_id = Dom.attr('#selected_row', 'songid');
  if (song_id) {
    addToHoldingTank(song_id, target);
  }
  return false;
}

/**
 * Rename holding tank tab
 */
export async function renameHoldingTankTab() {
  const currentName = Dom.text('#holding_tank_tabs .nav-link.active');
  const newName = await customPrompt("Enter a new name for this tab:", currentName, "Rename Holding Tank Tab");
  if (newName && newName.trim() !== "") {
    Dom.text('#holding_tank_tabs .nav-link.active', newName);
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
  {
    const col = Dom.$('#holding-tank-column');
    const sel = Dom.$('#selected_row');
    if (!(col && sel && col.contains(sel))) {
    // Only cancel autoplay if we're not in the holding tank
    if (holdingTankMode === "playlist") {
      autoplay = false;
      setHoldingTankMode("storage");
    }
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
  const isAdvancedVisible = Dom.isVisible('#advanced-search');
  const advancedHeight = isAdvancedVisible ? 38 : 0;
  const height = (window.innerHeight || document.documentElement.clientHeight) - 240 - advancedHeight + 'px';
  document.querySelectorAll('.table-wrapper-scroll-y').forEach(el => { el.style.height = height; });
}

/**
 * Wrapper for clearHoldingTank - handles async operations for Function Registry
 */
function clearHoldingTankWrapper() {
  clearHoldingTank().catch(error => {
    debugLog?.error('Error in clearHoldingTank', error);
  });
}

/**
 * Wrapper for renameHoldingTankTab - handles async operations for Function Registry  
 */
function renameHoldingTankTabWrapper() {
  renameHoldingTankTab().catch(error => {
    debugLog?.error('Error in renameHoldingTankTab', error);
  });
}

/**
 * Wrapper for saveHoldingTankToStore - includes state updates for Function Registry
 */
function saveHoldingTankToStoreWrapper() {
  debugLog?.info('Saving holding tank to store and refreshing display');
  saveHoldingTankToStore().then(() => {
    debugLog?.info('Holding tank saved successfully');
    // Optionally adjust layout without repopulating
    try { 
      scale_scrollable(); 
    } catch (error) {
      debugLog?.warn('Failed to scale scrollable elements after saving', { 
        module: 'holding-tank', 
        function: 'saveHoldingTankToStoreWrapper',
        error: error?.message || 'Unknown error' 
      });
    }
  }).catch(error => {
    debugLog?.error('Error saving holding tank to store', error);
  });
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
  scale_scrollable,
  // Wrapper functions for Function Registry HTML compatibility
  clearHoldingTankWrapper,
  renameHoldingTankTabWrapper,
  saveHoldingTankToStoreWrapper
}; 