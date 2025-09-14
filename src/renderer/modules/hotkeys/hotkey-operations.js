/**
 * Hotkey Operations
 * 
 * Handles operations for hotkeys including:
 * - File import/export operations
 * - Playback functions
 * - Store operations
 * 
 * @module hotkey-operations
 */

// Import secure adapters for UI operations
import { secureFileDialog } from '../adapters/secure-adapter.js';

/**
 * Save hotkeys to store
 * Only saves if we have the new HTML format with header button
 * 
 * @param {Object} options - Options object containing dependencies
 */
function saveHotkeysToStore(options = {}) {
  const { electronAPI, store } = options;
  
  const col = document.getElementById('hotkeys-column');
  const currentHtml = col ? col.innerHTML : '';
  if (currentHtml.includes("header-button")) {
    if (electronAPI && electronAPI.store) {
      electronAPI.store.set("hotkeys", currentHtml).then(result => {
        if (result.success) {
          window.debugLog?.info('✅ Hotkeys saved to store successfully', { module: 'hotkey-operations', function: 'saveHotkeysToStore' });
        } else {
          window.debugLog?.warn('❌ Failed to save hotkeys to store:', result.error, { module: 'hotkey-operations', function: 'saveHotkeysToStore' });
        }
      }).catch(error => {
        window.debugLog?.warn('❌ Store save error:', error, { module: 'hotkey-operations', function: 'saveHotkeysToStore' });
      });
    }
  }
}

/**
 * Load hotkeys from store
 * Loads saved hotkey state and populates UI
 * 
 * @param {Object} options - Options object containing dependencies
 */
function loadHotkeysFromStore(options = {}) {
  const { electronAPI, store } = options;
  
  if (electronAPI && electronAPI.store) {
    electronAPI.store.has("hotkeys").then(hasHotkeys => {
      if (hasHotkeys) {
        electronAPI.store.get("hotkeys").then(storedHotkeysHtml => {
          // Check if the stored HTML contains the old plain text header
          if (
            storedHotkeysHtml && typeof storedHotkeysHtml === 'string' &&
            storedHotkeysHtml.includes("Hotkeys") &&
            !storedHotkeysHtml.includes("header-button")
          ) {
            // This is the old HTML format, clear it so the new HTML loads
            electronAPI.store.delete("hotkeys").then(() => {
              window.debugLog?.info("Cleared old hotkeys HTML format", { module: 'hotkey-operations', function: 'loadHotkeysFromStore' });
            });
          } else if (storedHotkeysHtml && typeof storedHotkeysHtml === 'string') {
            const column = document.getElementById('hotkeys-column');
            if (column) column.innerHTML = storedHotkeysHtml;
            document.getElementById('selected_row')?.removeAttribute('id');
          }
        });
      }
    });
  } else {
    // No legacy store path under secure mode
  }
}

/**
 * Open hotkey file
 * Imports hotkey configuration from file
 */
function openHotkeyFile() {
  // Use secureFileDialog directly since this is bound to the hotkeys module
  secureFileDialog.openHotkeyFile();
}

/**
 * Save hotkey file
 * Exports hotkey configuration to file
 */
function saveHotkeyFile() {
  window.debugLog?.info("Renderer starting saveHotkeyFile", { module: 'hotkey-operations', function: 'saveHotkeyFile' });
  
  // Find the active tab and its content
  const activeLink = document.querySelector('#hotkey_tabs li a.active');
  const activeText = activeLink ? (activeLink.textContent || '') : '';
  
  // Get the active tab content div
  let activeTabContent = null;
  if (activeLink) {
    const href = activeLink.getAttribute('href');
    if (href && href.startsWith('#')) {
      const tabId = href.substring(1);
      activeTabContent = document.getElementById(tabId);
      window.debugLog?.info("Found active tab content:", { 
        module: 'hotkey-operations', 
        function: 'saveHotkeyFile', 
        tabId: tabId,
        tabContent: !!activeTabContent
      });
    }
  }
  
  const hotkeyArray = [];
  for (let key = 1; key <= 12; key++) {
    let element = null;
    let songId = null;
    
    if (activeTabContent) {
      // Look for hotkey element within the active tab content first
      element = activeTabContent.querySelector(`#f${key}_hotkey`);
      if (element) {
        songId = element.getAttribute('songid');
        window.debugLog?.info(`Hotkey ${key} found in active tab:`, { 
          module: 'hotkey-operations', 
          function: 'saveHotkeyFile', 
          key: key,
          songId: songId,
          foundInActiveTab: true
        });
      }
    }
    
    // Fallback to global search if not found in active tab
    if (!element) {
      element = document.getElementById(`f${key}_hotkey`);
      if (element) {
        songId = element.getAttribute('songid');
        window.debugLog?.info(`Hotkey ${key} found globally (fallback):`, { 
          module: 'hotkey-operations', 
          function: 'saveHotkeyFile', 
          key: key,
          songId: songId,
          foundInActiveTab: false
        });
      }
    }
    
    // Ensure we always have a value, even if element is missing
    const safeSongId = songId || null;
    hotkeyArray.push(safeSongId);
    
    window.debugLog?.info(`Hotkey ${key} final data:`, { 
      module: 'hotkey-operations', 
      function: 'saveHotkeyFile', 
      key: key,
      element: !!element,
      songId: safeSongId,
      type: typeof safeSongId,
      elementExists: !!element
    });
  }
  
  // Only add tab name if it's not a number and not empty
  if (activeText && activeText.trim() && !/^\d+$/.test(activeText.trim())) {
    hotkeyArray.push(activeText.trim());
    window.debugLog?.info("Added tab name to hotkey array:", { 
      module: 'hotkey-operations', 
      function: 'saveHotkeyFile', 
      tabName: activeText.trim()
    });
  } else {
    window.debugLog?.info("No valid tab name to add:", { 
      module: 'hotkey-operations', 
      function: 'saveHotkeyFile', 
      activeText: activeText,
      isEmpty: !activeText || !activeText.trim(),
      isNumber: activeText && /^\d+$/.test(activeText.trim())
    });
  }
  
  window.debugLog?.info("Final hotkey array:", { 
    module: 'hotkey-operations', 
    function: 'saveHotkeyFile', 
    hotkeyArray: hotkeyArray,
    length: hotkeyArray.length,
    tabName: activeText,
    activeTabContent: !!activeTabContent
  });
  
  // Use secureFileDialog directly since this is bound to the hotkeys module
  secureFileDialog.saveHotkeyFile(hotkeyArray);
}

