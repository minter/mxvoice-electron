/**
 * Hotkey Data Management
 * 
 * Handles data operations for hotkeys including:
 * - Populating hotkeys with song data
 * - Setting labels from song IDs
 * - Clearing hotkey data
 * 
 * @module hotkey-data
 */

/**
 * Populate hotkeys with data
 * Sets song IDs and labels for hotkey elements
 * 
 * @param {Object} fkeys - Object containing hotkey data
 * @param {string} title - Title for the hotkey tab
 * @param {Object} options - Options object containing dependencies
 */
function populateHotkeys(fkeys, title, options = {}) {
  const { electronAPI, db, saveHotkeysToStore, setLabelFromSongId } = options;
  
  for (const key in fkeys) {
    if (fkeys[key]) {
      try {
        const el = document.getElementById(`${key}_hotkey`);
        if (el) el.setAttribute('songid', fkeys[key]);
        if (setLabelFromSongId && el) {
          setLabelFromSongId(fkeys[key], el);
        }
      } catch (err) {
        window.debugLog?.info(`Error loading fkey ${key} (DB ID: ${fkeys[key]})`, { module: 'hotkey-data', function: 'populateHotkeys' });
      }
    } else {
      const el = document.getElementById(`${key}_hotkey`);
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
 * Set label from song ID
 * Updates hotkey label with song information
 * 
 * @param {string} song_id - Song ID
 * @param {jQuery} element - Hotkey element to update
 * @param {Object} options - Options object containing dependencies
 */
function setLabelFromSongId(song_id, element, options = {}) {
  const { electronAPI, db, saveHotkeysToStore, fallbackSetLabelFromSongId } = options;
  
  // Use new database API for getting song by ID
  if (electronAPI && electronAPI.database) {
    electronAPI.database.query("SELECT * from mrvoice WHERE id = ?", [song_id]).then(result => {
      if (result.success && result.data.length > 0) {
        const row = result.data[0];
        const title = row.title || "[Unknown Title]";
        const artist = row.artist || "[Unknown Artist]";
        const time = row.time || "[??:??]";
        
        // Handle swapping
        const other = document.querySelector(`.hotkeys.active li[songid="${song_id}"]`);
        if (other && other !== element) {
          const otherSpan = other.querySelector('span');
          const elemSpan = element?.querySelector?.('span');
          if (otherSpan && elemSpan) {
            const tmp = elemSpan.textContent || '';
            elemSpan.textContent = otherSpan.textContent || '';
            otherSpan.textContent = tmp;
          }
          const destId = elemSpan?.getAttribute?.('songid');
          if (destId) other.setAttribute('songid', destId); else other.removeAttribute('songid');
          element?.setAttribute?.('songid', song_id);
        } else if (element) {
          const span = element.querySelector('span');
          if (span) span.textContent = `${title} by ${artist} (${time})`;
          element.setAttribute('songid', song_id);
        }
        if (saveHotkeysToStore) {
          saveHotkeysToStore();
        }
      } else {
        window.debugLog?.warn('❌ Failed to get song by ID:', result.error, { module: 'hotkey-data', function: 'setLabelFromSongId' });
        fallbackSetLabelFromSongId(song_id, element, options);
      }
    }).catch(error => {
      window.debugLog?.warn('❌ Database API error:', error, { module: 'hotkey-data', function: 'setLabelFromSongId' });
      fallbackSetLabelFromSongId(song_id, element, options);
    });
  } else {
    fallbackSetLabelFromSongId(song_id, element, options);
  }
}

/**
 * Fallback method for setting label from song ID
 * Uses legacy database access
 * 
 * @param {string} song_id - Song ID
 * @param {jQuery} element - Hotkey element to update
 * @param {Object} options - Options object containing dependencies
 */
function fallbackSetLabelFromSongId(song_id, element, options = {}) {
  const { electronAPI, saveHotkeysToStore } = options;
  if (electronAPI && electronAPI.database) {
    electronAPI.database.query("SELECT * from mrvoice WHERE id = ?", [song_id]).then(result => {
      if (result.success && result.data.length > 0) {
        const row = result.data[0];
        const title = row.title || "[Unknown Title]";
        const artist = row.artist || "[Unknown Artist]";
        const time = row.time || "[??:??]";
        const other2 = document.querySelector(`.hotkeys.active li[songid="${song_id}"]`);
        if (other2 && other2 !== element) {
          const otherSpan2 = other2.querySelector('span');
          const elemSpan2 = element?.querySelector?.('span');
          if (otherSpan2 && elemSpan2) {
            const tmp2 = elemSpan2.textContent || '';
            elemSpan2.textContent = otherSpan2.textContent || '';
            otherSpan2.textContent = tmp2;
          }
          const destId2 = elemSpan2?.getAttribute?.('songid');
          if (destId2) other2.setAttribute('songid', destId2); else other2.removeAttribute('songid');
          element?.setAttribute?.('songid', song_id);
        } else if (element) {
          const span2 = element.querySelector('span');
          if (span2) span2.textContent = `${title} by ${artist} (${time})`;
          element.setAttribute('songid', song_id);
        }
        if (saveHotkeysToStore) saveHotkeysToStore();
      }
    }).catch(() => {/* ignore */});
  }
}

/**
 * Clear all hotkeys
 * Removes all song assignments from hotkeys
 * 
 * @param {Object} options - Options object containing dependencies
 */
async function clearHotkeys(options = {}) {
  const { saveHotkeysToStore } = options;
  
  const confirmed = await customConfirm("Are you sure you want clear your hotkeys?");
  if (confirmed) {
    for (let key = 1; key <= 12; key++) {
      const li = document.getElementById(`f${key}_hotkey`);
      if (li) {
        li.removeAttribute('songid');
        const span = li.querySelector('span');
        if (span) span.textContent = '';
      }
    }
    if (saveHotkeysToStore) {
      saveHotkeysToStore();
    }
  }
}

/**
 * Get hotkey data
 * Retrieves current hotkey assignments
 * 
 * @returns {Object} - Object containing hotkey data
 */
function getHotkeyData() {
  const hotkeyData = {};
  for (let key = 1; key <= 12; key++) {
    const songId = document.getElementById(`f${key}_hotkey`)?.getAttribute('songid');
    if (songId) {
      hotkeyData[`f${key}`] = songId;
    }
  }
  return hotkeyData;
}

/**
 * Get hotkey title
 * Retrieves the current hotkey tab title
 * 
 * @returns {string} - Current hotkey tab title
 */
function getHotkeyTitle() {
  return document.querySelector('#hotkey_tabs li a.active')?.textContent || '';
}

/**
 * Set hotkey data
 * Sets hotkey assignments from data object
 * 
 * @param {Object} hotkeyData - Object containing hotkey data
 * @param {string} title - Title for the hotkey tab
 * @param {Object} options - Options object containing dependencies
 */
function setHotkeyData(hotkeyData, title, options = {}) {
  const { setLabelFromSongId } = options;
  
  // Clear existing hotkeys
  for (let key = 1; key <= 12; key++) {
    const li = document.getElementById(`f${key}_hotkey`);
    if (li) {
      li.removeAttribute('songid');
      const span = li.querySelector('span');
      if (span) span.textContent = '';
    }
  }
  
  // Set new hotkey data
  for (const key in hotkeyData) {
    if (hotkeyData[key]) {
      const el = document.getElementById(`${key}_hotkey`);
      if (el) el.setAttribute('songid', hotkeyData[key]);
      if (setLabelFromSongId && el) {
        setLabelFromSongId(hotkeyData[key], el);
      }
    }
  }
  
  // Set title if provided
  if (title) {
    const link = document.querySelector('#hotkey_tabs li a.active');
    if (link) link.textContent = title;
  }
}

/**
 * Validate hotkey data
 * Checks if hotkey data is valid
 * 
 * @param {Object} hotkeyData - Object containing hotkey data
 * @returns {boolean} - True if data is valid
 */
function validateHotkeyData(hotkeyData) {
  if (!hotkeyData || typeof hotkeyData !== 'object') {
    return false;
  }
  
  // Check that all keys are valid F1-F12 format
  for (const key in hotkeyData) {
    if (!/^f[1-9]|f1[0-2]$/.test(key)) {
      return false;
    }
  }
  
  return true;
}

export {
  populateHotkeys,
  setLabelFromSongId,
  getHotkeyData,
  setHotkeyData,
  clearHotkeys,
  validateHotkeyData
};

// Default export for module loading
export default {
  populateHotkeys,
  setLabelFromSongId,
  getHotkeyData,
  setHotkeyData,
  clearHotkeys,
  validateHotkeyData
}; 