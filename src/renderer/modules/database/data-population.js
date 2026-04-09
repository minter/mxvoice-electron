/**
 * Data Population Module
 * 
 * Handles populating UI elements with data from the database
 * 
 * PHASE 2 SECURITY MIGRATION: Now uses secure adapters for all database operations
 */

// Import secure adapters for Phase 2 migration
import { secureDatabase } from '../adapters/secure-adapter.js';
import { songDrag } from '../drag-drop/drag-drop-functions.js';

// Import debug logger
let debugLog = null;
try {
  // Try to get debug logger from global scope
  if (window.debugLog) {
    debugLog = window.debugLog;
  }
} catch (_error) {
  // Debug logger not available
}

import Dom from '../dom-utils/index.js';

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
    
    const result = await secureDatabase.getSongById(song_id);
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
      window.secureElectronAPI?.analytics?.trackEvent?.('holding_tank_used', { action: 'add' });
      
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
 * Fetches all songs in a single batch query and adds them to the holding tank UI
 *
 * @param {Array} songIds - Array of song IDs to add
 * @returns {Promise<{success: boolean, added?: number, skipped?: number, error?: string}>}
 */
async function populateHoldingTank(songIds) {
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
    return Promise.resolve({ success: false, error: 'No song IDs provided' });
  }

  Dom.empty('.holding_tank.active');

  // Filter to valid IDs
  const validIds = songIds.filter(id => id && id.trim()).map(id => id.trim());

  if (validIds.length === 0) {
    return { success: true, added: 0, skipped: songIds.length };
  }

  // Batch query: fetch all songs in one query instead of N individual queries
  let songsMap = new Map();
  try {
    const result = await secureDatabase.getSongsByIds(validIds);
    const rows = result?.data || result || [];
    if (Array.isArray(rows)) {
      rows.forEach(row => songsMap.set(String(row.id), row));
    }
  } catch (error) {
    debugLog?.error('Batch query for holding tank songs failed', {
      module: 'data-population',
      function: 'populateHoldingTank',
      error: error?.message
    });
    return { success: false, error: error?.message };
  }

  let addedCount = 0;
  let skippedCount = 0;
  const currentFontSize = 11;
  const targetEl = Dom.$('.holding_tank.active');

  // Add songs in original order, using the pre-fetched data
  for (const songId of validIds) {
    const row = songsMap.get(songId);
    if (!row) {
      debugLog?.info('Song not found in database (likely deleted)', {
        module: 'data-population',
        function: 'populateHoldingTank',
        songId: songId
      });
      skippedCount++;
      continue;
    }

    const title = row.title || "[Unknown Title]";
    const artist = row.artist || "[Unknown Artist]";
    const time = row.time || "[??:??]";

    const existing_song = document.querySelector(`.holding_tank.active .list-group-item[songid="${songId}"]`);
    let song_row;
    if (existing_song) {
      song_row = existing_song;
    } else {
      song_row = document.createElement("li");
      song_row.style.fontSize = `${currentFontSize}px`;
      song_row.className = "song list-group-item context-menu";
      song_row.setAttribute("draggable", "true");
      song_row.addEventListener('dragstart', songDrag);
      song_row.setAttribute("songid", songId);
      song_row.textContent = `${title} by ${artist} (${time})`;
    }

    if (targetEl) {
      const ul = targetEl.querySelector('ul.active');
      (ul || targetEl).appendChild(song_row);
    }

    addedCount++;
  }

  if (typeof window.saveHoldingTankToStore === 'function') {
    window.saveHoldingTankToStore();
  }

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