/**
 * Navigation Shortcuts Module
 * 
 * This module handles navigation and control shortcuts including tab switching,
 * search focus, play/pause controls, and deletion operations.
 * 
 * Extracted from renderer.js as part of Phase 5 modularization.
 */

/**
 * NavigationShortcuts class handles navigation and control shortcuts
 */
export class NavigationShortcuts {
  constructor(dependencies = {}) {
    this.dependencies = dependencies;
    this.logger = dependencies.debugLog || console;
    this.searchField = null;
    this.bindings = new Map();
    this.isInitialized = false;
  }

  /**
   * Initialize navigation shortcuts
   * @param {Object} options - Configuration options
   * @returns {boolean} - Success status
   */
  initialize(options = {}) {
    try {
      this.logInfo('Initializing navigation shortcuts...');
      
      // Get search field reference
      this.searchField = document.getElementById("omni_search");
      if (!this.searchField) {
        this.logWarn('Search field not found, some shortcuts may not work');
      }

      // Set up all navigation shortcuts
      this.setupTabSwitching();
      this.setupSearchFocus();
      this.setupAudioControls();
      this.setupDeletionControls();
      
      this.isInitialized = true;
      this.logInfo('Navigation shortcuts initialized successfully');
      return true;
    } catch (error) {
      this.logError('Failed to initialize navigation shortcuts:', error);
      return false;
    }
  }

  /**
   * Set up tab switching shortcuts (Command+1-5)
   */
  setupTabSwitching() {
    try {
      for (let i = 1; i <= 5; i++) {
        const shortcut = `command+${i}`;
        
        Mousetrap.bind(shortcut, () => {
          this.handleTabSwitch(i);
        });
        
        this.bindings.set(shortcut, {
          key: shortcut,
          handler: 'handleTabSwitch',
          context: 'global',
          description: `Switch to hotkey tab ${i}`
        });
      }
      
      this.logInfo('Tab switching shortcuts (Command+1-5) set up successfully');
    } catch (error) {
      this.logError('Error setting up tab switching shortcuts:', error);
    }
  }

  /**
   * Set up search focus shortcuts
   */
  setupSearchFocus() {
    try {
      // Command+L for search focus
      Mousetrap.bind("command+l", () => {
        this.handleSearchFocus();
      });
      
      this.bindings.set("command+l", {
        key: "command+l",
        handler: 'handleSearchFocus',
        context: 'global',
        description: 'Focus search field'
      });

      // Alternative Command+L binding for different search contexts
      Mousetrap.bind("command+l", () => {
        this.handleAlternativeSearchFocus();
      });
      
      this.logInfo('Search focus shortcuts set up successfully');
    } catch (error) {
      this.logError('Error setting up search focus shortcuts:', error);
    }
  }

  /**
   * Set up audio control shortcuts
   */
  setupAudioControls() {
    try {
      // Register shortcuts only in the bindings registry (avoid double registration)
      // The keyboard manager will handle the actual Mousetrap bindings
      
      this.bindings.set("esc", {
        key: "esc",
        handler: (event) => this.handleStopPlaying(false), // Explicitly pass false for fadeOut
        context: 'global+search',
        description: 'Stop playing audio'
      });

      this.bindings.set("shift+esc", {
        key: "shift+esc",
        handler: (event) => this.handleStopPlaying(true), // Explicitly pass true for fadeOut
        context: 'global',
        description: 'Stop all audio'
      });

      this.bindings.set("space", {
        key: "space",
        handler: (event) => this.handlePausePlaying(false), // Explicitly pass false for pauseAll
        context: 'global',
        description: 'Pause/resume audio'
      });

      this.bindings.set("shift+space", {
        key: "shift+space",
        handler: (event) => this.handlePausePlaying(true), // Explicitly pass true for pauseAll
        context: 'global',
        description: 'Pause all audio'
      });

      this.bindings.set("return", {
        key: "return",
        handler: (event) => this.handlePlaySelected(), // No arguments needed
        context: 'global',
        description: 'Play selected song'
      });
      
      this.logInfo('Audio control shortcuts set up successfully');
    } catch (error) {
      this.logError('Error setting up audio control shortcuts:', error);
    }
  }