/**
 * Get hotkey element from active tab
 * Helper function to get hotkey element from the currently active tab
 * 
 * @param {string} hotkey - Hotkey identifier (e.g., 'f1', 'f2')
 * @returns {Element|null} - Hotkey element from active tab
 */
function getHotkeyElementFromActiveTab(hotkey) {
  const activeLink = document.querySelector('#hotkey_tabs .nav-link.active');
  if (!activeLink) return null;
  
  const href = activeLink.getAttribute('href');
  if (!href || !href.startsWith('#')) return null;
  
  const tabId = href.substring(1);
  const activeTabContent = document.getElementById(tabId);
  if (!activeTabContent) return null;
  
  return activeTabContent.querySelector(`#${hotkey}_hotkey`);
}

/**
 * Play song from hotkey
 * Plays the song assigned to the specified hotkey in the active tab
 * 
 * @param {string} hotkey - Hotkey identifier (e.g., 'f1', 'f2')
 * @param {Object} options - Options object containing dependencies
 */
function playSongFromHotkey(hotkey, options = {}) {
  window.debugLog?.info("Getting song ID from hotkey " + hotkey + " in active tab", { module: 'hotkey-operations', function: 'playSongFromHotkey' });
  
  // Get hotkey element from active tab only
  const hotkeyElement = getHotkeyElementFromActiveTab(hotkey);
  const song_id = hotkeyElement?.getAttribute('songid');
  
  window.debugLog?.info(`Found song ID ${song_id} from active tab`, { 
    module: 'hotkey-operations', 
    function: 'playSongFromHotkey',
    activeTabElement: !!hotkeyElement
  });
  
  if (song_id) {
    window.debugLog?.info(`Preparing to play song ${song_id} from active tab`, { module: 'hotkey-operations', function: 'playSongFromHotkey' });
    // Unhighlight any selected tracks in holding tank or playlist
    document.querySelector('.now_playing')?.classList.remove('now_playing');
    document.getElementById('selected_row')?.removeAttribute('id');
    // Hotkey playback should not affect holding tank mode
    // Just play the song without changing autoplay state
    if (typeof playSongFromId === 'function') {
      playSongFromId(song_id);
    }
    if (typeof animateCSS === 'function' && hotkeyElement) {
      animateCSS(hotkeyElement, "flipInX");
    }
  } else {
    window.debugLog?.warn('No song assigned to hotkey ' + hotkey + ' in active tab', {
      module: 'hotkey-operations',
      function: 'playSongFromHotkey',
      hotkey: hotkey,
      hotkeyElement: !!hotkeyElement
    });
  }
}

/**
 * Send selected song to hotkeys
 * Assigns the currently selected song to the first empty hotkey slot
 * 
 * @param {Object} options - Options object containing dependencies
 * @returns {boolean} - False to prevent default behavior
 */
function sendToHotkeys(options = {}) {
  const { setLabelFromSongId } = options;
  
  if (document.getElementById('selected_row')?.tagName === 'SPAN') {
    return;
  }
  const target = Array.from(document.querySelectorAll('.hotkeys.active li')).find(li => !li.getAttribute('songid'));
  const song_id = document.getElementById('selected_row')?.getAttribute('songid');
  if (document.querySelector(`.hotkeys.active li[songid="${song_id}"]`)) {
    return;
  }
  if (target && song_id) {
    target.setAttribute('songid', song_id);
    if (setLabelFromSongId) {
      setLabelFromSongId(song_id, target);
    }
  }
  return false;
}

// removeFromHotkey function moved to main hotkeys module (index.js) to avoid conflicts
// This ensures consistent behavior and prevents ID manipulation issues

/**
 * Export hotkey configuration
 * Creates a configuration object for export
 * 
 * @returns {Object} - Hotkey configuration object
 */
