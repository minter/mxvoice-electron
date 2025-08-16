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
import Dom from '../dom-utils/index.js';

// Global variables
let fontSize = 11;
let categories = {};

/**
 * Add song to holding tank
 * Fetches song data by ID and adds it to the holding tank UI
 * 
 * @param {string} song_id - The song ID to add
 * @param {Element|string} element - The element to add the song to (or selector)
 */
async function addToHoldingTank(song_id, element) {
  try {
    const currentFontSize = 11; // Default font size since getFontSize was removed
    
    debugLog?.info('addToHoldingTank called with song_id', { 
      module: 'data-population',
      function: 'addToHoldingTank',
      songId: song_id
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

      const existing_song = document.querySelector(`.holding_tank.active .list-group-item[songid="${song_id}"]`);
      let song_row;
      if (existing_song) {
        song_row = existing_song;
      } else {
        song_row = document.createElement("li");
        song_row.style.fontSize = `${currentFontSize}px`;
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
      // Song not found in database - this is expected when songs are deleted
      debugLog?.info('Song not found in database (likely deleted)', { 
        module: 'data-population',
        function: 'addToHoldingTank',
        songId: song_id
      });
      return { success: false, error: 'Song not found', skipped: true };
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
  
  Dom.empty('.holding_tank.active');
  
  let addedCount = 0;
  let skippedCount = 0;
  
  songIds.forEach((songId) => {
    if (songId && songId.trim()) {
      debugLog?.info('Adding song ID to holding tank', { 
        module: 'data-population',
        function: 'populateHoldingTank',
        songId: songId
      });
      
      const result = addToHoldingTank(songId.trim(), Dom.$('.holding_tank.active'));
      if (result.success) {
        addedCount++;
      } else if (result.skipped) {
        skippedCount++;
      }
    } else {
      debugLog?.warn('Skipping empty or invalid song ID', { 
        module: 'data-population',
        function: 'populateHoldingTank',
        songId: songId
      });
    }
  });
  
  debugLog?.info('Holding tank population completed', { 
    module: 'data-population',
    function: 'populateHoldingTank',
    totalRequested: songIds.length,
    added: addedCount,
    skipped: skippedCount
  });
  
  scaleScrollable();
  return { success: true, added: addedCount, skipped: skippedCount };
}

export {
  addToHoldingTank,
  populateHoldingTank
};

// Default export for module loading
export default {
  addToHoldingTank,
  populateHoldingTank
}; 