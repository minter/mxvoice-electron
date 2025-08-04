/**
 * Renderer Module Loader
 * 
 * This module manages the loading and initialization of all renderer modules
 * in the MxVoice Electron application.
 */

/**
 * Module Loader Class
 * 
 * Handles loading, initialization, and communication between modules
 */
class ModuleLoader {
  constructor() {
    this.modules = {};
    this.loadedModules = new Set();
    this.dependencies = new Map();
    this.moduleOrder = [];
  }

  /**
   * Register a module with its dependencies
   * 
   * @param {string} moduleName - Name of the module
   * @param {Object} moduleInstance - The module instance
   * @param {Array} dependencies - Array of module dependencies
   */
  registerModule(moduleName, moduleInstance, dependencies = []) {
    this.modules[moduleName] = moduleInstance;
    this.dependencies.set(moduleName, dependencies);
    
    console.log(`Module registered: ${moduleName}`);
  }

  /**
   * Load a specific module
   * 
   * @param {string} moduleName - Name of the module to load
   * @returns {Object} - The loaded module instance
   */
  loadModule(moduleName) {
    if (this.loadedModules.has(moduleName)) {
      return this.modules[moduleName];
    }

    if (!this.modules[moduleName]) {
      throw new Error(`Module not found: ${moduleName}`);
    }

    // Check dependencies
    const dependencies = this.dependencies.get(moduleName) || [];
    for (const dep of dependencies) {
      if (!this.loadedModules.has(dep)) {
        this.loadModule(dep);
      }
    }

    // Initialize the module
    const moduleInstance = this.modules[moduleName];
    if (typeof moduleInstance.init === 'function') {
      moduleInstance.init();
    }

    this.loadedModules.add(moduleName);
    console.log(`Module loaded: ${moduleName}`);

    return moduleInstance;
  }

  /**
   * Load all modules in dependency order
   */
  loadAllModules() {
    console.log('Loading all modules...');
    
    // Load modules in order (utils first, then others)
    const moduleNames = Object.keys(this.modules);
    
    // Sort modules by dependencies
    const sortedModules = this.sortModulesByDependencies(moduleNames);
    
    for (const moduleName of sortedModules) {
      this.loadModule(moduleName);
    }
    
    console.log('All modules loaded successfully');
  }

  /**
   * Sort modules by dependencies
   * 
   * @param {Array} moduleNames - Array of module names
   * @returns {Array} - Sorted array of module names
   */
  sortModulesByDependencies(moduleNames) {
    const visited = new Set();
    const sorted = [];
    
    const visit = (moduleName) => {
      if (visited.has(moduleName)) {
        return;
      }
      
      visited.add(moduleName);
      
      const dependencies = this.dependencies.get(moduleName) || [];
      for (const dep of dependencies) {
        visit(dep);
      }
      
      sorted.push(moduleName);
    };
    
    for (const moduleName of moduleNames) {
      visit(moduleName);
    }
    
    return sorted;
  }

  /**
   * Get a loaded module
   * 
   * @param {string} moduleName - Name of the module
   * @returns {Object} - The module instance
   */
  getModule(moduleName) {
    if (!this.loadedModules.has(moduleName)) {
      throw new Error(`Module not loaded: ${moduleName}`);
    }
    
    return this.modules[moduleName];
  }

  /**
   * Get all loaded modules
   * 
   * @returns {Object} - Object containing all loaded modules
   */
  getAllModules() {
    const result = {};
    for (const moduleName of this.loadedModules) {
      result[moduleName] = this.modules[moduleName];
    }
    return result;
  }

  /**
   * Test all modules
   * 
   * @returns {Object} - Test results for all modules
   */
  testAllModules() {
    const results = {};
    
    for (const moduleName of this.loadedModules) {
      const moduleInstance = this.modules[moduleName];
      
      try {
        if (typeof moduleInstance.test === 'function') {
          results[moduleName] = moduleInstance.test();
        } else {
          results[moduleName] = { status: '✅ Module loaded (no test function)' };
        }
      } catch (error) {
        results[moduleName] = { status: `❌ Test failed: ${error.message}` };
      }
    }
    
    return results;
  }

  /**
   * Initialize the module loader
   */
  init() {
    console.log('Module loader initialized');
  }
}

// Create and export a singleton instance
const moduleLoader = new ModuleLoader();

// Export the module loader
module.exports = {
  ModuleLoader,
  loader: moduleLoader
}; 