  /**
   * Set up deletion control shortcuts
   */
  setupDeletionControls() {
    try {
      // Backspace and Delete for removal/deletion
      Mousetrap.bind(["backspace", "del"], () => {
        return this.handleDeletion();
      });
      
      this.bindings.set("backspace|del", {
        key: "backspace|del",
        handler: 'handleDeletion',
        context: 'global',
        description: 'Delete selected item based on context'
      });
      
      this.logInfo('Deletion control shortcuts set up successfully');
    } catch (error) {
      this.logError('Error setting up deletion control shortcuts:', error);
    }
  }

  /**
   * Handle tab switching
   * @param {number} tabNumber - Tab number to switch to
   */
  handleTabSwitch(tabNumber) {
    try {
      this.logDebug(`Tab switch requested: ${tabNumber}`);
      
      if (window.switchToHotkeyTab && typeof window.switchToHotkeyTab === 'function') {
        window.switchToHotkeyTab(tabNumber);
      } else {
        this.logWarn(`switchToHotkeyTab function not available for tab ${tabNumber}`);
      }
    } catch (error) {
      this.logError(`Error switching to tab ${tabNumber}:`, error);
    }
  }

  /**
   * Handle search focus
   */
  handleSearchFocus() {
    try {
      this.logDebug('Search focus requested');
      const el = document.getElementById('omni_search');
      el?.focus();
      el?.select();
    } catch (error) {
      this.logError('Error focusing search field:', error);
    }
  }

  /**
   * Handle alternative search focus
   */
  handleAlternativeSearchFocus() {
    try {
      this.logDebug('Alternative search focus requested');
      
      const omni = document.getElementById('omni_search');
      const adv = document.getElementById('advanced-search');
      const omniVisible = omni && omni.offsetParent !== null && !(adv && adv.offsetParent !== null);
      if (omniVisible) {
        omni?.focus();
      } else {
        document.getElementById('title-search')?.focus();
      }
    } catch (error) {
      this.logError('Error with alternative search focus:', error);
    }
  }

  /**
   * Handle stop playing
   * @param {boolean} fadeOut - Whether to fade out the audio
   */
  handleStopPlaying(fadeOut = false) {
    try {
      if (window.stopPlaying && typeof window.stopPlaying === 'function') {
        window.stopPlaying(fadeOut);
      } else {
        this.logWarn('stopPlaying function not available');
      }
    } catch (error) {
      this.logError('Error stopping playback:', error);
    }
  }

  /**
   * Handle pause/resume playing
   * @param {boolean} pauseAll - Whether to pause all audio
   * @returns {boolean} - False to prevent default behavior
   */
  handlePausePlaying(pauseAll = false) {
    try {
      this.logDebug(`Pause playing requested (pauseAll: ${pauseAll})`);
      
      if (window.pausePlaying && typeof window.pausePlaying === 'function') {
        window.pausePlaying(pauseAll);
      } else {
        this.logWarn('pausePlaying function not available');
      }
      
      return false; // Prevent default space behavior
    } catch (error) {
      this.logError('Error pausing playback:', error);
      return false;
    }
  }

  /**
   * Handle play selected song
   * @returns {boolean} - False to prevent default behavior
   */
  handlePlaySelected() {
    try {
      this.logDebug('Play selected requested');
      
      // Don't play if modal is open
      const modal = document.getElementById('songFormModal');
      if (modal && modal.classList.contains('show')) {
        return false;
      }
      
      if (window.playSelected && typeof window.playSelected === 'function') {
        window.playSelected();
      } else {
        this.logWarn('playSelected function not available');
      }
      
      return false; // Prevent default enter behavior
    } catch (error) {
      this.logError('Error playing selected song:', error);
      return false;
    }
  }

