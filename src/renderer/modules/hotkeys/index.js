/**
 * Hotkeys Module Index
 * 
 * This module serves as the main entry point for all hotkey-related functionality
 * in the MxVoice Electron application.
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

// Import hotkey sub-modules
import * as hotkeyData from './hotkey-data.js';
import * as hotkeyOperations from './hotkey-operations.js';
import * as hotkeyUI from './hotkey-ui.js';

/**
 * Hotkeys Module Class
 * 
 * Provides comprehensive hotkey management functionality including:
 * - F1-F12 hotkey assignment and playback
 * - Drag & drop hotkey assignment
 * - File import/export for hotkey configurations
 * - Tab management for multiple hotkey sets
 * - Store persistence for hotkey state
 */
class HotkeysModule {
  constructor(options = {}) {
    debugLog?.info('🔄 HotkeysModule constructor called with options:', options, { module: 'hotkeys', function: 'constructor' });
    this.electronAPI = options.electronAPI;
    this.db = options.db;
    this.store = options.store;
    debugLog?.info('🔄 this.electronAPI set:', !!this.electronAPI, { module: 'hotkeys', function: 'constructor' });
    debugLog?.info('🔄 this.store set:', !!this.store, { module: 'hotkeys', function: 'constructor' });
    
    // Initialize sub-modules
    this.data = hotkeyData;
    this.operations = hotkeyOperations;
    this.ui = hotkeyUI;
    
    // Check if sub-modules are properly loaded
    if (!hotkeyData || !hotkeyOperations || !hotkeyUI) {
      debugLog?.error('❌ Hotkeys sub-modules not properly loaded:', {
        hotkeyData: !!hotkeyData,
        hotkeyOperations: !!hotkeyOperations,
        hotkeyUI: !!hotkeyUI
      }, { module: 'hotkeys', function: 'constructor' });
      throw new Error('Hotkeys sub-modules not properly loaded');
    }
    
    // Delegate to sub-modules for functions with error handling
    try {
      this.saveHotkeysToStore = hotkeyOperations.saveHotkeysToStore.bind(this);
      this.loadHotkeysFromStore = hotkeyOperations.loadHotkeysFromStore.bind(this);
      // Use the class's own populateHotkeys method instead of the hotkeyData one
      // this.populateHotkeys = hotkeyData.populateHotkeys.bind(this);
      // Use the class's own setLabelFromSongId method instead of the hotkeyData one
      // this.setLabelFromSongId = hotkeyData.setLabelFromSongId.bind(this);
      this.clearHotkeys = hotkeyData.clearHotkeys.bind(this);
      this.openHotkeyFile = hotkeyOperations.openHotkeyFile.bind(this);
      this.saveHotkeyFile = hotkeyOperations.saveHotkeyFile.bind(this);
      this.playSongFromHotkey = hotkeyOperations.playSongFromHotkey.bind(this);
      this.sendToHotkeys = hotkeyOperations.sendToHotkeys.bind(this);
      this.hotkeyDrop = hotkeyUI.hotkeyDrop.bind(this);
      this.allowHotkeyDrop = hotkeyUI.allowHotkeyDrop.bind(this);
      this.switchToHotkeyTab = hotkeyUI.switchToHotkeyTab.bind(this);
      this.renameHotkeyTab = hotkeyUI.renameHotkeyTab.bind(this);
      this.removeFromHotkey = hotkeyOperations.removeFromHotkey.bind(this);
      this.exportHotkeyConfig = hotkeyOperations.exportHotkeyConfig.bind(this);
      this.importHotkeyConfig = hotkeyOperations.importHotkeyConfig.bind(this);
      this.clearHotkeyConfig = hotkeyOperations.clearHotkeyConfig.bind(this);
      this.getHotkeyConfig = hotkeyOperations.getHotkeyConfig.bind(this);
      this.setHotkeyConfig = hotkeyOperations.setHotkeyConfig.bind(this);
    } catch (error) {
      debugLog?.error('❌ Error binding hotkey functions:', error, { module: 'hotkeys', function: 'constructor' });
      throw error;
    }
    
    // Initialize the module
    this.initHotkeys();
  }

