/**
 * App Bootstrap Module Index
 * 
 * This module serves as the main entry point for application bootstrap functionality
 * extracted from renderer.js. This is Step 1 of incremental bootstrap extraction.
 */

import { moduleConfig } from './module-config.js';

/**
 * Basic module loader function with proper instantiation
 * This replaces the inline module loading logic from renderer.js lines 328-875
 */
export async function loadBasicModules(config, moduleRegistry, logInfo, logError, logWarn, dependencies = {}) {
  // Default dependencies
  const defaultDependencies = {
    // Prefer the compatibility layer, fall back to the secure API if needed
    electronAPI: (typeof window !== 'undefined' && (window.electronAPI || window.secureElectronAPI)) || null,
    debugLog: (typeof window !== 'undefined' && window.debugLog) || null,
    ...dependencies
  };

  for (const moduleConf of config) {
    try {
      logInfo(`Loading ${moduleConf.name} module...`);
      const module = await import(moduleConf.path);
      logInfo(`${moduleConf.name} module loaded successfully`);
      
      if (module.default) {
        // Handle different module patterns
        let moduleInstance;
        
        // Check if it's a class constructor (hotkeys, categories, database, etc.)
        if (typeof module.default === 'function' && module.default.prototype && module.default.prototype.constructor === module.default) {
          logInfo(`Instantiating ${moduleConf.name} class with dependencies`);
          moduleInstance = new module.default(defaultDependencies);
        }
        // Check if it's an initializer function (ui, preferences, debugLog, etc.)
        else if (typeof module.default === 'function') {
          logInfo(`Initializing ${moduleConf.name} function with dependencies`);
          moduleInstance = module.default(defaultDependencies);
        }
        // Otherwise use the export directly
        else {
          logInfo(`Using ${moduleConf.name} module export directly`);
          moduleInstance = module.default;
        }
        
        // Call init() method if it exists
        if (moduleInstance && typeof moduleInstance.init === 'function') {
          logInfo(`Calling init() method for ${moduleConf.name} module`);
          try {
            await moduleInstance.init();
            logInfo(`${moduleConf.name} module initialized successfully`);
          } catch (initError) {
            logError(`Error initializing ${moduleConf.name} module`, initError);
            if (moduleConf.required) {
              throw initError;
            }
          }
        }
        
        moduleRegistry[moduleConf.name] = moduleInstance;
        logInfo(`${moduleConf.name} module instantiated and stored in registry`);
      } else {
        logWarn(`${moduleConf.name} module not available, Function Registry will provide fallbacks`);
      }
    } catch (error) {
      if (moduleConf.required) {
        logError(`Error loading required ${moduleConf.name} module`, error);
        throw error;
      } else {
        logError(`Error loading ${moduleConf.name} module`, error);
        logWarn(`Continuing despite ${moduleConf.name} failure`);
      }
    }
  }
}

// Export the configuration for use by other modules
export { moduleConfig };

// Default export
export default {
  loadBasicModules,
  moduleConfig
};
