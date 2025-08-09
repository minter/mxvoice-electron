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

/**
 * Handle dropping songs into hotkey containers
 * 
 * @param {Event} event - The drop event
 * @param {Object} options - Additional options
 */
function hotkeyDrop(event, options = {}) {
  event.preventDefault();
  var song_id = event.dataTransfer.getData("text");
  var target = $(event.currentTarget);
  target.attr("songid", song_id);
  
  // Use the module instance's setLabelFromSongId method if available (when bound to HotkeysModule)
  // Otherwise fall back to global function
  if (this && this.setLabelFromSongId) {
    this.setLabelFromSongId(song_id, target);
  } else if (window.setLabelFromSongId) {
    window.setLabelFromSongId(song_id, target);
  } else {
    debugLog?.error('❌ setLabelFromSongId not available', { 
      module: 'hotkey-ui', 
      function: 'hotkeyDrop',
      hasThis: !!this,
      hasThisMethod: !!(this && this.setLabelFromSongId),
      hasGlobal: !!window.setLabelFromSongId
    });
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
  $(`#hotkey_tabs li:nth-child(${tab}) a`).tab("show");
}

/**
 * Rename the active hotkey tab
 * 
 * @param {Object} options - Additional options
 */
async function renameHotkeyTab(options = {}) {
  const currentName = $("#hotkey_tabs .nav-link.active").text();
  const newName = await customPrompt("Enter a new name for this tab:", currentName, "Rename Hotkey Tab");
  if (newName && newName.trim() !== "") {
    $("#hotkey_tabs .nav-link.active").text(newName);
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
  $(".hotkeys li").on("drop", function (event) {
    $(this).removeClass("drop_target");
    if (!event.originalEvent.dataTransfer.getData("text").length) return;
    hotkeyDrop(event.originalEvent, options);
  });

  $(".hotkeys li").on("dragover", function (event) {
    $(this).addClass("drop_target");
    allowHotkeyDrop(event.originalEvent);
  });

  $(".hotkeys li").on("dragleave", function (event) {
    $(event.currentTarget).removeClass("drop_target");
  });

  // Hotkey tab events
  $("#hotkey_tabs").on("dblclick", ".nav-link", () => {
    if (renameHotkeyTab) {
      renameHotkeyTab(options);
    }
  });

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
    const hotkey_node = $("#hotkeys_list_1").clone();
    hotkey_node.attr("id", `hotkeys_list_${i}`);
    hotkey_node.removeClass("show active");
    $("#hotkey-tab-content").append(hotkey_node);
  }
}

/**
 * Get active hotkey tab
 * Returns the currently active hotkey tab
 * 
 * @returns {number} - Active tab number (1-5)
 */
function getActiveHotkeyTab() {
  const activeTab = $("#hotkey_tabs .nav-link.active");
  return $("#hotkey_tabs .nav-link").index(activeTab) + 1;
}

/**
 * Set active hotkey tab
 * Sets the specified tab as active
 * 
 * @param {number} tabNumber - Tab number to activate (1-5)
 */
function setActiveHotkeyTab(tabNumber) {
  if (tabNumber >= 1 && tabNumber <= 5) {
    $(`#hotkey_tabs li:nth-child(${tabNumber}) a`).tab("show");
  }
}

/**
 * Get hotkey element
 * Returns the jQuery element for a specific hotkey
 * 
 * @param {string} hotkey - Hotkey identifier (e.g., 'f1', 'f2')
 * @returns {jQuery} - Hotkey element
 */
function getHotkeyElement(hotkey) {
  return $(`.hotkeys.active #${hotkey}_hotkey`);
}

/**
 * Get all hotkey elements
 * Returns all hotkey elements in the active tab
 * 
 * @returns {jQuery} - All hotkey elements
 */
function getAllHotkeyElements() {
  return $(".hotkeys.active li");
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
  element.addClass(className);
  
  // Remove highlight after animation
  setTimeout(() => {
    element.removeClass(className);
  }, 1000);
}

/**
 * Clear hotkey highlighting
 * Removes all highlighting from hotkeys
 */
function clearHotkeyHighlighting() {
  $(".hotkeys.active li").removeClass('highlight');
}

/**
 * Update hotkey display
 * Updates the visual display of hotkeys
 * 
 * @param {Object} options - Additional options
 */
function updateHotkeyDisplay(options = {}) {
  // Update hotkey labels and styling
  $(".hotkeys.active li").each(function() {
    const songId = $(this).attr("songid");
    if (songId) {
      setLabelFromSongId(songId, $(this));
    }
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
  return element && element.length > 0 && element.hasClass('hotkey');
}

/**
 * Create hotkey element
 * Creates a new hotkey element
 * 
 * @param {string} hotkey - Hotkey identifier (e.g., 'f1', 'f2')
 * @returns {jQuery} - Created hotkey element
 */
function createHotkeyElement(hotkey) {
  const element = $(`<li id="${hotkey}_hotkey" class="hotkey" draggable="true" ondragstart="songDrag(event)"></li>`);
  return element;
}

/**
 * Remove hotkey element
 * Removes a hotkey element
 * 
 * @param {string} hotkey - Hotkey identifier (e.g., 'f1', 'f2')
 */
function removeHotkeyElement(hotkey) {
  $(`#${hotkey}_hotkey`).remove();
}

/**
 * Get hotkey song ID
 * Returns the song ID assigned to a hotkey
 * 
 * @param {string} hotkey - Hotkey identifier (e.g., 'f1', 'f2')
 * @returns {string} - Song ID or null
 */
function getHotkeySongId(hotkey) {
  return $(`#${hotkey}_hotkey`).attr("songid") || null;
}

/**
 * Set hotkey song ID
 * Assigns a song ID to a hotkey
 * 
 * @param {string} hotkey - Hotkey identifier (e.g., 'f1', 'f2')
 * @param {string} songId - Song ID to assign
 */
function setHotkeySongId(hotkey, songId) {
  $(`#${hotkey}_hotkey`).attr("songid", songId);
}

/**
 * Clear hotkey song ID
 * Removes the song ID assignment from a hotkey
 * 
 * @param {string} hotkey - Hotkey identifier (e.g., 'f1', 'f2')
 */
function clearHotkeySongId(hotkey) {
  $(`#${hotkey}_hotkey`).removeAttr("songid");
  $(`#${hotkey}_hotkey`).text("");
}

/**
 * Get hotkey label
 * Returns the display label for a hotkey
 * 
 * @param {string} hotkey - Hotkey identifier (e.g., 'f1', 'f2')
 * @returns {string} - Hotkey label
 */
function getHotkeyLabel(hotkey) {
  return $(`#${hotkey}_hotkey`).text() || "";
}

/**
 * Set hotkey label
 * Sets the display label for a hotkey
 * 
 * @param {string} hotkey - Hotkey identifier (e.g., 'f1', 'f2')
 * @param {string} label - Label to set
 */
function setHotkeyLabel(hotkey, label) {
  $(`#${hotkey}_hotkey`).text(label);
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
  getHotkeyElement,
  getAllHotkeyElements,
  highlightHotkey,
  clearHotkeyHighlighting,
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
  getHotkeyElement,
  getAllHotkeyElements,
  highlightHotkey,
  clearHotkeyHighlighting,
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