function exportHotkeyConfig() {
  const config = {
    hotkeys: {},
    title: (document.querySelector('#hotkey_tabs li a.active')?.textContent) || '',
    timestamp: new Date().toISOString()
  };
  
  for (let key = 1; key <= 12; key++) {
    const songId = document.getElementById(`f${key}_hotkey`)?.getAttribute('songid');
    if (songId) {
      config.hotkeys[`f${key}`] = songId;
    }
  }
  
  return config;
}

/**
 * Import hotkey configuration
 * Applies imported configuration to hotkeys
 * 
 * @param {Object} config - Hotkey configuration object
 * @param {Object} options - Options object containing dependencies
 */
function importHotkeyConfig(config, options = {}) {
  const { setLabelFromSongId, saveHotkeysToStore } = options;
  
  if (!config || !config.hotkeys) {
    window.debugLog?.warn('❌ Invalid hotkey configuration', { module: 'hotkey-operations', function: 'importHotkeyConfig' });
    return;
  }
  
  // Clear existing hotkeys
  for (let key = 1; key <= 12; key++) {
    const li = document.getElementById(`f${key}_hotkey`);
    if (li) {
      li.removeAttribute('songid');
      const span = li.querySelector('span');
      if (span) span.textContent = '';
    }
  }
  
  // Apply imported configuration
  for (const key in config.hotkeys) {
    if (config.hotkeys[key]) {
      document.getElementById(`${key}_hotkey`)?.setAttribute('songid', config.hotkeys[key]);
      if (setLabelFromSongId) {
        const el = document.getElementById(`${key}_hotkey`);
        if (el) setLabelFromSongId(config.hotkeys[key], el);
      }
    }
  }
  
  // Set title if provided
  if (config.title) {
    const link = document.querySelector('#hotkey_tabs li a.active');
    if (link) link.textContent = config.title;
  }
  
  // Save to store
  if (saveHotkeysToStore) {
    saveHotkeysToStore();
  }
}

/**
 * Backup hotkey configuration
 * Creates a backup of current hotkey state
 * 
 * @returns {Object} - Backup configuration object
 */
function backupHotkeyConfig() {
  return {
    hotkeys: exportHotkeyConfig(),
    timestamp: new Date().toISOString(),
    version: '1.0'
  };
}

/**
 * Restore hotkey configuration
 * Restores hotkey state from backup
 * 
 * @param {Object} backup - Backup configuration object
 * @param {Object} options - Options object containing dependencies
 */
function restoreHotkeyConfig(backup, options = {}) {
  if (!backup || !backup.hotkeys) {
    window.debugLog?.warn('❌ Invalid backup configuration', { module: 'hotkey-operations', function: 'restoreHotkeyConfig' });
    return;
  }
  
  importHotkeyConfig(backup.hotkeys, options);
}

/**
 * Clear hotkey configuration
 * Removes all hotkey assignments
 * 
 * @param {Object} options - Options object containing dependencies
 */
function clearHotkeyConfig(options = {}) {
  const { saveHotkeysToStore } = options;
  
  window.debugLog?.info('🧹 Clearing hotkey configuration...', { module: 'hotkey-operations', function: 'clearHotkeyConfig' });
  
  // Clear all hotkey assignments
  for (let key = 1; key <= 12; key++) {
    const li = document.getElementById(`f${key}_hotkey`);
    if (li) {
      li.removeAttribute('songid');
      const span = li.querySelector('span');
      if (span) span.textContent = '';
    }
  }
  
  // Save to store if saveHotkeysToStore is provided
  if (saveHotkeysToStore) {
    saveHotkeysToStore();
  }
  
  window.debugLog?.info('✅ Hotkey configuration cleared', { module: 'hotkey-operations', function: 'clearHotkeyConfig' });
}

/**
 * Get hotkey configuration
 * Returns the current hotkey configuration
 * 
 * @returns {Object} - Current hotkey configuration
 */
function getHotkeyConfig() {
  return exportHotkeyConfig();
}

/**
 * Set hotkey configuration
 * Sets the hotkey configuration from a config object
 * 
 * @param {Object} config - Hotkey configuration object
 * @param {Object} options - Options object containing dependencies
 */
function setHotkeyConfig(config, options = {}) {
  importHotkeyConfig(config, options);
}

export {
  saveHotkeysToStore,
  loadHotkeysFromStore,
  openHotkeyFile,
  saveHotkeyFile,
  getHotkeyElementFromActiveTab,
  playSongFromHotkey,
  sendToHotkeys,
  exportHotkeyConfig,
  importHotkeyConfig,
  clearHotkeyConfig,
  getHotkeyConfig,
  setHotkeyConfig
};

// Default export for module loading
export default {
  saveHotkeysToStore,
  loadHotkeysFromStore,
  openHotkeyFile,
  saveHotkeyFile,
  getHotkeyElementFromActiveTab,
  playSongFromHotkey,
  sendToHotkeys,
  exportHotkeyConfig,
  importHotkeyConfig,
  clearHotkeyConfig,
  getHotkeyConfig,
  setHotkeyConfig
}; 