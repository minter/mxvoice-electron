/**
 * UI Interaction Events Module
 * 
 * Handles all UI interaction event handlers that were previously in renderer.js.
 * Includes modals, tabs, window resize, and form interactions.
 */

export default class UIInteractionEvents {
  constructor(dependencies = {}) {
    this.electronAPI = dependencies.electronAPI || window.electronAPI;
    this.db = dependencies.db || window.db;
    this.store = dependencies.store || window.store;
    this.debugLog = dependencies.debugLog || window.debugLog;
    this.moduleRegistry = dependencies.moduleRegistry || window.moduleRegistry;
    
    this.eventsAttached = false;
    this.uiHandlers = new Map();
  }

  /**
   * Attach all UI interaction event handlers
   */
  async attachUIInteractionEvents() {
    try {
      if (this.eventsAttached) {
        this.debugLog?.warn('UI interaction events already attached');
        return;
      }

      this.debugLog?.info('Attaching UI interaction event handlers...');

      // Modal events
      this.attachModalEvents();

      // Tab events
      this.attachTabEvents();

      // Window events
      this.attachWindowEvents();

      // Form events
      this.attachFormEvents();

      // Confirmation modal events
      this.attachConfirmationEvents();

      this.eventsAttached = true;
      this.debugLog?.info('UI interaction event handlers attached successfully');

    } catch (error) {
      this.debugLog?.error('Failed to attach UI interaction events:', error);
    }
  }

  /**
   * Modal interaction events (lines 1110-1112 from renderer.js)
   */
  attachModalEvents() {
    const modalShowHandler = (event) => {
      try {
        // Hide other modals when one is shown
        $(".modal").modal("hide");
      } catch (error) {
        this.debugLog?.error('Error in modal show handler:', error);
      }
    };

    $(".modal").on("show.bs.modal", modalShowHandler);
    this.uiHandlers.set('modalShow', { element: '.modal', event: 'show.bs.modal', handler: modalShowHandler });
    
    this.debugLog?.debug('Modal events attached');
  }

  /**
   * Tab interaction events (lines 1114-1120 from renderer.js)
   */
  attachTabEvents() {
    // Hotkey tab double-click for renaming
    const hotkeyTabDoubleClickHandler = (event) => {
      try {
        if (window.renameHotkeyTab) {
          window.renameHotkeyTab();
        } else {
          this.debugLog?.warn('renameHotkeyTab function not available');
        }
      } catch (error) {
        this.debugLog?.error('Error in hotkey tab double-click handler:', error);
      }
    };

    // Holding tank tab double-click for renaming
    const holdingTankTabDoubleClickHandler = (event) => {
      try {
        if (window.renameHoldingTankTab) {
          window.renameHoldingTankTab();
        } else {
          this.debugLog?.warn('renameHoldingTankTab function not available');
        }
      } catch (error) {
        this.debugLog?.error('Error in holding tank tab double-click handler:', error);
      }
    };

    $("#hotkey_tabs").on("dblclick", ".nav-link", hotkeyTabDoubleClickHandler);
    $("#holding_tank_tabs").on("dblclick", ".nav-link", holdingTankTabDoubleClickHandler);

    this.uiHandlers.set('hotkeyTabDoubleClick', { element: '#hotkey_tabs', event: 'dblclick', selector: '.nav-link', handler: hotkeyTabDoubleClickHandler });
    this.uiHandlers.set('holdingTankTabDoubleClick', { element: '#holding_tank_tabs', event: 'dblclick', selector: '.nav-link', handler: holdingTankTabDoubleClickHandler });
    
    this.debugLog?.debug('Tab events attached');
  }

  /**
   * Window events (lines 1168-1172 from renderer.js)
   */
  attachWindowEvents() {
    const windowResizeHandler = (event) => {
      try {
        if (window.scaleScrollable) {
          window.scaleScrollable();
        } else {
          this.debugLog?.warn('scaleScrollable function not available');
        }
      } catch (error) {
        this.debugLog?.error('Error in window resize handler:', error);
      }
    };

    $(window).on("resize", windowResizeHandler);
    this.uiHandlers.set('windowResize', { element: window, event: 'resize', handler: windowResizeHandler });
    
    this.debugLog?.debug('Window events attached');
  }

