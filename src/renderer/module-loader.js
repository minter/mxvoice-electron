/**
 * Module Loader
 * 
 * This module provides a unified interface for loading and managing
 * all modules in the MxVoice Electron application.
 */

// Import DebugLog for consistent logging
let debugLog;
try {
  debugLog = window.debugLog;
} catch (error) {
  debugLog = {
    info: console.log,
    warn: console.warn,
    error: console.error,
    debug: console.log
  };
}

/**
 * Module Loader Class
 * 
 * Handles dynamic loading and management of application modules
 */
class ModuleLoader {
  constructor() {
    this.modules = new Map();
    this.loadedModules = new Set();
    this.moduleCache = new Map();
  }

  /**
   * Load a module dynamically
   * 
   * @param {string} modulePath - The path to the module
   * @param {Object} options - Loading options
   * @returns {Promise<Object>} - The loaded module
   */
  async loadModule(modulePath, options = {}) {
    try {
      // Check if module is already loaded
      if (this.moduleCache.has(modulePath)) {
        debugLog.info(`Module already loaded: ${modulePath}`, { 
          function: "loadModule",
          data: { modulePath }
        });
        return this.moduleCache.get(modulePath);
      }

      // Import the module
      const module = await import(modulePath);
      
      // Cache the module
      this.moduleCache.set(modulePath, module);
      this.loadedModules.add(modulePath);
      
      debugLog.info(`Module loaded successfully: ${modulePath}`, { 
        function: "loadModule",
        data: { modulePath }
      });
      return module;
    } catch (error) {
      debugLog.error(`Failed to load module: ${modulePath}`, { 
        function: "loadModule",
        data: { modulePath },
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Load multiple modules
   * 
   * @param {Array<string>} modulePaths - Array of module paths
   * @param {Object} options - Loading options
   * @returns {Promise<Object>} - Object containing all loaded modules
   */
  async loadModules(modulePaths, options = {}) {
    const results = {};
    
    for (const modulePath of modulePaths) {
      try {
        const module = await this.loadModule(modulePath, options);
        results[modulePath] = module;
      } catch (error) {
        debugLog.error(`Failed to load module: ${modulePath}`, { 
          function: "loadModules",
          data: { modulePath },
          error: error.message
        });
        results[modulePath] = { error: error.message };
      }
    }
    
    return results;
  }

  /**
   * Get a loaded module
   * 
   * @param {string} modulePath - The path to the module
   * @returns {Object|null} - The loaded module or null if not found
   */
  getModule(modulePath) {
    return this.moduleCache.get(modulePath) || null;
  }

  /**
   * Check if a module is loaded
   * 
   * @param {string} modulePath - The path to the module
   * @returns {boolean} - True if module is loaded
   */
  isModuleLoaded(modulePath) {
    return this.loadedModules.has(modulePath);
  }

  /**
   * Get all loaded modules
   * 
   * @returns {Array<string>} - Array of loaded module paths
   */
  getLoadedModules() {
    return Array.from(this.loadedModules);
  }

  /**
   * Clear module cache
   */
  clearCache() {
    this.moduleCache.clear();
    this.loadedModules.clear();
    debugLog.info('Module cache cleared', { 
      function: "clearCache" 
    });
  }

  /**
   * Get module loader information
   * 
   * @returns {Object} - Module loader information
   */
  getInfo() {
    return {
      name: 'Module Loader',
      version: '1.0.0',
      description: 'Handles dynamic loading and management of application modules',
      loadedModules: this.getLoadedModules(),
      cacheSize: this.moduleCache.size
    };
  }
}

// Create and export a singleton instance
const moduleLoader = new ModuleLoader();

// Export the module loader
module.exports = {
  ModuleLoader,
  loader: moduleLoader
}; 