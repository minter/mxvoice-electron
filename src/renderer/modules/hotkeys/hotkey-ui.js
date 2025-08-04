/**
 * Hotkey UI Management
 * 
 * Handles UI operations for hotkeys including:
 * - Drag and drop functionality
 * - Tab management
 * - UI event handling
 * 
 * @module hotkey-ui
 */

/**
 * Handle hotkey drop event
 * Processes drag and drop for hotkey assignment
 * 
 * @param {Event} event - Drop event
 * @param {Object} options - Options object containing dependencies
 */
function hotkeyDrop(event, options = {}) {
  const { setLabelFromSongId } = options;
  
  event.preventDefault();
  const song_id = event.dataTransfer.getData("text");
  const target = $(event.currentTarget);
  target.attr("songid", song_id);
  if (setLabelFromSongId) {
    setLabelFromSongId(song_id, target);
  }
}

/**
 * Allow hotkey drop event
 * Enables drop functionality for hotkeys
 * 
 * @param {Event} event - Drag over event
 */
function allowHotkeyDrop(event) {
  event.preventDefault();
}

/**
 * Switch to hotkey tab
 * Changes the active hotkey tab
 * 
 * @param {number} tab - Tab number to switch to
 */
function switchToHotkeyTab(tab) {
  $(`#hotkey_tabs li:nth-child(${tab}) a`).tab("show");
}

/**
 * Rename hotkey tab
 * Allows user to rename the current hotkey tab
 * 
 * @param {Object} options - Options object containing dependencies
 */
function renameHotkeyTab(options = {}) {
  const { saveHotkeysToStore } = options;
  
  const currentName = $("#hotkey_tabs .nav-link.active").text();
  customPrompt("Rename Hotkey Tab", "Enter a new name for this tab:", currentName, (newName) => {
    if (newName && newName.trim() !== "") {
      $("#hotkey_tabs .nav-link.active").text(newName);
      if (saveHotkeysToStore) {
        saveHotkeysToStore();
      }
    }
  });
}

/**
 * Set up hotkey event listeners
 * Configures all event listeners for hotkey functionality
 * 
 * @param {Object} options - Options object containing dependencies
 */