  /**
   * Form modal events (lines 1124-1166 from renderer.js)
   */
  attachFormEvents() {
    // Song form modal hidden event
    const songFormModalHiddenHandler = (event) => {
      try {
        $("#song-form-category").val("");
        $("#song-form-title").val("");
        $("#song-form-new-category").val("");
        $("#song-form-artist").val("");
        $("#song-form-info").val("");
        $("#song-form-duration").val("");
        $("#SongFormNewCategory").hide();
      } catch (error) {
        this.debugLog?.error('Error in song form modal hidden handler:', error);
      }
    };

    // Song form modal shown event
    const songFormModalShownHandler = (event) => {
      try {
        this.debugLog?.debug('Song form title length:', $("#song-form-title").val().length);
        if (!$("#song-form-title").val().length) {
          $("#song-form-title").focus();
        } else {
          $("#song-form-info").focus();
        }
      } catch (error) {
        this.debugLog?.error('Error in song form modal shown handler:', error);
      }
    };

    // Preferences modal shown event
    const preferencesModalShownHandler = (event) => {
      try {
        // Load preferences using new store API
        Promise.all([
          this.electronAPI.store.get("database_directory"),
          this.electronAPI.store.get("music_directory"),
          this.electronAPI.store.get("hotkey_directory"),
          this.electronAPI.store.get("fade_out_seconds"),
          this.electronAPI.store.get("debug_log_enabled")
        ]).then(([dbDir, musicDir, hotkeyDir, fadeSeconds, debugLog]) => {
          if (dbDir.success) $("#preferences-database-directory").val(dbDir.value);
          if (musicDir.success) $("#preferences-song-directory").val(musicDir.value);
          if (hotkeyDir.success) $("#preferences-hotkey-directory").val(hotkeyDir.value);
          if (fadeSeconds.success) $("#preferences-fadeout-seconds").val(fadeSeconds.value);
          if (debugLog.success) $("#preferences-debug-log-enabled").prop("checked", debugLog.value);
        }).catch(error => {
          this.debugLog?.warn('Failed to load preferences', error);
          // Fallback to legacy store access
          if (this.store) {
            $("#preferences-database-directory").val(this.store.get("database_directory"));
            $("#preferences-song-directory").val(this.store.get("music_directory"));
            $("#preferences-hotkey-directory").val(this.store.get("hotkey_directory"));
            $("#preferences-fadeout-seconds").val(this.store.get("fade_out_seconds"));
            $("#preferences-debug-log-enabled").prop("checked", this.store.get("debug_log_enabled") || false);
          }
        });
      } catch (error) {
        this.debugLog?.error('Error in preferences modal shown handler:', error);
      }
    };

    // Song form category change event
    const songFormCategoryChangeHandler = (event) => {
      try {
        const target = $(event.target);
        target.find("option:selected").each(function () {
          const optionValue = $(this).attr("value");
          if (optionValue == "--NEW--") {
            $("#SongFormNewCategory").show();
            $("#song-form-new-category").attr("required", "required");
          } else {
            $("#SongFormNewCategory").hide();
            $("#song-form-new-category").removeAttr("required");
          }
        });
      } catch (error) {
        this.debugLog?.error('Error in song form category change handler:', error);
      }
    };

    $("#songFormModal").on("hidden.bs.modal", songFormModalHiddenHandler);
    $("#songFormModal").on("shown.bs.modal", songFormModalShownHandler);
    $("#preferencesModal").on("shown.bs.modal", preferencesModalShownHandler);
    $("#song-form-category").change(songFormCategoryChangeHandler);

    this.uiHandlers.set('songFormModalHidden', { element: '#songFormModal', event: 'hidden.bs.modal', handler: songFormModalHiddenHandler });
    this.uiHandlers.set('songFormModalShown', { element: '#songFormModal', event: 'shown.bs.modal', handler: songFormModalShownHandler });
    this.uiHandlers.set('preferencesModalShown', { element: '#preferencesModal', event: 'shown.bs.modal', handler: preferencesModalShownHandler });
    this.uiHandlers.set('songFormCategoryChange', { element: '#song-form-category', event: 'change', handler: songFormCategoryChangeHandler });
    
    // Trigger change event on page load
    $("#song-form-category").change();
    
    this.debugLog?.debug('Form events attached');
  }

  /**
   * Confirmation modal events (lines 1236-1238 from renderer.js)
   */
  attachConfirmationEvents() {
    const confirmationModalHiddenHandler = (event) => {
      try {
        if (window.restoreFocusToSearch) {
          window.restoreFocusToSearch();
        } else {
          this.debugLog?.warn('restoreFocusToSearch function not available');
        }
      } catch (error) {
        this.debugLog?.error('Error in confirmation modal hidden handler:', error);
      }
    };

    $("#confirmationModal").on("hidden.bs.modal", confirmationModalHiddenHandler);
    this.uiHandlers.set('confirmationModalHidden', { element: '#confirmationModal', event: 'hidden.bs.modal', handler: confirmationModalHiddenHandler });
    
    this.debugLog?.debug('Confirmation events attached');
  }

  /**
   * Detach all UI interaction events
   */
  detachEvents() {
    try {
      this.debugLog?.info('Detaching UI interaction events...');

      for (const [name, handler] of this.uiHandlers) {
        if (handler.selector) {
          // Delegated event
          $(handler.element).off(handler.event, handler.selector, handler.handler);
        } else {
          // Direct event
          $(handler.element).off(handler.event, handler.handler);
        }
        this.debugLog?.debug(`Removed UI handler: ${name}`);
      }

      this.uiHandlers.clear();
      this.eventsAttached = false;
      
      this.debugLog?.info('UI interaction events detached successfully');

    } catch (error) {
      this.debugLog?.error('Failed to detach UI interaction events:', error);
    }
  }

  /**
   * Get UI interaction events status
   */
  getStatus() {
    return {
      eventsAttached: this.eventsAttached,
      handlerCount: this.uiHandlers.size,
      handlers: Array.from(this.uiHandlers.keys())
    };
  }
}
