/**
 * Shortcut Registry Module
 * 
 * This module provides dynamic shortcut registration, configuration management,
 * and conflict resolution for keyboard shortcuts.
 * 
 * Extracted from renderer.js as part of Phase 5 modularization.
 */

/**
 * ShortcutRegistry class manages dynamic shortcut registration and configuration
 */
export class ShortcutRegistry {
  constructor(dependencies = {}) {
    this.dependencies = dependencies;
    this.logger = dependencies.debugLog || console;
    this.shortcuts = new Map();
    this.conflicts = new Set();
    this.isInitialized = false;
    this.config = {
      enableConflictDetection: true,
      allowOverrides: false,
      logBindings: true
    };
  }

  /**
   * Initialize shortcut registry
   * @param {Object} options - Configuration options
   * @returns {boolean} - Success status
   */
  initialize(options = {}) {
    try {
      this.logInfo('Initializing shortcut registry...');
      
      // Merge configuration options
      this.config = { ...this.config, ...options };
      
      this.isInitialized = true;
      this.logInfo('Shortcut registry initialized successfully');
      return true;
    } catch (error) {
      this.logError('Failed to initialize shortcut registry:', error);
      return false;
    }
  }

  /**
   * Register a new shortcut
   * @param {string} key - Keyboard shortcut (e.g., 'ctrl+s', 'f1')
   * @param {Function} handler - Handler function
   * @param {Object} options - Additional options
   * @returns {boolean} - Success status
   */
  registerShortcut(key, handler, options = {}) {
    try {
      const shortcutConfig = {
        key,
        handler,
        context: options.context || 'global',
        description: options.description || '',
        element: options.element || null,
        preventDefault: options.preventDefault !== false,
        enabled: options.enabled !== false,
        priority: options.priority || 0,
        category: options.category || 'custom',
        registeredAt: new Date().toISOString()
      };

      // Check for conflicts if enabled
      if (this.config.enableConflictDetection && this.shortcuts.has(key)) {
        if (!this.config.allowOverrides) {
          this.logWarn(`Shortcut conflict detected for key: ${key}`, {
            existing: this.shortcuts.get(key),
            new: shortcutConfig
          });
          this.conflicts.add(key);
          return false;
        } else {
          this.logInfo(`Overriding existing shortcut for key: ${key}`);
        }
      }

      // Bind the shortcut using Mousetrap
      if (shortcutConfig.element) {
        Mousetrap(shortcutConfig.element).bind(key, (e) => {
          return this.executeHandler(key, e, shortcutConfig);
        });
      } else {
        Mousetrap.bind(key, (e) => {
          return this.executeHandler(key, e, shortcutConfig);
        });
      }

      // Store the shortcut configuration
      this.shortcuts.set(key, shortcutConfig);
      
      if (this.config.logBindings) {
        this.logInfo(`Shortcut registered: ${key}`, shortcutConfig);
      }
      
      return true;
    } catch (error) {
      this.logError(`Error registering shortcut ${key}:`, error);
      return false;
    }
  }

  /**
   * Execute shortcut handler with error handling
   * @param {string} key - Shortcut key
   * @param {Event} event - Keyboard event
   * @param {Object} config - Shortcut configuration
   * @returns {boolean} - Handler return value
   */
  executeHandler(key, event, config) {
    try {
      if (!config.enabled) {
        this.logDebug(`Shortcut disabled: ${key}`);
        return true;
      }

      this.logDebug(`Executing shortcut: ${key}`);
      
      const result = config.handler(event, key, config);
      
      // Return false to preventDefault if configured
      return config.preventDefault ? false : result;
    } catch (error) {
      this.logError(`Error executing shortcut handler for ${key}:`, error);
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
      const config = this.shortcuts.get(key);
      if (!config) {
        this.logWarn(`Shortcut not found for unregistration: ${key}`);
        return false;
      }

      // Unbind from Mousetrap
      if (config.element) {
        Mousetrap(config.element).unbind(key);
      } else {
        Mousetrap.unbind(key);
      }

      // Remove from registry
      this.shortcuts.delete(key);
      this.conflicts.delete(key);
      
      if (this.config.logBindings) {
        this.logInfo(`Shortcut unregistered: ${key}`);
      }
      
      return true;
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
      const config = this.shortcuts.get(key);
      if (!config) {
        this.logWarn(`Shortcut not found: ${key}`);
        return false;
      }

      config.enabled = enabled;
      this.logInfo(`Shortcut ${enabled ? 'enabled' : 'disabled'}: ${key}`);
      return true;
    } catch (error) {
      this.logError(`Error setting shortcut enabled state for ${key}:`, error);
      return false;
    }
  }

  /**
   * Get shortcut configuration
   * @param {string} key - Keyboard shortcut
   * @returns {Object|null} - Shortcut configuration
   */
  getShortcut(key) {
    return this.shortcuts.get(key) || null;
  }

  /**
   * Get all shortcuts
   * @returns {Map} - Map of all shortcuts
   */
  getAllShortcuts() {
    return new Map(this.shortcuts);
  }

  /**
   * Get shortcuts by category
   * @param {string} category - Category to filter by
   * @returns {Map} - Map of shortcuts in category
   */
  getShortcutsByCategory(category) {
    const filtered = new Map();
    for (const [key, config] of this.shortcuts) {
      if (config.category === category) {
        filtered.set(key, config);
      }
    }
    return filtered;
  }

