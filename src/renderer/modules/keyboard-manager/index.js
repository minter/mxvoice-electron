/**
 * Keyboard Manager Module
 * 
 * This module provides comprehensive keyboard shortcut management including
 * F1-F12 hotkey bindings, navigation shortcuts, and dynamic shortcut registration.
 * It consolidates all keyboard-related functionality from renderer.js.
 * 
 * Extracted from renderer.js as part of Phase 5 modularization.
 * 
 * @module KeyboardManager
 */

import { HotkeyBindings } from './hotkey-bindings.js';
import { NavigationShortcuts } from './navigation-shortcuts.js';
import { ShortcutRegistry } from './shortcut-registry.js';

/**
 * KeyboardManager class coordinates all keyboard shortcut functionality
 */
export class KeyboardManager {
  constructor(dependencies = {}) {
    this.dependencies = dependencies;
    this.logger = dependencies.debugLog || console;
    
    // Initialize component managers
    this.hotkeyBindings = new HotkeyBindings(dependencies);
    this.navigationShortcuts = new NavigationShortcuts(dependencies);
    this.shortcutRegistry = new ShortcutRegistry(dependencies);
    
    // Manager state
    this.isInitialized = false;
    this.initializationOrder = ['shortcutRegistry', 'hotkeyBindings', 'navigationShortcuts'];
  }