  /**
   * Handle deletion based on context
   * @returns {boolean} - False to prevent default behavior
   */
  handleDeletion() {
    try {
      this.logDebug("Delete key pressed");
      this.logDebug("selected_row", document.getElementById('selected_row'));
      const sel = document.getElementById('selected_row');
      const holding = document.getElementById('holding-tank-column');
      const hotkeys = document.getElementById('hotkey-tab-content');
      this.logDebug("holding-tank-column has selected_row", Number(Boolean(holding && sel && holding.contains(sel))));
      this.logDebug("hotkey-tab-content has selected_row", Number(Boolean(hotkeys && sel && hotkeys.contains(sel))));
      
      // Check if the selected row is in the holding tank
      if (holding && sel && holding.contains(sel)) {
        this.logDebug("Selected row is in holding tank");
        // If in holding tank, remove from holding tank
        if (window.removeFromHoldingTank && typeof window.removeFromHoldingTank === 'function') {
          window.removeFromHoldingTank();
        } else {
          this.logWarn('removeFromHoldingTank function not available');
        }
      } else if (hotkeys && sel && hotkeys.contains(sel)) {
        this.logDebug("Selected row is in hotkey tab");
        // If in hotkey tab, remove from hotkey
        if (window.removeFromHotkey && typeof window.removeFromHotkey === 'function') {
          window.removeFromHotkey();
        } else {
          this.logWarn('removeFromHotkey function not available');
        }
      } else {
        this.logDebug("Selected row is in search results");
        // If not in holding tank or hotkey, delete from database
        if (window.deleteSong && typeof window.deleteSong === 'function') {
          window.deleteSong();
        } else {
          this.logWarn('deleteSong function not available');
        }
      }
      
      return false; // Prevent default delete behavior
    } catch (error) {
      this.logError('Error handling deletion:', error);
      return false;
    }
  }

  /**
   * Get all navigation shortcuts
   * @returns {Map} - Map of all bindings
   */
  getBindings() {
    return new Map(this.bindings);
  }

  /**
   * Get binding information for a specific key
   * @param {string} key - Key to get binding for
   * @returns {Object|null} - Binding information
   */
  getBinding(key) {
    return this.bindings.get(key) || null;
  }

  /**
   * Check if a key is bound
   * @param {string} key - Key to check
   * @returns {boolean} - True if key is bound
   */
  isBound(key) {
    return this.bindings.has(key);
  }

  /**
   * Get statistics about navigation shortcuts
   * @returns {Object} - Statistics
   */
  getStats() {
    return {
      initialized: this.isInitialized,
      totalBindings: this.bindings.size,
      searchFieldAvailable: !!this.searchField,
      bindingCategories: {
        tabSwitching: Array.from(this.bindings.keys()).filter(key => key.includes('command+')).length,
        audioControls: Array.from(this.bindings.keys()).filter(key => ['esc', 'space', 'return'].some(ctrl => key.includes(ctrl))).length,
        deletion: Array.from(this.bindings.keys()).filter(key => key.includes('backspace') || key.includes('del')).length
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Cleanup navigation shortcuts
   * @returns {boolean} - Success status
   */
  cleanup() {
    try {
      // Unbind all shortcuts
      for (const key of this.bindings.keys()) {
        if (key.includes('|')) {
          // Handle multi-key bindings
          const keys = key.split('|');
          keys.forEach(k => Mousetrap.unbind(k));
        } else {
          Mousetrap.unbind(key);
        }
      }
      
      this.bindings.clear();
      this.searchField = null;
      this.isInitialized = false;
      this.logInfo('Navigation shortcuts cleaned up');
      return true;
    } catch (error) {
      this.logError('Error cleaning up navigation shortcuts:', error);
      return false;
    }
  }

  /**
   * Log info message
   * @param {string} message - Log message
   * @param {*} context - Additional context
   */
  logInfo(message, context) {
    if (typeof this.logger?.info === 'function') {
      this.logger.info(message, context);
    } else if (typeof window?.logInfo === 'function') {
      window.logInfo(message, context);
    }
  }

  /**
   * Log debug message
   * @param {string} message - Log message
   * @param {*} context - Additional context
   */
  logDebug(message, context) {
    if (typeof this.logger?.debug === 'function') {
      this.logger.debug(message, context);
    } else if (typeof window?.logDebug === 'function') {
      window.logDebug(message, context);
    }
  }

  /**
   * Log error message
   * @param {string} message - Log message
   * @param {*} context - Additional context
   */
  logError(message, context) {
    if (typeof this.logger?.error === 'function') {
      this.logger.error(message, context);
    } else if (typeof window?.logError === 'function') {
      window.logError(message, context);
    }
  }

  /**
   * Log warning message
   * @param {string} message - Log message
   * @param {*} context - Additional context
   */
  logWarn(message, context) {
    if (typeof this.logger?.warn === 'function') {
      this.logger.warn(message, context);
    } else if (typeof window?.logWarn === 'function') {
      window.logWarn(message, context);
    }
  }
}

// Export default instance
export default NavigationShortcuts;
