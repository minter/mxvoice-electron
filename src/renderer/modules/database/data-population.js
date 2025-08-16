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
    
    {
      const sel = document.getElementById('category_select');
      if (sel) {
        sel.innerHTML = '';
        const opt = document.createElement('option');
        opt.value = '*';
        opt.textContent = 'All Categories';
        sel.appendChild(opt);
      }
    }
    
    const result = await secureDatabase.getCategories();
    const data = result.data || result;
    
    if (data && Array.isArray(data)) {
      data.forEach(row => {
        categories[row.code] = row.description;
        const sel = document.getElementById('category_select');
        if (sel) {
          const opt = document.createElement('option');
          opt.value = row.code;
          opt.textContent = row.description;
          sel.appendChild(opt);
        }
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
 * @param {Element|string} element - The element to set the label for (or selector)
 */
function setLabelFromSongId(song_id, element) {
  // Use new database API for getting song by ID
      if (window.secureElectronAPI && window.secureElectronAPI.database) {
      window.secureElectronAPI.database.query("SELECT * from mrvoice WHERE id = ?", [song_id]).then(result => {
      if (result.success && result.data.length > 0) {
        const row = result.data[0];
        const title = row.title || "[Unknown Title]";
        const artist = row.artist || "[Unknown Artist]";
        const time = row.time || "[??:??]";
        
        // Handle swapping
        const original_song_node = Array.from(document.querySelectorAll(`.hotkeys.active li[songid="${song_id}"]`)).filter(el => el !== (typeof element === 'string' ? document.querySelector(element) : element));
        debugLog?.info('Original song node found', { 
          module: 'data-population',
          function: 'setLabelFromSongId',
          songId: song_id,
          originalNode: original_song_node.length
        });
        if (original_song_node.length) {
          const originalNode = original_song_node[0];
          const oldSong = originalNode.querySelector('span');
          const destParent = (typeof element === 'string' ? document.querySelector(element) : element);
          const destSpan = destParent?.querySelector('span');
          if (destSpan && destSpan.parentNode) destSpan.parentNode.removeChild(destSpan);
          if (oldSong && oldSong.parentNode) oldSong.parentNode.removeChild(oldSong);
          if (destSpan) originalNode.appendChild(destSpan);
          if (destSpan?.getAttribute('songid')) {
            originalNode.setAttribute('songid', destSpan.getAttribute('songid'));
          } else {
            originalNode.removeAttribute('songid');
          }
          if (oldSong && destParent) destParent.appendChild(oldSong);
        } else {
          const destParent = (typeof element === 'string' ? document.querySelector(element) : element);
          const span = destParent?.querySelector('span');
          if (span) {
            span.textContent = `${title} by ${artist} (${time})`;
            span.setAttribute('songid', String(song_id));
          }
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
 * @param {Element|string} element - The element to add the song to (or selector)
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
        const el = document.querySelector(`.hotkeys.active #${key}_hotkey`);
        if (el) el.setAttribute('songid', fkeys[key]);
        setLabelFromSongId(fkeys[key], el);
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
      const el = document.querySelector(`.hotkeys.active #${key}_hotkey`);
      if (el) {
        el.removeAttribute('songid');
        const span = el.querySelector('span');
        if (span) span.textContent = '';
      }
    }
  }
  if (title) {
    const link = document.querySelector('#hotkey_tabs li a.active');
    if (link) link.textContent = title;
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
  songIds.forEach((songId) => {
    if (songId && songId.trim()) {
      debugLog?.info('Adding song ID to holding tank', { 
        module: 'data-population',
        function: 'populateHoldingTank',
        songId: songId
      });
    addToHoldingTank(songId.trim(), Dom.$('.holding_tank.active'));
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
  const list = document.getElementById('categoryList');
  if (list) Array.from(list.querySelectorAll('div.row')).forEach(n => n.remove());
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