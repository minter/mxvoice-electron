/**
 * Hotkey UI Functions
 * 
 * Handles all UI-related functionality for hotkeys including:
 * - Event listeners and handlers
 * - Tab management
 * - Visual updates and highlighting
 * - Element manipulation
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

// Drag handler import for programmatic binding
import { songDrag } from '../drag-drop/drag-drop-functions.js';

/**
 * Handle dropping songs into hotkey containers
 * 
 * @param {Event} event - The drop event
 * @param {Object} options - Additional options
 */
function hotkeyDrop(event, options = {}) {
  event.preventDefault();
  const song_id = event.dataTransfer.getData('text');
  const target = event.currentTarget;
  
  // Save function to call after setLabelFromSongId completes
  const saveFunction = () => {
    if (this && this.saveHotkeysToStore) {
      this.saveHotkeysToStore();
    } else if (window.saveHotkeysToStore) {
      window.saveHotkeysToStore();
    }
  };
  
  // Use the module instance's setLabelFromSongId method if available (when bound to HotkeysModule)
  // Otherwise fall back to global function
  if (this && this.setLabelFromSongId) {
    // Call setLabelFromSongId and save after completion
    const result = this.setLabelFromSongId(song_id, target);
    if (result && result instanceof Promise) {
      result.then(() => saveFunction()).catch(() => saveFunction());
    } else {
      // If not a promise, save immediately
      setTimeout(saveFunction, 100);
    }
  } else if (window.setLabelFromSongId) {
    const result = window.setLabelFromSongId(song_id, target);
    if (result && result instanceof Promise) {
      result.then(() => saveFunction()).catch(() => saveFunction());
    } else {
      setTimeout(saveFunction, 100);
    }
  }
}

/**
 * Allow dropping into hotkey containers
 * 
 * @param {Event} event - The dragover event
 */
function allowHotkeyDrop(event) {
  event.preventDefault();
}

/**
 * Switch to a specific hotkey tab
 * 
 * @param {number} tab - Tab number to switch to
 */
function switchToHotkeyTab(tab) {
  try {
    import('../ui/bootstrap-adapter.js')
      .then(({ showTab }) => showTab(`#hotkey_tabs li:nth-child(${tab}) a`))
      .catch(() => {});
  } catch {}
}

/**
 * Rename the active hotkey tab
 * 
 * @param {Object} options - Additional options
 */
async function renameHotkeyTab(options = {}) {
  const currentName = document.querySelector('#hotkey_tabs .nav-link.active')?.textContent || '';
  const newName = await customPrompt("Enter a new name for this tab:", currentName, "Rename Hotkey Tab");
  if (newName && newName.trim() !== "") {
    const link = document.querySelector('#hotkey_tabs .nav-link.active');
    if (link) link.textContent = newName;
    return { success: true, newName: newName };
  } else {
    return { success: false, error: 'Invalid name' };
  }
}

/**
 * Setup all hotkey event listeners
 * 
 * @param {Object} options - Additional options
 */
function setupHotkeyEventListeners(options = {}) {
  // Hotkey drop handlers
  document.querySelectorAll('.hotkeys li').forEach((li) => {
    li.addEventListener('drop', (event) => {
      li.classList.remove('drop_target');
      const data = (event.originalEvent || event).dataTransfer?.getData('text') || '';
      if (!data.length) return;
      hotkeyDrop((event.originalEvent || event), options);
    });
    li.addEventListener('dragover', (event) => {
      li.classList.add('drop_target');
      allowHotkeyDrop((event.originalEvent || event));
    });
    li.addEventListener('dragleave', (event) => {
      (event.currentTarget).classList.remove('drop_target');
    });
  });

  // Note: Click highlighting is now handled by event delegation in setupHotkeyHighlightDelegation()
  // This prevents duplicate event handlers that were causing highlighting conflicts

  // Hotkey tab events
  const hotkeyTabs = document.getElementById('hotkey_tabs');
  if (hotkeyTabs) {
    hotkeyTabs.addEventListener('dblclick', (e) => {
      if (e.target && e.target.closest('.nav-link')) {
        renameHotkeyTab?.(options);
      }
    });
  }

  debugLog?.info('Hotkeys event listeners set up', { 
    module: 'hotkey-ui',
    function: 'setupHotkeyEventListeners'
  });
}

