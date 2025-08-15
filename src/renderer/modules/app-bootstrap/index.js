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
      let resolvedUrl = '';
      try {
        resolvedUrl = new URL(moduleConf.path, import.meta.url).toString();
      } catch (_) {}
      if (resolvedUrl) {
        logInfo(`Resolving ${moduleConf.name} from: ${resolvedUrl}`);
      } else {
        logWarn(`Could not compute resolved URL for ${moduleConf.name}; path: ${moduleConf.path}`);
      }

      // Always import using the relative specifier so it resolves as an ES module
      // Using a file:// URL can cause the browser to treat it incorrectly
      const specifier = moduleConf.path;

      // Clean imports without verbose diagnostics
      const module = await import(specifier);
      
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
      try {
        let resolvedUrl = '';
        try { resolvedUrl = new URL(moduleConf.path, import.meta.url).toString(); } catch (_) {}
        logError(`Dynamic import failed for ${moduleConf.name} at ${resolvedUrl || moduleConf.path}`, { name: error?.name, message: error?.message });
        if (error && error.stack) {
          logError(`Stack for ${moduleConf.name}`, error.stack);
        }
      } catch (_) {}
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

/**
 * Initialize theme management with preferences module dependency
 * This ensures theme management can access user preferences
 */
export async function initializeThemeManagement(moduleRegistry, logInfo, logError) {
  try {
    logInfo('Checking theme management initialization prerequisites...', {
      hasThemeManagement: !!moduleRegistry.themeManagement,
      hasPreferences: !!moduleRegistry.preferences,
      themeManagementType: typeof moduleRegistry.themeManagement,
      preferencesType: typeof moduleRegistry.preferences
    });

    if (!moduleRegistry.themeManagement) {
      logError('Theme management module not available in registry');
      return false;
    }

    if (!moduleRegistry.preferences) {
      logError('Preferences module not available in registry');
      return false;
    }

    logInfo('Initializing theme management with preferences module');
    await moduleRegistry.themeManagement.initThemeManagement({
      preferencesModule: moduleRegistry.preferences
    });
    logInfo('Theme management initialized successfully');
    return true;
  } catch (error) {
    logError('Failed to initialize theme management', error);
    return false;
  }
}

// Export the configuration for use by other modules
export { moduleConfig };

// Default export
export default {
  loadBasicModules,
  moduleConfig,
  initializeThemeManagement
};
