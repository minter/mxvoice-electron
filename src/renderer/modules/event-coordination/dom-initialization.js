/**
 * DOM Initialization Module
 * 
 * Handles DOM structure initialization that was previously in renderer.js.
 * Sets up tab structure, context menus, and other DOM elements.
 */

export default class DOMInitialization {
  constructor(dependencies = {}) {
    this.electronAPI = dependencies.electronAPI || window.electronAPI;
    this.db = null;
    this.store = null;
    this.debugLog = dependencies.debugLog || window.debugLog;
    this.moduleRegistry = dependencies.moduleRegistry || window.moduleRegistry;
    
    this.initialized = false;
  }

  /**
   * Initialize DOM structure
   * This replaces the DOM setup code from renderer.js $(document).ready()
   */
  async initializeDOMStructure() {
    try {
      if (this.initialized) {
        this.debugLog?.warn('DOM structure already initialized');
        return;
      }

      this.debugLog?.info('Initializing DOM structure...');

      // Initialize progress bar
      this.initializeProgressBar();

      // Set up hotkey and holding tank tabs (lines 684-694 from renderer.js)
      this.setupTabStructure();

      // Set up context menu (lines 696-730 from renderer.js)
      this.setupContextMenu();

      // Hide search results header initially (line 1122 from renderer.js)
      this.initializeSearchResults();

      // Set up first run modal logic (lines 1174-1214 from renderer.js)
      await this.setupFirstRunModal();

      this.initialized = true;
      this.debugLog?.info('DOM structure initialized successfully');

    } catch (error) {
      this.debugLog?.error('Failed to initialize DOM structure:', error);
    }
  }

  /**
   * Initialize progress bar to 0% width
   */
  initializeProgressBar() {
    $("#audio_progress").width("0%");
    this.debugLog?.debug('Progress bar initialized to 0%');
  }

  /**
   * Set up hotkey and holding tank tabs (cloning tabs 2-5)
   */
  setupTabStructure() {
    try {
      // Set up hotkey and holding tank tabs for tabs 2-5
      for (let i = 2; i <= 5; i++) {
        // Clone hotkey tab
        const hotkey_node = $("#hotkeys_list_1").clone();
        hotkey_node.attr("id", `hotkeys_list_${i}`);
        hotkey_node.removeClass("show active");
        $("#hotkey-tab-content").append(hotkey_node);

        // Clone holding tank tab
        const holding_tank_node = $("#holding_tank_1").clone();
        holding_tank_node.attr("id", `holding_tank_${i}`);
        holding_tank_node.removeClass("show active");
        $("#holding-tank-tab-content").append(holding_tank_node);
      }

      this.debugLog?.debug('Tab structure set up for tabs 2-5');

    } catch (error) {
      this.debugLog?.error('Failed to setup tab structure:', error);
    }
  }

  /**
   * Set up context menu for song operations
   */
  setupContextMenu() {
    try {
      $.contextMenu({
        selector: ".context-menu",
        items: {
          play: {
            name: "Play",
            icon: "fas fa-play-circle",
            callback: function (key, opt) {
              if (window.playSelected) {
                window.playSelected();
              }
            },
          },
          edit: {
            name: "Edit",
            icon: "fas fa-edit",
            callback: function (key, opt) {
              if (window.editSelectedSong) {
                window.editSelectedSong();
              }
            },
          },
          delete: {
            name: function() {
              // Check if the selected row is in the holding tank
              if ($("#holding-tank-column").has($("#selected_row")).length) {
                return "Remove from Holding Tank";
              } else if ($("#hotkey-tab-content").has($("#selected_row")).length) {
                return "Remove from Hotkey";
              } else {
                return "Delete";
              }
            },
            icon: "fas fa-trash-alt",
            callback: function (key, opt) {
              if (window.deleteSelectedSong) {
                window.deleteSelectedSong();
              }
            },
          },
        },
      });

      this.debugLog?.debug('Context menu set up');

    } catch (error) {
      this.debugLog?.error('Failed to setup context menu:', error);
    }
  }

  /**
   * Initialize search results display
   */
  initializeSearchResults() {
    $("#search_results thead").hide();
    this.debugLog?.debug('Search results header hidden');
  }

  /**
   * Set up first run modal logic
   */
  async setupFirstRunModal() {
    try {
      // Use new database API for song count
      if (this.electronAPI && this.electronAPI.database) {
        const result = await this.electronAPI.database.query("SELECT count(*) as count from mrvoice WHERE 1");
        if (result.success && result.data.length > 0 && result.data[0].count <= 1) {
          $(`#firstRunModal`).modal("show");
          this.debugLog?.info('First run modal shown - database has <= 1 songs');
        }
      }

    } catch (error) {
      this.debugLog?.error('Database API error', error);
    }
  }

  /**
   * Legacy fallback removed
   */
  async setupFirstRunModalFallback() {}

  /**
   * Get initialization status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      components: {
        progressBar: $("#audio_progress").length > 0,
        tabs: $("#hotkeys_list_2").length > 0,
        contextMenu: $(".context-menu").length > 0,
        searchResults: $("#search_results").length > 0
      }
    };
  }
}