/**
 * Initialize hotkey tabs
 * Sets up the initial hotkey tab structure
 */
function initHotkeyTabs() {
  // Set up hotkey and holding tank tabs
  for (let i = 2; i <= 5; i++) {
    const base = document.getElementById('hotkeys_list_1');
    if (!base) continue;
    const clone = base.cloneNode(true);
    clone.id = `hotkeys_list_${i}`;
    clone.classList.remove('show','active');
    const container = document.getElementById('hotkey-tab-content');
    container?.appendChild(clone);
  }
}

/**
 * Get active hotkey tab
 * Returns the currently active hotkey tab
 * 
 * @returns {number} - Active tab number (1-5)
 */
function getActiveHotkeyTab() {
  const links = Array.from(document.querySelectorAll('#hotkey_tabs .nav-link'));
  const active = document.querySelector('#hotkey_tabs .nav-link.active');
  return Math.max(0, links.indexOf(active)) + 1;
}

/**
 * Set active hotkey tab
 * Sets the specified tab as active
 * 
 * @param {number} tabNumber - Tab number to activate (1-5)
 */
function setActiveHotkeyTab(tabNumber) {
  if (tabNumber >= 1 && tabNumber <= 5) {
    try {
      import('../ui/bootstrap-adapter.js')
        .then(({ showTab }) => showTab(`#hotkey_tabs li:nth-child(${tabNumber}) a`))
        .catch(() => {});
    } catch {}
  }
}

/**
 * Get active hotkey tab content element
 * Returns the DOM element for the currently active hotkey tab content
 * 
 * @returns {Element|null} - Active tab content element
 */
function getActiveHotkeyTabContent() {
  const activeLink = document.querySelector('#hotkey_tabs .nav-link.active');
  if (!activeLink) return null;
  
  const href = activeLink.getAttribute('href');
  if (!href || !href.startsWith('#')) return null;
  
  const tabId = href.substring(1);
  return document.getElementById(tabId);
}

/**
 * Get hotkey element from active tab
 * Returns the hotkey element for a specific hotkey within the active tab
 * 
 * @param {string} hotkey - Hotkey identifier (e.g., 'f1', 'f2')
 * @returns {Element|null} - Hotkey element from active tab
 */
function getHotkeyElementFromActiveTab(hotkey) {
  const activeTabContent = getActiveHotkeyTabContent();
  if (!activeTabContent) return null;
  
  return activeTabContent.querySelector(`#${hotkey}_hotkey`);
}

/**
 * Get hotkey element
 * Returns the jQuery element for a specific hotkey
 * 
 * @param {string} hotkey - Hotkey identifier (e.g., 'f1', 'f2')
 * @returns {jQuery} - Hotkey element
 */
function getHotkeyElement(hotkey) {
  return document.querySelector(`.hotkeys.active #${hotkey}_hotkey`);
}

/**
 * Get all hotkey elements
 * Returns all hotkey elements in the active tab
 * 
 * @returns {jQuery} - All hotkey elements
 */
function getAllHotkeyElements() {
  return document.querySelectorAll('.hotkeys.active li');
}

/**
 * Highlight hotkey
 * Adds visual highlighting to a hotkey
 * 
 * @param {string} hotkey - Hotkey identifier (e.g., 'f1', 'f2')
 * @param {string} className - CSS class for highlighting
 */
function highlightHotkey(hotkey, className = 'highlight') {
  const element = getHotkeyElement(hotkey);
  if (element) element.classList.add(className);
  
  // Remove highlight after animation
  setTimeout(() => {
    if (element) element.classList.remove(className);
  }, 1000);
}

/**
 * Clear hotkey highlighting
 * Removes all highlighting from hotkeys
 */
function clearHotkeyHighlighting() {
  document.querySelectorAll('.hotkeys.active li').forEach(li => li.classList.remove('highlight'));
}

/**
 * Clear all hotkey selection highlighting
 * Removes active-hotkey and selected-row classes from all hotkey elements
 * This ensures consistent highlighting state across all hotkey tabs
 */
