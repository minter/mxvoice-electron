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
        $(`.hotkeys.active #${key}_hotkey`).attr("songid", fkeys[key]);
        if (setLabelFromSongId) {
          setLabelFromSongId(fkeys[key], $(`.hotkeys.active #${key}_hotkey`));
        }
      } catch (err) {
        window.debugLog?.info(`Error loading fkey ${key} (DB ID: ${fkeys[key]})`, { module: 'hotkey-data', function: 'populateHotkeys' });
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
        const original_song_node = $(`.hotkeys.active li[songid=${song_id}]`).not(element);
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
          $(element).attr("songid", song_id);
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
        const original_song_node = $(`.hotkeys.active li[songid=${song_id}]`).not(element);
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
          $(element).attr("songid", song_id);
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
      $(`.hotkeys.active #f${key}_hotkey`).removeAttr("songid");
      $(`.hotkeys.active #f${key}_hotkey span`).html("");
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
    const songId = $(`.hotkeys.active #f${key}_hotkey`).attr("songid");
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
  return $("#hotkey_tabs li a.active").text();
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
    $(`.hotkeys.active #f${key}_hotkey`).removeAttr("songid");
    $(`.hotkeys.active #f${key}_hotkey span`).html("");
  }
  
  // Set new hotkey data
  for (const key in hotkeyData) {
    if (hotkeyData[key]) {
      $(`.hotkeys.active #${key}_hotkey`).attr("songid", hotkeyData[key]);
      if (setLabelFromSongId) {
        setLabelFromSongId(hotkeyData[key], $(`.hotkeys.active #${key}_hotkey`));
      }
    }
  }
  
  // Set title if provided
  if (title) {
    $("#hotkey_tabs li a.active").text(title);
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