  /**
   * Check if a shortcut exists
   * @param {string} key - Keyboard shortcut
   * @returns {boolean} - True if shortcut exists
   */
  hasShortcut(key) {
    return this.shortcuts.has(key);
  }

  /**
   * Get all conflicts
   * @returns {Array} - Array of conflicting keys
   */
  getConflicts() {
    return Array.from(this.conflicts);
  }

  /**
   * Resolve conflicts by priority
   * @returns {number} - Number of conflicts resolved
   */
  resolveConflictsByPriority() {
    let resolved = 0;
    
    for (const key of this.conflicts) {
      // This is a placeholder for conflict resolution logic
      // In a real implementation, you might need to handle multiple
      // shortcuts with the same key and resolve by priority
      this.logInfo(`Resolving conflict for key: ${key}`);
      resolved++;
    }
    
    return resolved;
  }

  /**
   * Get comprehensive statistics
   * @returns {Object} - Registry statistics
   */
  getStats() {
    const categories = {};
    const contexts = {};
    let enabledCount = 0;
    let disabledCount = 0;

    for (const [key, config] of this.shortcuts) {
      // Count by category
      categories[config.category] = (categories[config.category] || 0) + 1;
      
      // Count by context
      contexts[config.context] = (contexts[config.context] || 0) + 1;
      
      // Count enabled/disabled
      if (config.enabled) {
        enabledCount++;
      } else {
        disabledCount++;
      }
    }

    return {
      initialized: this.isInitialized,
      totalShortcuts: this.shortcuts.size,
      enabledShortcuts: enabledCount,
      disabledShortcuts: disabledCount,
      conflicts: this.conflicts.size,
      categories,
      contexts,
      config: this.config,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Export shortcut configuration
   * @returns {Object} - Exportable configuration
   */
  exportConfig() {
    const exported = {
      shortcuts: {},
      conflicts: Array.from(this.conflicts),
      config: this.config,
      exportedAt: new Date().toISOString()
    };

    for (const [key, config] of this.shortcuts) {
      exported.shortcuts[key] = {
        ...config,
        handler: config.handler.toString() // Convert function to string
      };
    }

    return exported;
  }

  /**
   * Clear all shortcuts
   * @returns {boolean} - Success status
   */
  clearAll() {
    try {
      // Unregister all shortcuts
      for (const key of this.shortcuts.keys()) {
        this.unregisterShortcut(key);
      }
      
      this.shortcuts.clear();
      this.conflicts.clear();
      
      this.logInfo('All shortcuts cleared');
      return true;
    } catch (error) {
      this.logError('Error clearing all shortcuts:', error);
      return false;
    }
  }

  /**
   * Cleanup shortcut registry
   * @returns {boolean} - Success status
   */
  cleanup() {
    try {
      this.clearAll();
      this.isInitialized = false;
      this.logInfo('Shortcut registry cleaned up');
      return true;
    } catch (error) {
      this.logError('Error cleaning up shortcut registry:', error);
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
      try {
        const result = this.logger.info(message, context);
        if (result && typeof result.catch === 'function') {
          result.catch(() => console.log(`ℹ️ ${message}`, context));
        }
      } catch (error) {
        console.log(`ℹ️ ${message}`, context);
      }
    } else if (typeof window?.logInfo === 'function') {
      window.logInfo(message, context);
    } else {
      console.log(`ℹ️ ${message}`, context || '');
    }
  }

  /**
   * Log debug message
   * @param {string} message - Log message
   * @param {*} context - Additional context
   */
  logDebug(message, context) {
    if (typeof this.logger?.debug === 'function') {
      try {
        const result = this.logger.debug(message, context);
        if (result && typeof result.catch === 'function') {
          result.catch(() => console.log(`🐛 ${message}`, context));
        }
      } catch (error) {
        console.log(`🐛 ${message}`, context);
      }
    } else if (typeof window?.logDebug === 'function') {
      window.logDebug(message, context);
    } else {
      console.log(`🐛 ${message}`, context || '');
    }
  }

  /**
   * Log error message
   * @param {string} message - Log message
   * @param {*} context - Additional context
   */
  logError(message, context) {
    if (typeof this.logger?.error === 'function') {
      try {
        const result = this.logger.error(message, context);
        if (result && typeof result.catch === 'function') {
          result.catch(() => console.error(`❌ ${message}`, context));
        }
      } catch (error) {
        console.error(`❌ ${message}`, context);
      }
    } else if (typeof window?.logError === 'function') {
      window.logError(message, context);
    } else {
      console.error(`❌ ${message}`, context || '');
    }
  }

  /**
   * Log warning message
   * @param {string} message - Log message
   * @param {*} context - Additional context
   */
  logWarn(message, context) {
    if (typeof this.logger?.warn === 'function') {
      try {
        const result = this.logger.warn(message, context);
        if (result && typeof result.catch === 'function') {
          result.catch(() => console.warn(`⚠️ ${message}`, context));
        }
      } catch (error) {
        console.warn(`⚠️ ${message}`, context);
      }
    } else if (typeof window?.logWarn === 'function') {
      window.logWarn(message, context);
    } else {
      console.warn(`⚠️ ${message}`, context || '');
    }
  }
}

// Export default instance
export default ShortcutRegistry;