function clearAllHotkeyHighlighting() {
  // Clear highlighting from all hotkey elements across all tabs
  const hotkeyElements = document.querySelectorAll('[id$="_hotkey"]');
  let clearedCount = 0;
  
  hotkeyElements.forEach((item) => {
    const hadHighlighting = item.classList.contains('active-hotkey') || item.classList.contains('selected-row');
    if (hadHighlighting) {
      clearedCount++;
    }
    item.classList.remove('active-hotkey', 'selected-row');
  });
  
  // Clear the global selected hotkey reference
  window.currentSelectedHotkey = null;
  
  debugLog?.info('All hotkey highlighting cleared', { 
    module: 'hotkey-ui', 
    function: 'clearAllHotkeyHighlighting',
    totalElements: hotkeyElements.length,
    clearedCount: clearedCount,
    previousSelected: window.currentSelectedHotkey
  });
}

/**
 * Update hotkey display
 * Updates the visual display of hotkeys
 * 
 * @param {Object} options - Additional options
 */
function updateHotkeyDisplay(options = {}) {
  // Update hotkey labels and styling
  document.querySelectorAll('.hotkeys.active li').forEach((li) => {
    const songId = li.getAttribute('songid');
    if (songId) setLabelFromSongId(songId, li);
  });
}

/**
 * Validate hotkey element
 * Checks if a hotkey element is valid
 * 
 * @param {jQuery} element - Hotkey element to validate
 * @returns {boolean} - Whether the element is valid
 */
function validateHotkeyElement(element) {
  return !!element && (element instanceof Element) && element.classList.contains('hotkey');
}

/**
 * Create hotkey element
 * Creates a new hotkey element
 * 
 * @param {string} hotkey - Hotkey identifier (e.g., 'f1', 'f2')
 * @returns {jQuery} - Created hotkey element
 */
function createHotkeyElement(hotkey) {
  const li = document.createElement('li');
  li.id = `${hotkey}_hotkey`;
  li.className = 'hotkey';
  li.draggable = true;
  li.addEventListener('dragstart', songDrag);
  return li;
}

/**
 * Remove hotkey element
 * Removes a hotkey element
 * 
 * @param {string} hotkey - Hotkey identifier (e.g., 'f1', 'f2')
 */
function removeHotkeyElement(hotkey) {
  const el = document.getElementById(`${hotkey}_hotkey`);
  el?.parentElement?.removeChild(el);
}

/**
 * Get hotkey song ID
 * Returns the song ID assigned to a hotkey in the active tab
 * 
 * @param {string} hotkey - Hotkey identifier (e.g., 'f1', 'f2')
 * @returns {string} - Song ID or null
 */
function getHotkeySongId(hotkey) {
  const element = getHotkeyElementFromActiveTab(hotkey);
  return element?.getAttribute('songid') || null;
}

/**
 * Set hotkey song ID
 * Assigns a song ID to a hotkey in the active tab
 * 
 * @param {string} hotkey - Hotkey identifier (e.g., 'f1', 'f2')
 * @param {string} songId - Song ID to assign
 */
function setHotkeySongId(hotkey, songId) {
  const el = getHotkeyElementFromActiveTab(hotkey);
  if (el) el.setAttribute('songid', songId);
}

/**
 * Clear hotkey song ID
 * Removes the song ID assignment from a hotkey
 * 
 * @param {string} hotkey - Hotkey identifier (e.g., 'f1', 'f2')
 */
function clearHotkeySongId(hotkey) {
  const el = document.getElementById(`${hotkey}_hotkey`);
  if (el) {
    el.removeAttribute('songid');
    el.textContent = '';
  }
}

/**
 * Get hotkey label
 * Returns the display label for a hotkey
 * 
 * @param {string} hotkey - Hotkey identifier (e.g., 'f1', 'f2')
 * @returns {string} - Hotkey label
 */
function getHotkeyLabel(hotkey) {
  return document.getElementById(`${hotkey}_hotkey`)?.textContent || '';
}

/**
 * Set hotkey label
 * Sets the display label for a hotkey
 * 
 * @param {string} hotkey - Hotkey identifier (e.g., 'f1', 'f2')
 * @param {string} label - Label to set
 */
function setHotkeyLabel(hotkey, label) {
  const el = document.getElementById(`${hotkey}_hotkey`);
  if (el) el.textContent = label;
}

/**
 * Check if hotkey is assigned
 * Returns whether a hotkey has a song assigned
 * 
 * @param {string} hotkey - Hotkey identifier (e.g., 'f1', 'f2')
 * @returns {boolean} - Whether the hotkey is assigned
 */