  /**
   * Initialize all keyboard management components
   * @param {Object} dependencies - Module dependencies and configuration options
   * @returns {Promise<boolean>} - Success status
   */
  async init(dependencies = {}) {
    try {
      this.logInfo('Starting keyboard manager initialization...');

      // Step 1: Initialize shortcut registry first
      this.logInfo('Initializing shortcut registry...');
      const registrySuccess = this.shortcutRegistry.initialize(dependencies.registry || {});
      
      if (!registrySuccess) {
        throw new Error('Failed to initialize shortcut registry');
      }

      // Step 2: Initialize hotkey bindings
      this.logInfo('Initializing hotkey bindings...');
      const hotkeySuccess = this.hotkeyBindings.initialize(dependencies.hotkeys || {});
      
      if (!hotkeySuccess) {
        throw new Error('Failed to initialize hotkey bindings');
      }

      // Step 3: Initialize navigation shortcuts
      this.logInfo('Initializing navigation shortcuts...');
      const navigationSuccess = this.navigationShortcuts.initialize(dependencies.navigation || {});
      
      if (!navigationSuccess) {
        throw new Error('Failed to initialize navigation shortcuts');
      }

      // Step 4: Register default shortcuts in registry
      this.logInfo('Registering default shortcuts in registry...');
      await this.registerDefaultShortcuts();

      this.isInitialized = true;
      this.logInfo('Keyboard manager initialization completed successfully');
      
      // Log comprehensive statistics
      const stats = this.getComprehensiveStats();
      this.logInfo('Keyboard Manager Statistics', stats);
      
      return true;

    } catch (error) {
      this.logError('Failed to initialize keyboard manager:', error);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Register default shortcuts in the registry for tracking
   * @returns {Promise<void>}
   */
  async registerDefaultShortcuts() {
    try {
      // Register F1-F12 hotkeys in the registry
      for (let i = 1; i <= 12; i++) {
        const fkey = `f${i}`;
        this.shortcutRegistry.registerShortcut(fkey, 
          () => this.hotkeyBindings.handleFunctionKey(fkey),
          {
            category: 'hotkeys',
            description: `Play song from hotkey ${fkey.toUpperCase()}`,
            context: 'global'
          }
        );
      }

      // Register Delete/Backspace for hotkey removal
      this.shortcutRegistry.registerShortcut(['del', 'backspace'], () => {
        // Find the selected row using either the ID or the class for consistency
        const selected = document.querySelector('#selected_row, .selected-row');

        if (!selected) {
          this.logInfo('Delete pressed but no row is selected');
          return;
        }

        // Case 1: Hotkey removal
        if (selected.closest('#hotkey-tab-content')) {
          this.logInfo('Delete key triggered for a hotkey');
          selected.removeAttribute('songid');
          const span = selected.querySelector('span');
          if (span) span.textContent = '';
          selected.classList.remove('active-hotkey', 'selected-row');
          this.logInfo('Hotkey assignment removed via Delete key', { hotkeyId: selected.id });
          if (window.hotkeysModule?.saveHotkeysToStore) {
            window.hotkeysModule.saveHotkeysToStore();
            this.logInfo('Hotkeys state saved after Delete');
          }
          return;
        }

        // Case 2: Holding tank removal
        if (selected.closest('#holding-tank-column')) {
          this.logInfo('Delete key triggered for the holding tank');
          // The holding tank also uses the .selected-row class for selection
          if (window.holdingTank?.removeSelected) {
            window.holdingTank.removeSelected();
          } else {
            this.logWarn('holdingTank.removeSelected function not found');
          }
          return;
        }

        // Case 3: Song deletion from search results
        if (selected.closest('#search_results')) {
          this.logInfo('Delete key triggered for search results');
          if (window.deleteSelectedSong) {
            window.deleteSelectedSong();
          } else {
            this.logWarn('deleteSelectedSong function not found');
          }
          return;
        }
        
        this.logInfo('Delete pressed but selected row is in an unknown context', {
          id: selected.id,
          parent: selected.parentElement.id,
        });
        
      }, {
        category: 'global',
        description: 'Remove selected item (song, hotkey, or holding tank item)',
        context: 'global'
      });

      // Register navigation shortcuts
      const navigationBindings = this.navigationShortcuts.getBindings();
      for (const [key, config] of navigationBindings) {
        this.shortcutRegistry.registerShortcut(key, 
          config.handler,
          {
            category: 'navigation',
            description: config.description,
            context: config.context
          }
        );
      }

      this.logInfo('Default shortcuts registered in registry');
    } catch (error) {
      this.logError('Error registering default shortcuts:', error);
    }
  }

  /**
   * Set up keyboard shortcuts (replacement for setupKeyboardShortcuts function)
   * @param {Object} options - Setup options
   * @returns {Promise<boolean>} - Success status
   */
  async setupKeyboardShortcuts(options = {}) {
    try {
      this.logInfo('Setting up keyboard shortcuts...');
      
      if (!this.isInitialized) {
        const initSuccess = await this.init({ setup: options });
        if (!initSuccess) {
          throw new Error('Failed to initialize keyboard manager');
        }
      }

      this.logInfo('Keyboard shortcuts set up successfully');
      return true;
    } catch (error) {
      this.logError('Error setting up keyboard shortcuts:', error);
      return false;
    }
  }

  /**
   * Register a custom shortcut
   * @param {string} key - Keyboard shortcut
   * @param {Function} handler - Handler function
   * @param {Object} options - Additional options
   * @returns {boolean} - Success status
   */
  registerCustomShortcut(key, handler, options = {}) {
    try {
      return this.shortcutRegistry.registerShortcut(key, handler, {
        category: 'custom',
        ...options
      });
    } catch (error) {
      this.logError(`Error registering custom shortcut ${key}:`, error);
      return false;
    }
  }

  /**
   * Unregister a shortcut
   * @param {string} key - Keyboard shortcut to remove
   * @returns {boolean} - Success status
   */
  unregisterShortcut(key) {
    try {
      return this.shortcutRegistry.unregisterShortcut(key);
    } catch (error) {
      this.logError(`Error unregistering shortcut ${key}:`, error);
      return false;
    }
  }

  /**
   * Enable or disable a shortcut
   * @param {string} key - Keyboard shortcut
   * @param {boolean} enabled - Enable status
   * @returns {boolean} - Success status
   */
  setShortcutEnabled(key, enabled) {
    try {
      return this.shortcutRegistry.setShortcutEnabled(key, enabled);
    } catch (error) {
      this.logError(`Error setting shortcut enabled state for ${key}:`, error);
      return false;
    }
  }

  /**
   * Get all keyboard shortcuts
   * @returns {Object} - All shortcuts organized by component
   */
  getAllShortcuts() {
    return {
      hotkeys: this.hotkeyBindings.getBindings(),
      navigation: this.navigationShortcuts.getBindings(),
      registry: this.shortcutRegistry.getAllShortcuts(),
      total: this.shortcutRegistry.getAllShortcuts().size
    };
  }

  /**
   * Get shortcuts by category
   * @param {string} category - Category to filter by
   * @returns {Map} - Shortcuts in category
   */
  getShortcutsByCategory(category) {
    return this.shortcutRegistry.getShortcutsByCategory(category);
  }

  /**
   * Get comprehensive statistics from all components
   * @returns {Object} - Combined statistics
   */
  getComprehensiveStats() {
    try {
      const stats = {
        timestamp: new Date().toISOString(),
        initialized: this.isInitialized,
        components: {
          hotkeyBindings: this.hotkeyBindings.getStats(),
          navigationShortcuts: this.navigationShortcuts.getStats(),
          shortcutRegistry: this.shortcutRegistry.getStats()
        },
        totals: {
          totalShortcuts: 0,
          totalBindings: 0,
          conflicts: 0
        }
      };

      // Calculate totals
      stats.totals.totalShortcuts = stats.components.shortcutRegistry.totalShortcuts;
      stats.totals.totalBindings = stats.components.hotkeyBindings.totalBindings + 
                                   stats.components.navigationShortcuts.totalBindings;
      stats.totals.conflicts = stats.components.shortcutRegistry.conflicts;

      return stats;
    } catch (error) {
      this.logError('Error getting comprehensive stats:', error);
      return { error: error.message };
    }
  }

  /**
   * Perform health check on all keyboard components
   * @returns {Object} - Health check results
   */
  performHealthCheck() {
    try {
      const healthCheck = {
        timestamp: new Date().toISOString(),
        overall: true,
        components: {
          hotkeyBindings: this.hotkeyBindings.isInitialized,
          navigationShortcuts: this.navigationShortcuts.isInitialized,
          shortcutRegistry: this.shortcutRegistry.isInitialized
        },
        issues: [],
        recommendations: []
      };

      // Check component health
      Object.entries(healthCheck.components).forEach(([component, status]) => {
        if (!status) {
          healthCheck.overall = false;
          healthCheck.issues.push(`${component} not initialized`);
          healthCheck.recommendations.push(`Reinitialize ${component}`);
        }
      });

      // Check for conflicts
      const conflicts = this.shortcutRegistry.getConflicts();
      if (conflicts.length > 0) {
        healthCheck.issues.push(`${conflicts.length} shortcut conflicts detected`);
        healthCheck.recommendations.push('Resolve shortcut conflicts');
      }

      this.logInfo('Keyboard Manager Health Check', healthCheck);
      return healthCheck;
    } catch (error) {
      this.logError('Error performing health check:', error);
      return { error: error.message, overall: false };
    }
  }

  /**
   * Get individual component instances
   * @returns {Object} - Component instances
   */
  getComponents() {
    return {
      hotkeyBindings: this.hotkeyBindings,
      navigationShortcuts: this.navigationShortcuts,
      shortcutRegistry: this.shortcutRegistry
    };
  }

  /**
   * Export keyboard configuration
   * @returns {Object} - Exportable configuration
   */
  exportConfiguration() {
    try {
      return {
        keyboard: {
          hotkeys: Array.from(this.hotkeyBindings.getBindings().entries()),
          navigation: Array.from(this.navigationShortcuts.getBindings().entries()),
          registry: this.shortcutRegistry.exportConfig()
        },
        stats: this.getComprehensiveStats(),
        exportedAt: new Date().toISOString()
      };
    } catch (error) {
      this.logError('Error exporting configuration:', error);
      return { error: error.message };
    }
  }

  /**
   * Cleanup all keyboard management components
   * @returns {boolean} - Success status
   */
  cleanup() {
    try {
      this.logInfo('Cleaning up keyboard manager components...');
      
      // Cleanup all components
      this.hotkeyBindings.cleanup();
      this.navigationShortcuts.cleanup();
      this.shortcutRegistry.cleanup();
      
      this.isInitialized = false;
      this.logInfo('Keyboard manager cleanup completed');
      return true;
    } catch (error) {
      this.logError('Error cleaning up keyboard manager:', error);
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

// Export both named and default exports for compatibility
export { HotkeyBindings, NavigationShortcuts, ShortcutRegistry };
export default KeyboardManager;
