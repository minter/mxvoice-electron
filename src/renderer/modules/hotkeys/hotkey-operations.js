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
      element = activeTabContent.querySelector(`[id^="f${key}_hotkey"]`);
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
    
    // Fallback to tab 1 if not found in active tab
    if (!element) {
      const tab1 = document.getElementById('hotkeys_list_1');
      element = tab1?.querySelector(`#f${key}_hotkey`);
      if (element) {
        songId = element.getAttribute('songid');
        window.debugLog?.info(`Hotkey ${key} found in tab 1 (fallback):`, {
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
  
  return activeTabContent.querySelector(`[id^="${hotkey}_hotkey"]`);
}

/**
 * Play song from hotkey
 * Plays the song assigned to the specified hotkey in the active tab
 * 
 * @param {string} hotkey - Hotkey identifier (e.g., 'f1', 'f2')
 * @param {Object} options - Options object containing dependencies
 */
function playSongFromHotkey(hotkey, _options = {}) {
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
    document
      .querySelectorAll('[id*="_hotkey"]')
      .forEach((item) => item.classList.remove('active-hotkey', 'selected-row'));
    hotkeyElement?.classList.add('active-hotkey', 'selected-row');
    window.currentSelectedHotkey = hotkeyElement?.id || null;
    // Hotkey playback should not affect holding tank mode
    // Just play the song without changing autoplay state
    window.secureElectronAPI?.analytics?.trackEvent?.('song_played', { trigger_method: 'hotkey' });
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
  
  const activeTab = document.querySelector('#hotkey-tab-content .tab-pane.active.show')
    || document.getElementById('hotkeys_list_1');
  for (let key = 1; key <= 12; key++) {
    const songId = activeTab?.querySelector(`[id^="f${key}_hotkey"]`)?.getAttribute('songid');
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
  const { setLabelFromSongId, saveHotkeysToStore, clearTab, assignHotkey, renameTab } = options;
  
  if (!config || !config.hotkeys) {
    window.debugLog?.warn('❌ Invalid hotkey configuration', { module: 'hotkey-operations', function: 'importHotkeyConfig' });
    return;
  }
  
  // Scope to the active hotkey tab
  const activeTab = document.querySelector('#hotkey-tab-content .tab-pane.active.show')
    || document.getElementById('hotkeys_list_1');
  clearTab?.();

  // Clear existing hotkeys
  for (let key = 1; key <= 12; key++) {
    const li = activeTab?.querySelector(`[id^="f${key}_hotkey"]`);
    if (li) {
      li.removeAttribute('songid');
      const span = li.querySelector('span');
      if (span) span.textContent = '';
    }
  }

  // Apply imported configuration
  for (const key in config.hotkeys) {
    if (config.hotkeys[key]) {
      const el = activeTab?.querySelector(`[id^="${key}_hotkey"]`);
      assignHotkey?.(el, config.hotkeys[key]);
      if (el) el.setAttribute('songid', config.hotkeys[key]);
      if (setLabelFromSongId && el) {
        setLabelFromSongId(config.hotkeys[key], el);
      }
    }
  }
  
  // Set title if provided
  if (config.title) {
    const link = document.querySelector('#hotkey_tabs li a.active');
    if (link) link.textContent = config.title;
    renameTab?.(config.title);
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
function _backupHotkeyConfig() {
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
function _restoreHotkeyConfig(backup, options = {}) {
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
  const { saveHotkeysToStore, clearTab } = options;
  
  window.debugLog?.info('🧹 Clearing hotkey configuration...', { module: 'hotkey-operations', function: 'clearHotkeyConfig' });
  
  // Clear all hotkey assignments in the active tab
  const activeTab = document.querySelector('#hotkey-tab-content .tab-pane.active.show')
    || document.getElementById('hotkeys_list_1');
  clearTab?.();
  for (let key = 1; key <= 12; key++) {
    const li = activeTab?.querySelector(`[id^="f${key}_hotkey"]`);
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