function setupHotkeyEventListeners(options = {}) {
  const { playSongFromHotkey, hotkeyDrop, allowHotkeyDrop, renameHotkeyTab } = options;
  
  // Hotkey click events
  $(".hotkeys").on("click", "li", (event) => {
    // Only select if the hotkey has a song assigned
    if ($(event.currentTarget).attr("songid")) {
      $("#selected_row").removeAttr("id");
      $(event.currentTarget).attr("id", "selected_row");
    }
  });

  // Hotkey double-click events
  $(".hotkeys").on("dblclick", "li", (event) => {
    $(".now_playing").first().removeClass("now_playing");
    $("#selected_row").removeAttr("id");
    if ($(event.currentTarget).find("span").text().length) {
      const song_id = $(event.currentTarget).attr("songid");
      if (song_id && playSongFromHotkey) {
        playSongFromHotkey(song_id);
      }
    }
  });

  // Hotkey drag and drop events
  $(".hotkeys li").on("drop", (event) => {
    $(event.currentTarget).removeClass("drop_target");
    if (!event.originalEvent.dataTransfer.getData("text").length) return;
    if (hotkeyDrop) {
      hotkeyDrop(event.originalEvent, options);
    }
  });

  $(".hotkeys li").on("dragover", (event) => {
    $(event.currentTarget).addClass("drop_target");
    if (allowHotkeyDrop) {
      allowHotkeyDrop(event.originalEvent);
    }
  });

  $(".hotkeys li").on("dragleave", (event) => {
    $(event.currentTarget).removeClass("drop_target");
  });

  // Hotkey tab events
  $("#hotkey_tabs").on("dblclick", ".nav-link", () => {
    if (renameHotkeyTab) {
      renameHotkeyTab(options);
    }
  });

  console.log('✅ Hotkeys event listeners set up');
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
 * @param {Object} options - Options object containing dependencies
 */
function updateHotkeyDisplay(options = {}) {
  const { setLabelFromSongId } = options;
  
  // Update all hotkey labels
  for (let key = 1; key <= 12; key++) {
    const element = getHotkeyElement(`f${key}`);
    const songId = element.attr("songid");
    if (songId && setLabelFromSongId) {
      setLabelFromSongId(songId, element, options);
    }
  }
}

/**
 * Validate hotkey element
 * Checks if a hotkey element is valid
 * 
 * @param {jQuery} element - Hotkey element to validate
 * @returns {boolean} - True if element is valid
 */
function validateHotkeyElement(element) {
  return element && element.length > 0 && element.hasClass('hotkey');
}

/**
 * Create hotkey element
 * Creates a new hotkey element
 * 
 * @param {string} hotkey - Hotkey identifier (e.g., 'f1', 'f2')
 * @returns {jQuery} - New hotkey element
 */
function createHotkeyElement(hotkey) {
  const element = $(`<li id="${hotkey}_hotkey" class="hotkey list-group-item"></li>`);
  element.append('<span></span>');
  return element;
}

/**
 * Remove hotkey element
 * Removes a hotkey element from the DOM
 * 
 * @param {string} hotkey - Hotkey identifier (e.g., 'f1', 'f2')
 */
function removeHotkeyElement(hotkey) {
  const element = getHotkeyElement(hotkey);
  if (element.length > 0) {
    element.remove();
  }
}

/**
 * Get hotkey song ID
 * Gets the song ID assigned to a hotkey
 * 
 * @param {string} hotkey - Hotkey identifier (e.g., 'f1', 'f2')
 * @returns {string} - Song ID or null
 */
function getHotkeySongId(hotkey) {
  const element = getHotkeyElement(hotkey);
  return element.attr("songid") || null;
}

/**
 * Set hotkey song ID
 * Sets the song ID for a hotkey
 * 
 * @param {string} hotkey - Hotkey identifier (e.g., 'f1', 'f2')
 * @param {string} songId - Song ID to assign
 */
function setHotkeySongId(hotkey, songId) {
  const element = getHotkeyElement(hotkey);
  element.attr("songid", songId);
}

/**
 * Clear hotkey song ID
 * Removes the song ID from a hotkey
 * 
 * @param {string} hotkey - Hotkey identifier (e.g., 'f1', 'f2')
 */
function clearHotkeySongId(hotkey) {
  const element = getHotkeyElement(hotkey);
  element.removeAttr("songid");
  element.find("span").html("");
}

/**
 * Get hotkey label
 * Gets the display label for a hotkey
 * 
 * @param {string} hotkey - Hotkey identifier (e.g., 'f1', 'f2')
 * @returns {string} - Hotkey label
 */
function getHotkeyLabel(hotkey) {
  const element = getHotkeyElement(hotkey);
  return element.find("span").text();
}

/**
 * Set hotkey label
 * Sets the display label for a hotkey
 * 
 * @param {string} hotkey - Hotkey identifier (e.g., 'f1', 'f2')
 * @param {string} label - Label text
 */
function setHotkeyLabel(hotkey, label) {
  const element = getHotkeyElement(hotkey);
  element.find("span").html(label);
}

/**
 * Check if hotkey is assigned
 * Checks if a hotkey has a song assigned
 * 
 * @param {string} hotkey - Hotkey identifier (e.g., 'f1', 'f2')
 * @returns {boolean} - True if hotkey is assigned
 */
function isHotkeyAssigned(hotkey) {
  const songId = getHotkeySongId(hotkey);
  return songId !== null && songId !== undefined;
}

/**
 * Get assigned hotkeys
 * Returns all hotkeys that have songs assigned
 * 
 * @returns {Array} - Array of assigned hotkey identifiers
 */
function getAssignedHotkeys() {
  const assigned = [];
  for (let key = 1; key <= 12; key++) {
    const hotkey = `f${key}`;
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
  for (let key = 1; key <= 12; key++) {
    const hotkey = `f${key}`;
    if (!isHotkeyAssigned(hotkey)) {
      unassigned.push(hotkey);
    }
  }
  return unassigned;
}

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