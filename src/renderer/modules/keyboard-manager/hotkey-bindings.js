/**
 * Hotkey Bindings Module
 * 
 * This module handles F1-F12 hotkey bindings for playing songs from hotkeys.
 * It provides centralized management of function key shortcuts.
 * 
 * Extracted from renderer.js as part of Phase 5 modularization.
 */

/**
 * HotkeyBindings class handles F1-F12 hotkey bindings
 */
export class HotkeyBindings {
  constructor(dependencies = {}) {
    this.dependencies = dependencies;
    this.logger = dependencies.debugLog || console;
    this.searchField = null;
    this.bindings = new Map();
    this.isInitialized = false;
  }

  /**
   * Initialize hotkey bindings
   * @param {Object} options - Configuration options
   * @returns {boolean} - Success status
   */
  initialize(options = {}) {
    try {
      this.logInfo('Initializing F1-F12 hotkey bindings...');
      
      // Get search field reference
      this.searchField = document.getElementById("omni_search");
      if (!this.searchField) {
        this.logWarn('Search field not found, some hotkey bindings may not work');
      }

      // Set up F1-F12 hotkey bindings
      this.setupFunctionKeys();
      
      this.isInitialized = true;
      this.logInfo('F1-F12 hotkey bindings initialized successfully');
      return true;
    } catch (error) {
      this.logError('Failed to initialize hotkey bindings:', error);
      return false;
    }
  }

  /**
   * Set up F1-F12 function key bindings
   */
  setupFunctionKeys() {
    try {
      // Set up F1-F12 global hotkeys
      for (let i = 1; i <= 12; i++) {
        const fkey = `f${i}`;
        
        // Global F-key binding
        Mousetrap.bind(fkey, () => {
          this.handleFunctionKey(fkey);
        });
        
        // Search field F-key binding (if search field exists)
        if (this.searchField) {
          Mousetrap(this.searchField).bind(fkey, () => {
            this.handleFunctionKey(fkey);
          });
        }
        
        this.bindings.set(fkey, {
          key: fkey,
          handler: 'handleFunctionKey',
          context: 'global+search',
          description: `Play song from hotkey ${fkey.toUpperCase()}`
        });
      }

      this.logInfo(`Function keys F1-F12 bound successfully (${this.bindings.size} bindings)`);
    } catch (error) {
      this.logError('Error setting up function keys:', error);
    }
  }

  /**
   * Handle function key press
   * @param {string} fkey - Function key pressed (f1, f2, etc.)
   */
  handleFunctionKey(fkey) {
    try {
      this.logDebug(`Function key pressed: ${fkey}`);
      
      if (window.playSongFromHotkey && typeof window.playSongFromHotkey === 'function') {
        window.playSongFromHotkey(fkey);
      } else {
        this.logWarn(`playSongFromHotkey function not available for ${fkey}`);
      }
    } catch (error) {
      this.logError(`Error handling function key ${fkey}:`, error);
    }
  }

  /**
   * Get all hotkey bindings
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
   * Unbind a specific function key
   * @param {string} fkey - Function key to unbind
   * @returns {boolean} - Success status
   */
  unbindFunctionKey(fkey) {
    try {
      Mousetrap.unbind(fkey);
      
      if (this.searchField) {
        Mousetrap(this.searchField).unbind(fkey);
      }
      
      this.bindings.delete(fkey);
      this.logInfo(`Function key ${fkey} unbound successfully`);
      return true;
    } catch (error) {
      this.logError(`Error unbinding function key ${fkey}:`, error);
      return false;
    }
  }

  /**
   * Unbind all function keys
   * @returns {boolean} - Success status
   */
  unbindAll() {
    try {
      for (let i = 1; i <= 12; i++) {
        this.unbindFunctionKey(`f${i}`);
      }
      
      this.bindings.clear();
      this.logInfo('All function key bindings cleared');
      return true;
    } catch (error) {
      this.logError('Error unbinding all function keys:', error);
      return false;
    }
  }

  /**
   * Get statistics about hotkey bindings
   * @returns {Object} - Statistics
   */
  getStats() {
    return {
      initialized: this.isInitialized,
      totalBindings: this.bindings.size,
      searchFieldAvailable: !!this.searchField,
      functionKeys: Array.from(this.bindings.keys()).filter(key => key.startsWith('f')),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Cleanup hotkey bindings
   * @returns {boolean} - Success status
   */
  cleanup() {
    try {
      this.unbindAll();
      this.searchField = null;
      this.isInitialized = false;
      this.logInfo('Hotkey bindings cleaned up');
      return true;
    } catch (error) {
      this.logError('Error cleaning up hotkey bindings:', error);
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
export default HotkeyBindings;