  /**
   * Initialize hotkeys module
   * Sets up initial state and loads saved hotkeys
   */
  initHotkeys() {
    debugLog?.info('🎹 Initializing Hotkeys Module...', { module: 'hotkeys', function: 'initHotkeys' });
    
    // Load saved hotkeys from store
    this.loadHotkeysFromStore();
    
    // Set up event listeners
    this.setupEventListeners();
    
    debugLog?.info('✅ Hotkeys Module initialized', { module: 'hotkeys', function: 'initHotkeys' });
  }

  /**
   * Set up event listeners for hotkey functionality
   */
  setupEventListeners() {
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
        if (song_id) {
          this.playSongFromHotkey(song_id);
        }
      }
    });

    // Hotkey drag and drop events
    $(".hotkeys li").on("drop", (event) => {
      $(event.currentTarget).removeClass("drop_target");
      if (!event.originalEvent.dataTransfer.getData("text").length) return;
      this.hotkeyDrop(event.originalEvent, { setLabelFromSongId: this.setLabelFromSongId.bind(this) });
    });

    $(".hotkeys li").on("dragover", (event) => {
      $(event.currentTarget).addClass("drop_target");
      this.allowHotkeyDrop(event.originalEvent);
    });

    $(".hotkeys li").on("dragleave", (event) => {
      $(event.currentTarget).removeClass("drop_target");
    });

    // Hotkey tab events
    $("#hotkey_tabs").on("dblclick", ".nav-link", () => {
      this.renameHotkeyTab();
    });

    debugLog?.info('✅ Hotkeys event listeners set up', { module: 'hotkeys', function: 'setupEventListeners' });
  }

  /**
   * Save hotkeys to store
   * Only saves if we have the new HTML format with header button
   */
  saveHotkeysToStore() {
    const currentHtml = $("#hotkeys-column").html();
    if (currentHtml.includes("header-button")) {
      if (this.electronAPI && this.electronAPI.store) {
        this.electronAPI.store.set("hotkeys", currentHtml).then(result => {
          if (result.success) {
            debugLog?.info('✅ Hotkeys saved to store successfully', { module: 'hotkeys', function: 'saveHotkeysToStore' });
          } else {
            debugLog?.warn('❌ Failed to save hotkeys to store:', result.error, { module: 'hotkeys', function: 'saveHotkeysToStore' });
          }
        }).catch(error => {
          debugLog?.warn('❌ Store save error:', error, { module: 'hotkeys', function: 'saveHotkeysToStore' });
        });
      } else if (this.store) {
        this.store.set("hotkeys", currentHtml);
      }
    }
  }

  /**
   * Load hotkeys from store
   * Loads saved hotkey state and populates UI
   */
  loadHotkeysFromStore() {
    if (this.electronAPI && this.electronAPI.store) {
      this.electronAPI.store.has("hotkeys").then(hasHotkeys => {
        if (hasHotkeys) {
          this.electronAPI.store.get("hotkeys").then(storedHotkeysHtml => {
            // Check if the stored HTML contains the old plain text header
            if (
              storedHotkeysHtml && typeof storedHotkeysHtml === 'string' &&
              storedHotkeysHtml.includes("Hotkeys") &&
              !storedHotkeysHtml.includes("header-button")
            ) {
              // This is the old HTML format, clear it so the new HTML loads
              this.electronAPI.store.delete("hotkeys").then(() => {
                debugLog?.info("Cleared old hotkeys HTML format", { module: 'hotkeys', function: 'loadHotkeysFromStore' });
              });
            } else if (storedHotkeysHtml && typeof storedHotkeysHtml === 'string') {
              $("#hotkeys-column").html(storedHotkeysHtml);
              $("#selected_row").removeAttr("id");
            }
          });
        }
      });
    } else if (this.store) {
      // Fallback to legacy store access
      if (this.store.has("hotkeys")) {
        const storedHotkeysHtml = this.store.get("hotkeys");
        if (
          storedHotkeysHtml && typeof storedHotkeysHtml === 'string' &&
          storedHotkeysHtml.includes("Hotkeys") &&
          !storedHotkeysHtml.includes("header-button")
        ) {
          this.store.delete("hotkeys");
          debugLog?.info("Cleared old hotkeys HTML format", { module: 'hotkeys', function: 'loadHotkeysFromStore' });
        } else if (storedHotkeysHtml && typeof storedHotkeysHtml === 'string') {
          $("#hotkeys-column").html(storedHotkeysHtml);
          $("#selected_row").removeAttr("id");
        }
      }
    }
  }

  /**
   * Populate hotkeys with data
   * Sets song IDs and labels for hotkey elements
   * 
   * @param {Object} fkeys - Object containing hotkey data
   * @param {string} title - Title for the hotkey tab
   */
  _populateHotkeysImpl(fkeys, title) {
    debugLog?.info('🔄 ===== POPULATEHOTKEYS FUNCTION ENTERED =====', { module: 'hotkeys', function: 'populateHotkeys' });
    debugLog?.info('🔄 populateHotkeys called with:', { fkeys, title }, { module: 'hotkeys', function: 'populateHotkeys' });
    debugLog?.info('🔄 electronAPI available:', !!window.electronAPI, { module: 'hotkeys', function: 'populateHotkeys' });
    debugLog?.info('🔄 database API available:', !!window.electronAPI?.database, { module: 'hotkeys', function: 'populateHotkeys' });
    debugLog?.info('🔄 this.electronAPI available:', !!this.electronAPI, { module: 'hotkeys', function: 'populateHotkeys' });
    debugLog?.info('🔄 this.electronAPI.database available:', !!this.electronAPI?.database, { module: 'hotkeys', function: 'populateHotkeys' });
    
    // Check DOM structure
    debugLog?.info('🔄 .hotkeys.active elements found:', $('.hotkeys.active').length, { module: 'hotkeys', function: 'populateHotkeys' });
    debugLog?.info('🔄 .hotkeys.active li elements found:', $('.hotkeys.active li').length, { module: 'hotkeys', function: 'populateHotkeys' });
    debugLog?.info('🔄 #f1_hotkey element found:', $('#f1_hotkey').length, { module: 'hotkeys', function: 'populateHotkeys' });
    debugLog?.info('🔄 #f2_hotkey element found:', $('#f2_hotkey').length, { module: 'hotkeys', function: 'populateHotkeys' });
    
    // Test database connectivity with a sample song ID
    if (this.electronAPI && this.electronAPI.database) {
      debugLog?.info('🔄 Testing database connectivity...', { module: 'hotkeys', function: 'populateHotkeys' });
      const testSongId = '800'; // From your hotkey file
      this.electronAPI.database.query("SELECT COUNT(*) as count FROM mrvoice WHERE id = ?", [testSongId])
        .then(result => {
          debugLog?.info(`🔄 Database test result for song ${testSongId}:`, result, { module: 'hotkeys', function: 'populateHotkeys' });
        })
        .catch(error => {
                      debugLog?.error(`❌ Database test failed for song ${testSongId}:`, error, { module: 'hotkeys', function: 'populateHotkeys' });
        });
    }
    
    if (!fkeys || Object.keys(fkeys).length === 0) {
      debugLog?.info('⚠️ No hotkey data provided to populateHotkeys', { module: 'hotkeys', function: 'populateHotkeys' });
      return;
    }
    
    for (const key in fkeys) {
      debugLog?.info(`🔄 Processing hotkey ${key} with value: ${fkeys[key]}`, { module: 'hotkeys', function: 'populateHotkeys' });
      const hotkeyElement = $(`.hotkeys.active #${key}_hotkey`);
              debugLog?.info(`🔄 Found hotkey element for ${key}:`, hotkeyElement.length > 0, { module: 'hotkeys', function: 'populateHotkeys' });
      
      if (fkeys[key]) {
        try {
          debugLog?.info(`🔄 Setting hotkey ${key} with song ID: ${fkeys[key]}`, { module: 'hotkeys', function: 'populateHotkeys' });
          hotkeyElement.attr("songid", fkeys[key]);
                      debugLog?.info(`🔄 About to call setLabelFromSongId for ${key}...`, { module: 'hotkeys', function: 'populateHotkeys' });
          this.setLabelFromSongId(fkeys[key], hotkeyElement);
                      debugLog?.info(`🔄 setLabelFromSongId called for ${key}`, { module: 'hotkeys', function: 'populateHotkeys' });
        } catch (err) {
                      debugLog?.error(`❌ Error loading fkey ${key} (DB ID: ${fkeys[key]})`, err, { module: 'hotkeys', function: 'populateHotkeys' });
        }
      } else {
                  debugLog?.info(`🔄 Clearing hotkey ${key}`, { module: 'hotkeys', function: 'populateHotkeys' });
        hotkeyElement.removeAttr("songid");
        hotkeyElement.find("span").html("");
      }
    }
    if (title) {
      debugLog?.info(`🔄 Setting hotkey tab title to: ${title}`, { module: 'hotkeys', function: 'populateHotkeys' });
      $("#hotkey_tabs li a.active").text(title);
    }
    debugLog?.info('✅ populateHotkeys completed successfully', { module: 'hotkeys', function: 'populateHotkeys' });
  }

  /**
   * Public populateHotkeys method - calls the implementation
   */
  populateHotkeys(fkeys, title) {
    return this._populateHotkeysImpl(fkeys, title);
  }

  /**
   * Set label from song ID
   * Updates hotkey label with song information
   * 
   * @param {string} song_id - Song ID
   * @param {jQuery} element - Hotkey element to update
   */
  setLabelFromSongId(song_id, element) {
    debugLog?.info(`🔄 setLabelFromSongId called with song_id: ${song_id}`, { module: 'hotkeys', function: 'setLabelFromSongId' });
    debugLog?.info(`🔄 element found:`, element.length > 0, { module: 'hotkeys', function: 'setLabelFromSongId' });
    
    // Use new database API for getting song by ID
    if (this.electronAPI && this.electronAPI.database) {
      debugLog?.info(`🔄 Using database API to query song ${song_id}`, { module: 'hotkeys', function: 'setLabelFromSongId' });
      debugLog?.info(`🔄 Database API available:`, !!this.electronAPI.database, { module: 'hotkeys', function: 'setLabelFromSongId' });
      debugLog?.info(`🔄 Database query method available:`, typeof this.electronAPI.database.query, { module: 'hotkeys', function: 'setLabelFromSongId' });
      
      this.electronAPI.database.query("SELECT * from mrvoice WHERE id = ?", [song_id]).then((result) => {
        debugLog?.info(`🔄 Database query result for song ${song_id}:`, result, { module: 'hotkeys', function: 'setLabelFromSongId' });
        if (result.success && result.data.length > 0) {
          const row = result.data[0];
          const title = row.title || "[Unknown Title]";
          const artist = row.artist || "[Unknown Artist]";
          const time = row.time || "[??:??]";
          debugLog?.info(`🔄 Found song: ${title} by ${artist} (${time})`, { module: 'hotkeys', function: 'setLabelFromSongId' });
          
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
          this.saveHotkeysToStore();
        } else {
          debugLog?.warn('❌ Failed to get song by ID:', result.error, { module: 'hotkeys', function: 'setLabelFromSongId' });
          this.fallbackSetLabelFromSongId(song_id, element);
        }
      }).catch((error) => {
        debugLog?.warn('❌ Database API error:', error, { module: 'hotkeys', function: 'setLabelFromSongId' });
        this.fallbackSetLabelFromSongId(song_id, element);
      });
    } else {
      this.fallbackSetLabelFromSongId(song_id, element);
    }
  }

  /**
   * Fallback method for setting label from song ID
   * Uses legacy database access
   * 
   * @param {string} song_id - Song ID
   * @param {jQuery} element - Hotkey element to update
   */
  fallbackSetLabelFromSongId(song_id, element) {
    if (this.db) {
      const stmt = this.db.prepare("SELECT * from mrvoice WHERE id = ?");
      const row = stmt.get(song_id);
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
      this.saveHotkeysToStore();
    }
  }

  /**
   * Clear all hotkeys
   * Removes all song assignments from hotkeys
   */
  clearHotkeys() {
    customConfirm("Are you sure you want clear your hotkeys?", () => {
      for (let key = 1; key <= 12; key++) {
        $(`.hotkeys.active #f${key}_hotkey`).removeAttr("songid");
        $(`.hotkeys.active #f${key}_hotkey span`).html("");
      }
      this.saveHotkeysToStore();
    });
  }

  /**
   * Open hotkey file
   * Imports hotkey configuration from file
   */
  openHotkeyFile() {
    if (this.electronAPI) {
      this.electronAPI.openHotkeyFile().catch(error => {
        debugLog?.warn('Modern API failed, falling back to legacy:', error, { module: 'hotkeys', function: 'openHotkeyFile' });
        if (typeof ipcRenderer !== 'undefined') {
          ipcRenderer.send("open-hotkey-file");
        }
      });
    } else if (typeof ipcRenderer !== 'undefined') {
      ipcRenderer.send("open-hotkey-file");
    }
  }

  /**
   * Save hotkey file
   * Exports hotkey configuration to file
   */
  saveHotkeyFile() {
    debugLog?.info("Renderer starting saveHotkeyFile", { module: 'hotkeys', function: 'saveHotkeyFile' });
    const hotkeyArray = [];
    for (let key = 1; key <= 12; key++) {
      hotkeyArray.push($(`.hotkeys.active li#f${key}_hotkey`).attr("songid"));
    }
    if (!/^\d$/.test($("#hotkey_tabs li a.active").text())) {
      hotkeyArray.push($("#hotkey_tabs li a.active").text());
    }
    
    if (this.electronAPI) {
      this.electronAPI.saveHotkeyFile(hotkeyArray).catch(error => {
        debugLog?.warn('Modern API failed, falling back to legacy:', error, { module: 'hotkeys', function: 'saveHotkeyFile' });
        if (typeof ipcRenderer !== 'undefined') {
          ipcRenderer.send("save-hotkey-file", hotkeyArray);
        }
      });
    } else if (typeof ipcRenderer !== 'undefined') {
      ipcRenderer.send("save-hotkey-file", hotkeyArray);
    }
  }

  /**
   * Play song from hotkey
   * Plays the song assigned to the specified hotkey
   * 
   * @param {string} hotkey - Hotkey identifier (e.g., 'f1', 'f2')
   */
  playSongFromHotkey(hotkey) {
    debugLog?.info("Getting song ID from hotkey " + hotkey, { module: 'hotkeys', function: 'playSongFromHotkey' });
    const song_id = $(`.hotkeys.active #${hotkey}_hotkey`).attr("songid");
    debugLog?.info(`Found song ID ${song_id}`, { module: 'hotkeys', function: 'playSongFromHotkey' });
    if (song_id) {
      debugLog?.info(`Preparing to play song ${song_id}`, { module: 'hotkeys', function: 'playSongFromHotkey' });
      // Unhighlight any selected tracks in holding tank or playlist
      $(".now_playing").first().removeClass("now_playing");
      $("#selected_row").removeAttr("id");
      // Hotkey playback should not affect holding tank mode
      // Just play the song without changing autoplay state
      debugLog?.info("🔍 HOTKEY PLAYBACK: Checking if playSongFromId is available", { 
        module: 'hotkeys', 
        function: 'playSongFromHotkey',
        song_id: song_id,
        playSongFromId_type: typeof playSongFromId,
        playSongFromId_available: typeof playSongFromId === 'function'
      });
      
      if (typeof playSongFromId === 'function') {
        debugLog?.info("🎵 HOTKEY PLAYBACK: Calling playSongFromId", { 
          module: 'hotkeys', 
          function: 'playSongFromHotkey',
          song_id: song_id
        });
        playSongFromId(song_id);
      } else {
        debugLog?.error("❌ HOTKEY PLAYBACK FAIL: playSongFromId not available", { 
          module: 'hotkeys', 
          function: 'playSongFromHotkey',
          song_id: song_id,
          playSongFromId_type: typeof playSongFromId
        });
      }
      const hotkeyElement = $(`.hotkeys.active #${hotkey}_hotkey`)[0];
      if (hotkeyElement) {
        animateCSS(hotkeyElement, "flipInX");
      }
    }
  }

  /**
   * Send selected song to hotkeys
   * Assigns the currently selected song to the first empty hotkey slot
   */
  sendToHotkeys() {
    if ($("#selected_row").is("span")) {
      return;
    }
    const target = $(".hotkeys.active li").not("[songid]").first();
    const song_id = $("#selected_row").attr("songid");
    if ($(`.hotkeys.active li[songid=${song_id}]`).length) {
      return;
    }
    if (target && song_id) {
      target.attr("songid", song_id);
      this.setLabelFromSongId(song_id, target);
    }
    return false;
  }

  /**
   * Handle hotkey drop event
   * Processes drag and drop for hotkey assignment
   * 
   * @param {Event} event - Drop event
   */
  // hotkeyDrop method removed - using hotkeyUI.hotkeyDrop instead

  /**
   * Allow hotkey drop event
   * Enables drop functionality for hotkeys
   * 
   * @param {Event} event - Drag over event
   */
  // allowHotkeyDrop method removed - using hotkeyUI.allowHotkeyDrop instead

  /**
   * Switch to hotkey tab
   * Changes the active hotkey tab
   * 
   * @param {number} tab - Tab number to switch to
   */
  switchToHotkeyTab(tab) {
    $(`#hotkey_tabs li:nth-child(${tab}) a`).tab("show");
  }

  /**
   * Rename hotkey tab
   * Allows user to rename the current hotkey tab
   */
  async renameHotkeyTab() {
    const currentName = $("#hotkey_tabs .nav-link.active").text();
    const newName = await customPrompt("Enter a new name for this tab:", currentName, "Rename Hotkey Tab");
    if (newName && newName.trim() !== "") {
      $("#hotkey_tabs .nav-link.active").text(newName);
      this.saveHotkeysToStore();
      return { success: true, newName: newName };
    } else {
      return { success: false, error: 'Invalid name' };
    }
  }

  /**
   * Remove song from hotkey
   * Removes the selected song from its hotkey assignment
   */
  removeFromHotkey() {
    const songId = $("#selected_row").attr("songid");
    debugLog?.info("removeFromHotkey called, songId:", songId, { module: 'hotkeys', function: 'removeFromHotkey' });
    debugLog?.info("selected_row element:", $("#selected_row"), { module: 'hotkeys', function: 'removeFromHotkey' });
    
    if (songId) {
      debugLog?.info(`Preparing to remove song ${songId} from hotkey`, { module: 'hotkeys', function: 'removeFromHotkey' });
      if (this.db) {
        const songStmt = this.db.prepare("SELECT * FROM mrvoice WHERE ID = ?");
        const songRow = songStmt.get(songId);
        
        if (songRow) {
          customConfirm(`Are you sure you want to remove ${songRow.title} from this hotkey?`, () => {
            debugLog?.info("Proceeding with removal from hotkey", { module: 'hotkeys', function: 'removeFromHotkey' });
            // Clear the hotkey slot
            $("#selected_row").removeAttr("songid");
            $("#selected_row span").html("");
            // Clear the selection
            $("#selected_row").removeAttr("id");
            // Save the updated hotkeys to store
            this.saveHotkeysToStore();
            debugLog?.info("Hotkey cleared successfully", { module: 'hotkeys', function: 'removeFromHotkey' });
          });
        } else {
                      debugLog?.error("Song not found in database for ID:", songId, { module: 'hotkeys', function: 'removeFromHotkey' });
          // Still clear the hotkey even if song not found
          $("#selected_row").removeAttr("songid");
          $("#selected_row span").html("");
          $("#selected_row").removeAttr("id");
          this.saveHotkeysToStore();
        }
      } else {
        // Clear the hotkey even if database is not available
        $("#selected_row").removeAttr("songid");
        $("#selected_row span").html("");
        $("#selected_row").removeAttr("id");
        this.saveHotkeysToStore();
      }
    } else {
      debugLog?.info("No songId found on selected row", { module: 'hotkeys', function: 'removeFromHotkey' });
    }
  }

  /**
   * Get all hotkey functions
   * Returns all hotkey-related functions for external use
   * 
   * @returns {Object} - Object containing all hotkey functions
   */
  getAllHotkeyFunctions() {
    return {
      // Core functions - properly bound to maintain context
      saveHotkeysToStore: this.saveHotkeysToStore.bind(this),
      loadHotkeysFromStore: this.loadHotkeysFromStore.bind(this),
      initHotkeys: this.initHotkeys.bind(this),
      
      // Data management - properly bound to maintain context
      populateHotkeys: this.populateHotkeys.bind(this),
      setLabelFromSongId: this.setLabelFromSongId.bind(this),
      clearHotkeys: this.clearHotkeys.bind(this),
      
      // File operations - properly bound to maintain context
      openHotkeyFile: this.openHotkeyFile.bind(this),
      saveHotkeyFile: this.saveHotkeyFile.bind(this),
      
      // Playback functions - properly bound to maintain context
      playSongFromHotkey: this.playSongFromHotkey.bind(this),
      sendToHotkeys: this.sendToHotkeys.bind(this),
      
      // UI operations - properly bound to maintain context
      hotkeyDrop: this.hotkeyDrop.bind(this),
      allowHotkeyDrop: this.allowHotkeyDrop.bind(this),
      
      // Tab management - properly bound to maintain context
      switchToHotkeyTab: this.switchToHotkeyTab.bind(this),
      renameHotkeyTab: this.renameHotkeyTab.bind(this),
      
      // Removal function - properly bound to maintain context
      removeFromHotkey: this.removeFromHotkey.bind(this),
      
      // Wrapper functions for Function Registry HTML compatibility
      populateHotkeysWrapper: this.populateHotkeysWrapper.bind(this),
      clearHotkeysWrapper: this.clearHotkeysWrapper.bind(this),
      renameHotkeyTabWrapper: this.renameHotkeyTabWrapper.bind(this)
    };
  }

  /**
   * Wrapper for populateHotkeys - handles async operations for Function Registry
   */
  populateHotkeysWrapper(fkeys, title) {
    debugLog?.debug('populateHotkeysWrapper called', { fkeys, title });
    try {
      debugLog?.info('About to call populateHotkeys...');
      // Call the working implementation from hotkey-data.js
      hotkeyData.populateHotkeys(fkeys, title, {
        electronAPI: window.electronAPI,
        db: this.db || window.db,
        setLabelFromSongId: (songId, element) => {
          if (window.setLabelFromSongId) {
            window.setLabelFromSongId(songId, element);
          }
        },
        fallbackSetLabelFromSongId: this.fallbackSetLabelFromSongId.bind(this)
      });
      debugLog?.info('populateHotkeys completed successfully');
      return true;
    } catch (error) {
      debugLog?.error('Error in populateHotkeys', error);
      throw error;
    }
  }

  /**
   * Wrapper for clearHotkeys - handles async operations for Function Registry
   */
  clearHotkeysWrapper() {
    this.clearHotkeys().catch(error => {
      debugLog?.error('Error in clearHotkeys', error);
    });
  }

  /**
   * Wrapper for renameHotkeyTab - handles async operations for Function Registry
   */
  renameHotkeyTabWrapper() {
    this.renameHotkeyTab().catch(error => {
      debugLog?.error('Error in renameHotkeyTab', error);
    });
  }

  /**
   * Test all hotkey functions
   * 
   * @returns {Object} - Test results
   */
  testAllFunctions() {
    debugLog?.info('🧪 Testing Hotkeys Module Functions...', { module: 'hotkeys', function: 'testAllFunctions' });
    
    const testResults = {
      module: 'Hotkeys',
      timestamp: new Date().toISOString(),
      tests: {}
    };

    // Test core functions
    try {
      this.saveHotkeysToStore();
      testResults.tests.saveHotkeysToStore = { status: 'PASS', message: 'Function executed successfully' };
    } catch (error) {
      testResults.tests.saveHotkeysToStore = { status: 'FAIL', message: error.message };
    }

    try {
      this.loadHotkeysFromStore();
      testResults.tests.loadHotkeysFromStore = { status: 'PASS', message: 'Function executed successfully' };
    } catch (error) {
      testResults.tests.loadHotkeysFromStore = { status: 'FAIL', message: error.message };
    }

    // Test data management functions
    try {
      this.clearHotkeys();
      testResults.tests.clearHotkeys = { status: 'PASS', message: 'Function executed successfully' };
    } catch (error) {
      testResults.tests.clearHotkeys = { status: 'FAIL', message: error.message };
    }

    // Test file operations
    try {
      this.openHotkeyFile();
      testResults.tests.openHotkeyFile = { status: 'PASS', message: 'Function executed successfully' };
    } catch (error) {
      testResults.tests.openHotkeyFile = { status: 'FAIL', message: error.message };
    }

    try {
      this.saveHotkeyFile();
      testResults.tests.saveHotkeyFile = { status: 'PASS', message: 'Function executed successfully' };
    } catch (error) {
      testResults.tests.saveHotkeyFile = { status: 'FAIL', message: error.message };
    }

    // Test UI operations (using hotkeyUI functions)
    try {
      this.allowHotkeyDrop({ preventDefault: () => {} });
      testResults.tests.allowHotkeyDrop = { status: 'PASS', message: 'Function executed successfully' };
    } catch (error) {
      testResults.tests.allowHotkeyDrop = { status: 'FAIL', message: error.message };
    }

    // Test tab management
    try {
      this.switchToHotkeyTab(1);
      testResults.tests.switchToHotkeyTab = { status: 'PASS', message: 'Function executed successfully' };
    } catch (error) {
      testResults.tests.switchToHotkeyTab = { status: 'FAIL', message: error.message };
    }

    debugLog?.info('✅ Hotkeys Module tests completed', { module: 'hotkeys', function: 'testAllFunctions' });
    return testResults;
  }
}

export default HotkeysModule;

// Named exports for backward compatibility
export {
  HotkeysModule
}; 