function isHotkeyAssigned(hotkey) {
  const songId = getHotkeySongId(hotkey);
  return songId && songId.trim() !== "";
}

/**
 * Get assigned hotkeys
 * Returns all hotkeys that have songs assigned
 * 
 * @returns {Array} - Array of assigned hotkey identifiers
 */
function getAssignedHotkeys() {
  const assigned = [];
  for (let i = 1; i <= 12; i++) {
    const hotkey = `f${i}`;
    if (isHotkeyAssigned(hotkey)) {
      assigned.push(hotkey);
    }
  }
  return assigned;
}

/**
 * Get unassigned hotkeys
 * Returns all hotkeys that don't have songs assigned
 * 
 * @returns {Array} - Array of unassigned hotkey identifiers
 */
function getUnassignedHotkeys() {
  const unassigned = [];
  for (let i = 1; i <= 12; i++) {
    const hotkey = `f${i}`;
    if (!isHotkeyAssigned(hotkey)) {
      unassigned.push(hotkey);
    }
  }
  return unassigned;
}

/**
 * Attach event delegation for hotkey highlighting
 */
function setupHotkeyHighlightDelegation() {
  // Find all .hotkeys lists (one per tab)
  document.querySelectorAll('.hotkeys').forEach((ul) => {
    // Remove any previous listener to avoid duplicates
    ul.removeEventListener('click', ul._hotkeyClickHandler);
    // Define the handler
    ul._hotkeyClickHandler = function (e) {
      const li = e.target.closest('li');
      if (!li || !ul.contains(li)) {
        window.debugLog?.info('Clicked element is not a hotkey <li>', { eventTarget: e.target });
        return;
      }
      window.debugLog?.info('Hotkey <li> clicked', { liId: li.id, classList: [...li.classList] });
      // Remove highlight and selected-row from all hotkeys in this list
      ul.querySelectorAll('li').forEach((item) => {
        item.classList.remove('active-hotkey', 'selected-row');
      });
      // Highlight clicked hotkey
      li.classList.add('active-hotkey', 'selected-row');
      window.currentSelectedHotkey = li.id;
      window.debugLog?.info('Hotkey highlighted', { selectedId: li.id, classList: [...li.classList] });
    };
    ul.addEventListener('click', ul._hotkeyClickHandler);
    window.debugLog?.info('Hotkey highlight event delegation attached', { ulId: ul.id });
  });
}

// Call this after hotkey lists are rendered/updated
setupHotkeyHighlightDelegation();

// Export all functions
export {
  hotkeyDrop,
  allowHotkeyDrop,
  switchToHotkeyTab,
  renameHotkeyTab,
  setupHotkeyEventListeners,
  initHotkeyTabs,
  getActiveHotkeyTab,
  setActiveHotkeyTab,
  getActiveHotkeyTabContent,
  getHotkeyElementFromActiveTab,
  getHotkeyElement,
  getAllHotkeyElements,
  highlightHotkey,
  clearHotkeyHighlighting,
  clearAllHotkeyHighlighting,
  updateHotkeyDisplay,
  validateHotkeyElement,
  createHotkeyElement,
  removeHotkeyElement,
  getHotkeySongId,
  setHotkeySongId,
  clearHotkeySongId,
  getHotkeyLabel,
  setHotkeyLabel,
  isHotkeyAssigned,
  getAssignedHotkeys,
  getUnassignedHotkeys
};

// Default export for module loading
export default {
  hotkeyDrop,
  allowHotkeyDrop,
  switchToHotkeyTab,
  renameHotkeyTab,
  setupHotkeyEventListeners,
  initHotkeyTabs,
  getActiveHotkeyTab,
  setActiveHotkeyTab,
  getActiveHotkeyTabContent,
  getHotkeyElementFromActiveTab,
  getHotkeyElement,
  getAllHotkeyElements,
  highlightHotkey,
  clearHotkeyHighlighting,
  clearAllHotkeyHighlighting,
  updateHotkeyDisplay,
  validateHotkeyElement,
  createHotkeyElement,
  removeHotkeyElement,
  getHotkeySongId,
  setHotkeySongId,
  clearHotkeySongId,
  getHotkeyLabel,
  setHotkeyLabel,
  isHotkeyAssigned,
  getAssignedHotkeys,
  getUnassignedHotkeys
}; 