/**
 * Hotkeys Module Index
 * 
 * This module serves as the main entry point for all hotkey-related functionality
 * in the MxVoice Electron application.
 */

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
    this.electronAPI = options.electronAPI;
    this.db = options.db;
    this.store = options.store;
    
    // Initialize sub-modules
    this.data = hotkeyData;
    this.operations = hotkeyOperations;
    this.ui = hotkeyUI;
    
    // Bind methods to maintain context
    this.saveHotkeysToStore = this.saveHotkeysToStore.bind(this);
    this.loadHotkeysFromStore = this.loadHotkeysFromStore.bind(this);
    this.initHotkeys = this.initHotkeys.bind(this);
    this.populateHotkeys = this.populateHotkeys.bind(this);
    this.setLabelFromSongId = this.setLabelFromSongId.bind(this);
    this.clearHotkeys = this.clearHotkeys.bind(this);
    this.openHotkeyFile = this.openHotkeyFile.bind(this);
    this.saveHotkeyFile = this.saveHotkeyFile.bind(this);
    this.playSongFromHotkey = this.playSongFromHotkey.bind(this);
    this.sendToHotkeys = this.sendToHotkeys.bind(this);
    this.hotkeyDrop = this.hotkeyDrop.bind(this);
    this.allowHotkeyDrop = this.allowHotkeyDrop.bind(this);
    this.switchToHotkeyTab = this.switchToHotkeyTab.bind(this);
    this.renameHotkeyTab = this.renameHotkeyTab.bind(this);
    this.removeFromHotkey = this.removeFromHotkey.bind(this);
    
    // Initialize the module
    this.initHotkeys();
  }

  /**
   * Initialize hotkeys module
   * Sets up initial state and loads saved hotkeys
   */
  initHotkeys() {
    console.log('🎹 Initializing Hotkeys Module...');
    
    // Load saved hotkeys from store
    this.loadHotkeysFromStore();
    
    // Set up event listeners
    this.setupEventListeners();
    
    console.log('✅ Hotkeys Module initialized');
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
      this.hotkeyDrop(event.originalEvent);
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

    console.log('✅ Hotkeys event listeners set up');
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
            console.log('✅ Hotkeys saved to store successfully');
          } else {
            console.warn('❌ Failed to save hotkeys to store:', result.error);
          }
        }).catch(error => {
          console.warn('❌ Store save error:', error);
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
                console.log("Cleared old hotkeys HTML format");
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
          console.log("Cleared old hotkeys HTML format");
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
  populateHotkeys(fkeys, title) {
    for (const key in fkeys) {
      if (fkeys[key]) {
        try {
          $(`.hotkeys.active #${key}_hotkey`).attr("songid", fkeys[key]);
          this.setLabelFromSongId(fkeys[key], $(`.hotkeys.active #${key}_hotkey`));
        } catch (err) {
          console.log(`Error loading fkey ${key} (DB ID: ${fkeys[key]})`);
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
   */
  setLabelFromSongId(song_id, element) {
    // Use new database API for getting song by ID
    if (this.electronAPI && this.electronAPI.database) {
      this.electronAPI.database.query("SELECT * from mrvoice WHERE id = ?", [song_id]).then(result => {
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
            $(element).find("span").attr("songid", song_id);
          }
          this.saveHotkeysToStore();
        } else {
          console.warn('❌ Failed to get song by ID:', result.error);
          this.fallbackSetLabelFromSongId(song_id, element);
        }
      }).catch(error => {
        console.warn('❌ Database API error:', error);
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
        $(element).find("span").attr("songid", song_id);
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
        console.warn('Modern API failed, falling back to legacy:', error);
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
    console.log("Renderer starting saveHotkeyFile");
    const hotkeyArray = [];
    for (let key = 1; key <= 12; key++) {
      hotkeyArray.push($(`.hotkeys.active li#f${key}_hotkey`).attr("songid"));
    }
    if (!/^\d$/.test($("#hotkey_tabs li a.active").text())) {
      hotkeyArray.push($("#hotkey_tabs li a.active").text());
    }
    
    if (this.electronAPI) {
      this.electronAPI.saveHotkeyFile(hotkeyArray).catch(error => {
        console.warn('Modern API failed, falling back to legacy:', error);
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
    console.log("Getting song ID from hotkey " + hotkey);
    const song_id = $(`.hotkeys.active #${hotkey}_hotkey`).attr("songid");
    console.log(`Found song ID ${song_id}`);
    if (song_id) {
      console.log(`Preparing to play song ${song_id}`);
      // Unhighlight any selected tracks in holding tank or playlist
      $(".now_playing").first().removeClass("now_playing");
      $("#selected_row").removeAttr("id");
      // Hotkey playback should not affect holding tank mode
      // Just play the song without changing autoplay state
      if (typeof playSongFromId === 'function') {
        playSongFromId(song_id);
      }
      animateCSS($(`.hotkeys.active #${hotkey}_hotkey`), "flipInX");
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
  hotkeyDrop(event) {
    event.preventDefault();
    const song_id = event.dataTransfer.getData("text");
    const target = $(event.currentTarget);
    target.attr("songid", song_id);
    this.setLabelFromSongId(song_id, target);
  }

  /**
   * Allow hotkey drop event
   * Enables drop functionality for hotkeys
   * 
   * @param {Event} event - Drag over event
   */
  allowHotkeyDrop(event) {
    event.preventDefault();
  }

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
  renameHotkeyTab() {
    const currentName = $("#hotkey_tabs .nav-link.active").text();
    customPrompt("Rename Hotkey Tab", "Enter a new name for this tab:", currentName, (newName) => {
      if (newName && newName.trim() !== "") {
        $("#hotkey_tabs .nav-link.active").text(newName);
        this.saveHotkeysToStore();
      }
    });
  }

  /**
   * Remove song from hotkey
   * Removes the selected song from its hotkey assignment
   */
  removeFromHotkey() {
    const songId = $("#selected_row").attr("songid");
    console.log("removeFromHotkey called, songId:", songId);
    console.log("selected_row element:", $("#selected_row"));
    
    if (songId) {
      console.log(`Preparing to remove song ${songId} from hotkey`);
      if (this.db) {
        const songStmt = this.db.prepare("SELECT * FROM mrvoice WHERE ID = ?");
        const songRow = songStmt.get(songId);
        
        if (songRow) {
          customConfirm(`Are you sure you want to remove ${songRow.title} from this hotkey?`, () => {
            console.log("Proceeding with removal from hotkey");
            // Clear the hotkey slot
            $("#selected_row").removeAttr("songid");
            $("#selected_row span").html("");
            // Clear the selection
            $("#selected_row").removeAttr("id");
            // Save the updated hotkeys to store
            this.saveHotkeysToStore();
            console.log("Hotkey cleared successfully");
          });
        } else {
          console.error("Song not found in database for ID:", songId);
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
      console.log("No songId found on selected row");
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
      // Core functions
      saveHotkeysToStore: this.saveHotkeysToStore,
      loadHotkeysFromStore: this.loadHotkeysFromStore,
      initHotkeys: this.initHotkeys,
      
      // Data management
      populateHotkeys: this.populateHotkeys,
      setLabelFromSongId: this.setLabelFromSongId,
      clearHotkeys: this.clearHotkeys,
      
      // File operations
      openHotkeyFile: this.openHotkeyFile,
      saveHotkeyFile: this.saveHotkeyFile,
      
      // Playback functions
      playSongFromHotkey: this.playSongFromHotkey,
      sendToHotkeys: this.sendToHotkeys,
      
      // UI operations
      hotkeyDrop: this.hotkeyDrop,
      allowHotkeyDrop: this.allowHotkeyDrop,
      
      // Tab management
      switchToHotkeyTab: this.switchToHotkeyTab,
      renameHotkeyTab: this.renameHotkeyTab,
      
      // Removal function
      removeFromHotkey: this.removeFromHotkey
    };
  }

  /**
   * Test all hotkey functions
   * 
   * @returns {Object} - Test results
   */
  testAllFunctions() {
    console.log('🧪 Testing Hotkeys Module Functions...');
    
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

    // Test UI operations
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

    console.log('✅ Hotkeys Module tests completed');
    return testResults;
  }
}

export default HotkeysModule;

// Named exports for backward compatibility
export {
  HotkeysModule
}; 