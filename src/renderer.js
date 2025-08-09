// Remove legacy global variables and use shared state instead
// Legacy globals moved to shared state module

// Import debug logger for centralized logging
import initializeDebugLogger from './renderer/modules/debug-log/debug-logger.js';

// Global shared state instance
let sharedStateInstance = null;
let sharedStateInitialized = false;

// Global debug logger instance
let debugLogger = null;

// Initialize debug logger with fallback
async function initializeDebugLoggerInstance() {
  try {
    debugLogger = initializeDebugLogger({
      electronAPI: window.electronAPI,
      db: window.db,
      store: null // Will use electronAPI.store
    });
    await debugLogger.info('Debug logger initialized');
    return debugLogger;
  } catch (error) {
    console.error('Failed to initialize debug logger:', error);
    // Create fallback logger
    return {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info,
      debug: console.log,
      isDebugEnabled: () => Promise.resolve(false),
      setDebugEnabled: () => Promise.resolve(false),
      getLogLevel: () => 2,
      setLogLevel: () => {}
    };
  }
}

// Synchronous wrapper for common logging patterns
function logInfo(message, context = null) {
  if (debugLogger) {
    debugLogger.info(message, context).catch(() => {
      // Fallback to console if debug logger fails
      console.log(`ℹ️ ${message}`, context);
    });
  } else {
    console.log(`ℹ️ ${message}`, context);
  }
}

function logDebug(message, context = null) {
  if (debugLogger) {
    debugLogger.debug(message, context).catch(() => {
      // Fallback to console if debug logger fails
      console.log(`🐛 ${message}`, context);
    });
  } else {
    console.log(`🐛 ${message}`, context);
  }
}

function logWarn(message, context = null) {
  if (debugLogger) {
    debugLogger.warn(message, context);
  } else {
    console.warn(`⚠️ ${message}`, context);
  }
}

function logError(message, context = null) {
  if (debugLogger) {
    debugLogger.error(message, context);
  } else {
    console.error(`❌ ${message}`, context);
  }
}

// Helper function to get shared state with fallback
function getSharedState() {
  if (sharedStateInstance && sharedStateInitialized) {
    return sharedStateInstance;
  }
  
  // Fallback: create a minimal shared state if not initialized
  logWarn('Shared state not initialized, using fallback');
  return {
    get: (key) => {
      logWarn(`Shared state fallback get(${key})`);
      return null;
    },
    set: (key, value) => {
      logWarn(`Shared state fallback set(${key}, ${value})`);
    },
    subscribe: (key, callback) => {
      logWarn(`Shared state fallback subscribe(${key})`);
      return () => {};
    }
  };
}

// Function to check shared state health
function checkSharedStateHealth() {
  const health = {
    initialized: sharedStateInitialized,
    instance: !!sharedStateInstance,
    windowSharedState: !!window.sharedState,
    windowGetSharedState: !!window.getSharedState
  };
  
  logDebug('Shared State Health Check', health);
  return health;
}

// Initialize shared state first with proper error handling and state management
async function initializeSharedState() {
  try {
    if (debugLogger) {
      debugLogger.info('Initializing shared state...');
    } else {
      console.log('🔧 Initializing shared state...');
    }
    
    const sharedStateModule = await import('./renderer/modules/shared-state.js');
    sharedStateInstance = sharedStateModule.default;
    
    // Initialize shared state with default values
    sharedStateInstance.set('sound', null);
    sharedStateInstance.set('globalAnimation', null);
    
    // Don't create WaveSurfer immediately since the element is hidden
    // It will be created when the waveform is first shown
    sharedStateInstance.set('wavesurfer', null);
    
    // Add a method to create WaveSurfer when needed
    sharedStateInstance.set('createWaveSurfer', () => {
      const waveformElement = document.getElementById('waveform');
      if (waveformElement && typeof WaveSurfer !== 'undefined' && !sharedStateInstance.get('wavesurfer')) {
        logInfo('Creating WaveSurfer instance...');
        const wavesurfer = WaveSurfer.create({
          container: "#waveform",
          waveColor: "#e9ecef",
          backgroundColor: "#343a40",
          progressColor: "#007bff",
          cursorColor: "white",
          cursorWidth: 0,
          responsive: true,
          height: 100,
        });
        sharedStateInstance.set('wavesurfer', wavesurfer);
        return wavesurfer;
      }
      return sharedStateInstance.get('wavesurfer');
    });
    
    sharedStateInstance.set('autoplay', false);
    sharedStateInstance.set('loop', false);
    sharedStateInstance.set('holdingTankMode', "storage"); // 'storage' or 'playlist'
    sharedStateInstance.set('fontSize', 11);
    sharedStateInstance.set('categories', {}); // Changed from [] to {} for proper category lookup
    sharedStateInstance.set('searchTimeout', null);
    
    // Make searchTimeout available globally for backward compatibility
    window.searchTimeout = null;
    
    // Make shared state available globally for modules
    window.sharedState = sharedStateInstance;
    window.getSharedState = getSharedState;
    window.checkSharedStateHealth = checkSharedStateHealth;
    
    sharedStateInitialized = true;
    logInfo('Shared state initialized with default values');
    return true;
  } catch (error) {
    logError('Failed to initialize shared state', error);
    sharedStateInitialized = false;
    return false;
  }
}

// Module registry to avoid window pollution
const moduleRegistry = {};

// Import function registry for centralized function management
import FunctionRegistry from './renderer/function-registry.js';
import EventManager from './renderer/event-manager.js';
import FunctionMonitor from './renderer/function-monitor.js';

// These will be initialized after the debug logger is available
let functionRegistry = null;
let eventManager = null;
let functionMonitor = null;

// Load the last holding tank and hotkeys

// Always clear the holding tank store to ensure we load the new HTML
window.electronAPI.store.has("holding_tank").then(hasHoldingTank => {
  if (hasHoldingTank) {
    window.electronAPI.store.delete("holding_tank").then(() => {
      logInfo("Cleared holding tank store to load new HTML");
    });
  }
});

// Mode initialization will be handled by the mode management module
// The module will be initialized after all modules are loaded

// Load hotkeys
window.electronAPI.store.has("hotkeys").then(hasHotkeys => {
  if (hasHotkeys) {
    window.electronAPI.store.get("hotkeys").then(storedHotkeysHtml => {
      // Check if the stored HTML contains the old plain text header
      if (
        storedHotkeysHtml && typeof storedHotkeysHtml === 'string' &&
        storedHotkeysHtml.includes("Hotkeys") &&
        !storedHotkeysHtml.includes("header-button")
      ) {
        // This is the old HTML format, clear it so the new HTML loads
        window.electronAPI.store.delete("hotkeys").then(() => {
          logInfo("Cleared old hotkeys HTML format");
        });
      } else if (storedHotkeysHtml && typeof storedHotkeysHtml === 'string') {
        $("#hotkeys-column").html(storedHotkeysHtml);
        $("#selected_row").removeAttr("id");
      }
    });
  }
});

// Load column order
window.electronAPI.store.has("column_order").then(hasColumnOrder => {
  if (hasColumnOrder) {
    window.electronAPI.store.get("column_order").then(columnOrder => {
      if (columnOrder && Array.isArray(columnOrder)) {
        columnOrder.forEach(function (val) {
          $("#top-row").append($("#top-row").children(`#${val}`).detach());
        });
      }
    });
  }
});

// Load font size
window.electronAPI.store.has("font-size").then(hasFontSize => {
  if (hasFontSize) {
    window.electronAPI.store.get("font-size").then(size => {
      if (size !== undefined && size !== null) {
        // This global variable is now managed by shared state
        // moduleRegistry.fontSize = size;
      }
    });
  }
});

// Animation utilities moved to utils module

function saveHoldingTankToStore() {
  // Only save if we have the new HTML format with mode toggle
  var currentHtml = $("#holding-tank-column").html();
  if (currentHtml.includes("mode-toggle")) {
    window.electronAPI.store.set("holding_tank", currentHtml);
  }
}

function saveHotkeysToStore() {
  // Only save if we have the new HTML format with header button
  var currentHtml = $("#hotkeys-column").html();
  if (currentHtml.includes("header-button")) {
    window.electronAPI.store.set("hotkeys", currentHtml);
  }
}

// Hotkeys and holding tank functions moved to respective modules

// File Operations Module - Functions extracted to src/renderer/modules/file-operations/
// openHotkeyFile(), openHoldingTankFile(), saveHotkeyFile(), saveHoldingTankFile()
// pickDirectory(), installUpdate() - All moved to file-operations module

// Initialize shared state when DOM is ready
$(document).ready(async function() {
  try {
    // Use console directly before debug logger is initialized
    console.log('🔧 DOM ready, initializing debug logger...');
    await initializeDebugLoggerInstance();
    
    // Now we can use the debug logger
    debugLogger.info('Debug logger initialized, DOM ready');
    debugLogger.info('DOM ready, initializing shared state...');
    if (!sharedStateInitialized) {
      await initializeSharedState();
    }
  } catch (error) {
    logError('Error initializing shared state on DOM ready', error);
  }
});

// Import bootstrap module for module loading
import AppBootstrap from './renderer/modules/app-bootstrap/index.js';

// Load modules dynamically and make functions globally available
(async function loadModules() {
  try {
    if (debugLogger) {
      debugLogger.info('Starting module loading...');
    } else {
      console.log('🔧 Starting module loading...');
    }
    
    // Ensure shared state is initialized before loading modules
    if (!sharedStateInitialized) {
      if (debugLogger) {
        debugLogger.info('Waiting for shared state initialization...');
      } else {
        console.log('🔧 Waiting for shared state initialization...');
      }
      const sharedStateResult = await initializeSharedState();
      if (!sharedStateResult) {
        throw new Error('Failed to initialize shared state');
      }
    }
    
    logInfo('Shared state is ready, proceeding with module loading...');
    
    // Load basic modules using the bootstrap module
    logInfo('Loading modules using bootstrap configuration...');
    await AppBootstrap.loadBasicModules(
      AppBootstrap.moduleConfig, 
      moduleRegistry, 
      logInfo, 
      logError, 
      logWarn,
      {
        electronAPI: window.electronAPI,
        db: window.db,
        store: window.store,
        debugLog: window.debugLog
      }
    );
    logInfo('Basic module loading completed');
    
    // TODO: The complex module instantiation logic will be moved to bootstrap module in next step
    // For now, we'll keep the complex logic below until the next incremental step
    
    // Declare module variables for complex instantiation (temporary)
    let fileOperationsModule, songManagementModule, holdingTankModule, hotkeysModule;
    let categoriesModule, bulkOperationsModule, dragDropModule, navigationModule;
    let modeManagementModule, testUtilsModule, searchModule, audioModule;
    let uiModule, preferencesModule, databaseModule, utilsModule, debugLogModule;
    
    // NOTE: Basic module loading is now handled by bootstrap module above
    // The complex instantiation logic below will be moved to bootstrap in the next incremental step
    
    // TODO: Remove these redundant imports - they are now handled by AppBootstrap.loadBasicModules()
    // Keeping temporarily to prevent breaking changes during incremental extraction
    
    // Simple modules like fileOperations and songManagement are now loaded by bootstrap
    // but we can still access them from moduleRegistry for complex instantiation below

    // Import holding tank module and store in registry
    try {
      logInfo('Loading holding-tank module...');
      holdingTankModule = await import('./renderer/modules/holding-tank/index.js');
      logInfo('holding-tank module loaded successfully');
    } catch (error) {
      logError('Error loading holding-tank module', error);
      throw error;
    }
    
    // Store in registry for Function Registry to manage
    const holdingTankInstance = holdingTankModule.default;
    moduleRegistry.holdingTank = holdingTankInstance;
    
    // Create synchronous wrappers for async functions for Function Registry access
    const clearHoldingTankWrapper = function() {
      holdingTankInstance.clearHoldingTank().catch(error => {
        logError('Error in clearHoldingTank', error);
      });
    };
    const renameHoldingTankTabWrapper = function() {
      holdingTankInstance.renameHoldingTankTab().catch(error => {
        logError('Error in renameHoldingTankTab', error);
      });
    };
    
    // Create a wrapper for saveHoldingTankToStore that includes state updates
    const saveHoldingTankToStoreWrapper = () => {
      logInfo('Saving holding tank to store and refreshing display');
      holdingTankInstance.saveHoldingTankToStore().then(() => {
        logInfo('Holding tank saved successfully, refreshing display');
        // Refresh the display after saving
        window.populateHoldingTank();
      }).catch(error => {
        logError('Error saving holding tank to store', error);
      });
    };
    
    // Store wrapper functions on instance for Function Registry access
    holdingTankInstance.clearHoldingTankWrapper = clearHoldingTankWrapper;
    holdingTankInstance.renameHoldingTankTabWrapper = renameHoldingTankTabWrapper;
    holdingTankInstance.saveHoldingTankToStoreWrapper = saveHoldingTankToStoreWrapper;
    logInfo('Holding tank module stored in registry');

    // Import hotkeys module and store in registry
    try {
      logInfo('Loading hotkeys module...');
      hotkeysModule = await import('./renderer/modules/hotkeys/index.js');
      logInfo('hotkeys module loaded successfully');
      
      // Create hotkeys module instance and store in registry
      logInfo('Creating hotkeys module instance...');
      logDebug('window.electronAPI available', !!window.electronAPI);
      logDebug('window.electronAPI.store available', !!window.electronAPI?.store);
      
      const hotkeysInstance = new hotkeysModule.default({
        electronAPI: window.electronAPI,
        db: null, // Legacy database not used
        store: window.electronAPI?.store
      });
      
      // Store in registry
      moduleRegistry.hotkeys = hotkeysInstance;
      
      logInfo('Hotkeys module instance created successfully');
      logDebug('hotkeysInstance.populateHotkeys available', typeof hotkeysInstance.populateHotkeys);
      
      // Create wrapper functions for Function Registry access
      const clearHotkeysWrapper = function() {
        hotkeysInstance.clearHotkeys().catch(error => {
          logError('Error in clearHotkeys', error);
        });
      };
      const renameHotkeyTabWrapper = function() {
        hotkeysInstance.renameHotkeyTab().catch(error => {
          logError('Error in renameHotkeyTab', error);
        });
      };
      const populateHotkeysWrapper = function(fkeys, title) {
        logDebug('populateHotkeysWrapper called with', { fkeys, title });
        try {
          logInfo('About to call hotkeysInstance.populateHotkeys...');
          const result = hotkeysInstance.populateHotkeys.call(hotkeysInstance, fkeys, title);
          logInfo('populateHotkeys completed successfully');
          return result;
        } catch (error) {
          logError('Error in populateHotkeys', error);
          throw error;
        }
      };
      
      // Store wrapper functions on instance for Function Registry access
      hotkeysInstance.clearHotkeysWrapper = clearHotkeysWrapper;
      hotkeysInstance.renameHotkeyTabWrapper = renameHotkeyTabWrapper;
      hotkeysInstance.populateHotkeysWrapper = populateHotkeysWrapper;
      logInfo('Hotkeys module loaded successfully');
      logInfo('populateHotkeys function is now available globally');
      
      // Test the hotkeys instance
      logDebug('Testing hotkeys instance...');
      logDebug('hotkeysInstance type', typeof hotkeysInstance);
      logDebug('hotkeysInstance.populateHotkeys type', typeof hotkeysInstance.populateHotkeys);
      logDebug('hotkeysInstance.electronAPI available', !!hotkeysInstance.electronAPI);
          } catch (error) {
        logWarn('Failed to load hotkeys module', error);
        // Continue loading other modules even if hotkeys fails
      }

    logDebug('REACHED: After hotkeys module, before categories module...');
    // Import categories module and make functions globally available
    logDebug('REACHED: About to start categories module loading...');
    try {
      logInfo('Loading categories module...');
      logDebug('About to import categories module...');
      
      // Create a temporary deleteCategory function to prevent errors
      window.deleteCategory = function(event, code, description) {
        logDebug('deleteCategory called with', { event, code, description });
        
        // Simple fallback implementation
        if (confirm(`Are you sure you want to delete "${description}" from Mx. Voice permanently? All songs in this category will be changed to the category "Uncategorized."`)) {
          logInfo(`Deleting category ${code}`);
          // For now, just show a message that the module isn't loaded
          alert('Category deletion requires the categories module to be loaded. Please try again.');
        }
        
        // Also try the deferred approach
        setTimeout(() => {
          logDebug('Checking for deleteCategoryUI...');
          logDebug('window.deleteCategoryUI', typeof window.deleteCategoryUI);
          logDebug('window.deleteCategory', typeof window.deleteCategory);
          if (window.deleteCategoryUI) {
            logInfo('Calling deleteCategoryUI...');
            window.deleteCategoryUI(event, code, description);
          } else {
            logError('deleteCategoryUI not available');
            logDebug('Available window functions', Object.keys(window).filter(key => key.includes('delete')));
          }
        }, 100);
      };
      
      logInfo('Starting import of categories module...');
      try {
        categoriesModule = await import('./renderer/modules/categories/index.js');
        logInfo('categories module import successful');
      } catch (importError) {
        logError('Categories module import failed', importError);
        throw importError;
      }
      logInfo('categories module loaded successfully');
      
      // The categories module exports a singleton instance, not a constructor
      const categoriesInstance = categoriesModule.default;
      logDebug('categoriesInstance created', typeof categoriesInstance);
      logDebug('categoriesInstance.deleteCategoryUI', typeof categoriesInstance.deleteCategoryUI);
      
      // Initialize the categories module
      await categoriesInstance.init();
      
      // Load categories into shared state for other modules to use
      try {
        await categoriesInstance.loadCategories();
        logInfo('Categories loaded into shared state');
      } catch (error) {
        logWarn('Failed to load categories into shared state', error);
      }
      
      logInfo('Categories module initialized');
      logDebug('deleteCategoryUI available', typeof categoriesInstance.deleteCategoryUI);
      
      // Store in registry and create minimal window assignments
      moduleRegistry.categories = categoriesInstance;
      
      // Store in registry for Function Registry to manage
      logInfo('Categories module stored in registry');
      
      // Update the wrapper function for the HTML onclick compatibility
      window.deleteCategory = function(event, code, description) {
        logDebug('deleteCategory wrapper called with', { event, code, description });
        logDebug('deleteCategory parameters - code', code);
        logDebug('deleteCategory parameters - description', description);
        return categoriesInstance.deleteCategoryUI(event, code, description);
      };
      
      logInfo('Categories module loaded successfully');
      logDebug('deleteCategory function available', typeof window.deleteCategory);
    } catch (error) {
      logWarn('Failed to load categories module', error);
      logError('Categories module error details', error);
      // Continue loading other modules even if categories fails
    }

    // Import bulk operations module and store in registry
    try {
      logInfo('Loading bulk-operations module...');
      bulkOperationsModule = await import('./renderer/modules/bulk-operations/index.js');
      logInfo('bulk-operations module loaded successfully');
      
      // Store in registry and create minimal window assignments
      const bulkOperationsInstance = bulkOperationsModule.default;
      moduleRegistry.bulkOperations = bulkOperationsInstance;
      
      // Store in registry for Function Registry to manage
      logInfo('Bulk operations module stored in registry');
    } catch (error) {
      logError('Error loading bulk-operations module', error);
      // Continue loading other modules even if bulk operations fails
    }

    // Import drag-drop module and store in registry
    try {
      logInfo('Loading drag-drop module...');
      dragDropModule = await import('./renderer/modules/drag-drop/index.js');
      logInfo('drag-drop module loaded successfully');
      
      // Store in registry for Function Registry to manage
      const dragDropInstance = dragDropModule.default;
      
      // Import functions and add them to the instance
      const { songDrag, columnDrag } = await import('./renderer/modules/drag-drop/drag-drop-functions.js');
      dragDropInstance.songDrag = songDrag;
      dragDropInstance.columnDrag = columnDrag;
      
      moduleRegistry.dragDrop = dragDropInstance;
      logInfo('Drag drop module stored in registry');
    } catch (error) {
      logError('Error loading drag-drop module', error);
      // Continue loading other modules even if drag-drop fails
    }

    // Import navigation module and store in registry
    try {
      logInfo('Loading navigation module...');
      navigationModule = await import('./renderer/modules/navigation/index.js');
      logInfo('navigation module loaded successfully');
      
      // Store in registry and create minimal window assignments
      const navigationInstance = navigationModule.default;
      moduleRegistry.navigation = navigationInstance;
      
      // Store in registry for Function Registry to manage
      logInfo('Navigation module stored in registry');
    } catch (error) {
      logError('Error loading navigation module', error);
      // Continue loading other modules even if navigation fails
    }

    // Import mode management module and store in registry
    try {
      logInfo('Loading mode-management module...');
      modeManagementModule = await import('./renderer/modules/mode-management/index.js');
      logInfo('mode-management module loaded successfully');
      
      // Store in registry and create minimal window assignments
      const modeManagementInstance = modeManagementModule.default;
      moduleRegistry.modeManagement = modeManagementInstance;
      
      // Store in registry for Function Registry to manage
      logInfo('Mode management module stored in registry');
      
      // Initialize mode management module
      const result = await modeManagementInstance.initModeManagement();
      if (result.error) {
        logWarn('Failed to initialize mode management module', result.error);
      } else {
        logInfo('Mode management module initialized successfully');
      }
    } catch (error) {
      logError('Error loading mode-management module', error);
      // Continue loading other modules even if mode management fails
    }

    // Import test utils module and store in registry
    try {
      logInfo('Loading test-utils module...');
      testUtilsModule = await import('./renderer/modules/test-utils/index.js');
      logInfo('test-utils module loaded successfully');
      
      // Store in registry and create minimal window assignments
      const testUtilsInstance = testUtilsModule.default;
      moduleRegistry.testUtils = testUtilsInstance;
      
      // Only assign functions called from HTML
      // Store in registry for Function Registry to manage
      logInfo('Test utils module stored in registry');
    } catch (error) {
      logError('Error loading test-utils module', error);
      // Continue loading other modules even if test utils fails
    }

    // Import search module and store in registry
    try {
      logInfo('Loading search module...');
      searchModule = await import('./renderer/modules/search/index.js');
      logInfo('search module loaded successfully');
      
      // The search module exports a singleton instance, not a constructor
      const searchInstance = searchModule.default;
      
      // Store in registry
      moduleRegistry.search = searchInstance;
      
      // Initialize the search module
      searchInstance.init();
      
      // Store in registry for Function Registry to manage
      logInfo('Search module stored in registry');
      logInfo('Search module loaded successfully');
    } catch (error) {
      logWarn('Failed to load search module', error);
      // Continue loading other modules even if search fails
    }

    // Import audio module and store in registry
    try {
      logInfo('Loading audio module...');
      audioModule = await import('./renderer/modules/audio/index.js');
      logInfo('audio module loaded successfully');
      
      // The audio module exports a singleton instance, not a constructor
      const audioInstance = audioModule.default;
      
      // Store in registry
      moduleRegistry.audio = audioInstance;
      
      // Initialize the audio module
      audioInstance.init();
      
      // Store in registry for Function Registry to manage
      logInfo('Audio module stored in registry');
      // window.howlerUtils = audioInstance.howlerUtils.bind(audioInstance); // Function not implemented yet
      logInfo('Audio module loaded successfully');
    } catch (error) {
      logError('Failed to load audio module', error);
      logError('Audio module error stack', error.stack);
      logError('Audio module error message', error.message);
      // Continue loading other modules even if audio fails
    }

    // Import UI module and store in registry
    let uiInstance = null;
    try {
      logInfo('Loading ui module...');
      uiModule = await import('./renderer/modules/ui/index.js');
      logInfo('ui module loaded successfully');
      
      // Re-initialize UI module with proper dependencies
      uiInstance = uiModule.default.reinitializeUI({
        electronAPI: window.electronAPI,
        db: window.db,
        store: null // Legacy store not available, will use electronAPI.store
      });
      
      // Store in registry
      moduleRegistry.ui = uiInstance;
    } catch (error) {
      logError('Error loading ui module', error);
      throw error;
    }
    
    // Store wrapper functions for async methods
    if (uiInstance) {
      const renameHotkeyTabWrapper = function() {
        uiInstance.renameHotkeyTab().catch(error => {
          logError('Error in renameHotkeyTab', error);
        });
      };
      const renameHoldingTankTabUIWrapper = function() {
        uiInstance.renameHoldingTankTab().catch(error => {
          logError('Error in renameHoldingTankTab', error);
        });
      };
      
      // Store wrapper functions on instance for Function Registry access
      uiInstance.renameHotkeyTabWrapper = renameHotkeyTabWrapper;
      uiInstance.renameHoldingTankTabUIWrapper = renameHoldingTankTabUIWrapper;
      logInfo('UI module stored in registry');
    } else {
      logError('UI instance not available, skipping UI function assignments');
    }

    // Import preferences module and store in registry
    try {
      logInfo('Loading preferences module...');
      preferencesModule = await import('./renderer/modules/preferences/index.js');
      logInfo('preferences module loaded successfully');
      
      // Re-initialize preferences module with proper dependencies
      const preferencesInstance = preferencesModule.default.reinitializePreferences({
        electronAPI: window.electronAPI,
        db: window.db,
        store: null // Legacy store not available, will use electronAPI.store
      });
      
      // Store in registry
      moduleRegistry.preferences = preferencesInstance;
      
      // Store in registry for Function Registry to manage
      logInfo('Preferences module stored in registry');
    } catch (error) {
      logError('Error loading preferences module', error);
      throw error;
    }

    // Import DebugLog module and store in registry
    try {
      logInfo('Loading DebugLog module...');
      debugLogModule = await import('./renderer/modules/debug-log/index.js');
      logInfo('DebugLog module loaded successfully');
      
      // Re-initialize DebugLog module with proper dependencies
      const debugLogInstance = debugLogModule.default.reinitializeDebugLog({
        electronAPI: window.electronAPI,
        db: window.db,
        store: null // Legacy store not available, will use electronAPI.store
      });
      
      // Store in registry
      moduleRegistry.debugLog = debugLogInstance;
      
      // Make DebugLog available globally for other modules
      window.debugLog = debugLogInstance;
      logInfo('DebugLog module initialized and available globally');
      
      // Initialize dependent classes with the debug logger
      functionRegistry = new FunctionRegistry(debugLogInstance);
      eventManager = new EventManager(functionRegistry, debugLogInstance);
      functionMonitor = new FunctionMonitor(functionRegistry, debugLogInstance);
      
      logInfo('Dependent classes initialized with debug logger');
    } catch (error) {
      logError('Error loading DebugLog module', error);
      // Don't throw error, continue loading other modules
    }

    // Import database module and store in registry
    try {
      logInfo('Loading database module...');
      try {
        databaseModule = await import('./renderer/modules/database/index.js');
        logInfo('Database module import successful');
      } catch (importError) {
        logError('Database module import failed', importError);
        logError('Import error stack', importError.stack);
        logError('Import error message', importError.message);
        throw importError;
      }
      logInfo('database module loaded successfully');
      
      // The database module exports a singleton instance directly
      const databaseInstance = databaseModule.default;
      
      // Store in registry
      moduleRegistry.database = databaseInstance;
      
      // Initialize the database module
      databaseInstance.init();
      
      // Store in registry for Function Registry to manage
      logInfo('Database module stored in registry');
      logInfo('Database module loaded successfully');
      logInfo('populateHoldingTank function is now available globally');
    } catch (error) {
      logError('Failed to load database module', error);
      logError('Database module error stack', error.stack);
      logError('Database module error message', error.message);
      logError('Database module error name', error.name);
      if (error.line) logError('Database module error line', error.line);
      if (error.column) logError('Database module error column', error.column);
      // Continue loading other modules even if database fails
    }

    // Import utils module and store in registry
    try {
      logInfo('Loading utils module...');
      try {
        utilsModule = await import('./renderer/modules/utils/index.js');
        logInfo('Utils module import successful');
      } catch (importError) {
        logError('Utils module import failed', importError);
        logError('Import error stack', importError.stack);
        logError('Import error message', importError.message);
        throw importError;
      }
      logInfo('utils module loaded successfully');
      
      // The utils module exports a singleton instance, not a constructor
      const utilsInstance = utilsModule.default;
      
      // Store in registry
      moduleRegistry.utils = utilsInstance;
      
      // Initialize the utils module
      utilsInstance.init();
      
      // Store in registry for Function Registry to manage
      logInfo('Utils module stored in registry');
      logInfo('Utils module loaded successfully');
    } catch (error) {
      logError('Failed to load utils module', error);
      logError('Utils module error stack', error.stack);
      logError('Utils module error message', error.message);
      logError('Utils module error name', error.name);
      if (error.line) logError('Utils module error line', error.line);
      if (error.column) logError('Utils module error column', error.column);
      // Continue loading other modules even if utils fails
    }

    logInfo('All modules loaded successfully!');
    logInfo('Module Registry Summary:');
    logDebug('File Operations', !!moduleRegistry.fileOperations);
    logDebug('Song Management', !!moduleRegistry.songManagement);
    logDebug('Holding Tank', !!moduleRegistry.holdingTank);
    logDebug('Hotkeys', !!moduleRegistry.hotkeys);
    logDebug('Categories', !!moduleRegistry.categories);
    logDebug('Bulk Operations', !!moduleRegistry.bulkOperations);
    logDebug('Drag Drop', !!moduleRegistry.dragDrop);
    logDebug('Navigation', !!moduleRegistry.navigation);
    logDebug('Mode Management', !!moduleRegistry.modeManagement);
    logDebug('Test Utils', !!moduleRegistry.testUtils);
    logDebug('Search', !!moduleRegistry.search);
    logDebug('Audio', !!moduleRegistry.audio);
    logDebug('UI', !!moduleRegistry.ui);
    logDebug('Preferences', !!moduleRegistry.preferences);
    logDebug('Database', !!moduleRegistry.database);
    logDebug('Utils', !!moduleRegistry.utils);

    // Make module registry available for debugging and development
    window.moduleRegistry = moduleRegistry;
    window.functionMonitor = functionMonitor;
    
    // Initialize function registry with loaded modules
    logInfo('Initializing function registry...');
    functionRegistry.setModuleRegistry(moduleRegistry);
    await functionRegistry.registerAllFunctions();
    
    // Validate critical functions are available
    if (!functionRegistry.validateFunctions()) {
      logWarn('Some critical functions are missing, but continuing...');
    }
    
    // Log function registry statistics
    const stats = functionRegistry.getStats();
    logInfo('Function Registry Statistics', stats);
    
    // Initialize event manager to replace onclick attributes
    logInfo('Initializing event manager...');
    eventManager.initialize();
    
    // Log event manager statistics
    const eventStats = eventManager.getStats();
    logInfo('Event Manager Statistics', eventStats);
    
    // Initialize function monitor for real-time health checking
    logInfo('Initializing function monitor...');
    functionMonitor.startMonitoring();
    
    // Log function monitor statistics
    const monitorStats = functionMonitor.getStats();
    logInfo('Function Monitor Statistics', monitorStats);
    
    // Verify critical functions are available
    function verifyCriticalFunctions() {
      const criticalFunctions = [
        'playSongFromId',
        'stopPlaying', 
        'pausePlaying',
        'searchData',
        'populateCategorySelect'
      ];
      
      const missingFunctions = criticalFunctions.filter(func => !window[func]);
      
      if (missingFunctions.length > 0) {
        logWarn('Missing critical functions', missingFunctions);
        logWarn('This may cause runtime errors');
      } else {
        logInfo('All critical functions are available');
      }
    }
    
    // Call verification after module loading
    verifyCriticalFunctions();
    
    // Legacy functions moved to modules - keeping only HTML-compatible functions
    // All other functions are now available through moduleRegistry
    // Example: moduleRegistry.fileOperations.openHotkeyFile() instead of window.openHotkeyFile

    // Initialize modules after loading
    try {
      if (moduleRegistry.bulkOperations && moduleRegistry.bulkOperations.initializeBulkOperations) {
        moduleRegistry.bulkOperations.initializeBulkOperations();
      }
      if (moduleRegistry.dragDrop && moduleRegistry.dragDrop.initializeDragDrop) {
        moduleRegistry.dragDrop.initializeDragDrop();
      }
      if (moduleRegistry.navigation && moduleRegistry.navigation.initializeNavigation) {
        moduleRegistry.navigation.initializeNavigation();
      }
      logInfo('All modules initialized successfully!');
    } catch (error) {
      logError('Error initializing modules', error);
    }

    // Call functions that depend on loaded modules
    try {
      if (window.scale_scrollable) {
        window.scale_scrollable();
      }
      // Ensure categories are populated after database module is loaded
      if (window.populateCategorySelect) {
        logInfo('Attempting to populate categories...');
        await window.populateCategorySelect();
        logInfo('Categories populated successfully');
      } else {
        logWarn('populateCategorySelect function not available');
      }
      logInfo('Module-dependent functions called successfully!');
    } catch (error) {
      logError('Error calling module-dependent functions', error);
    }

    // Set up keyboard shortcuts after modules are loaded
    try {
      setupKeyboardShortcuts();
      logInfo('Keyboard shortcuts set up successfully!');
    } catch (error) {
      logError('Error setting up keyboard shortcuts', error);
    }
  } catch (error) {
    logError('Error loading modules', error);
    logError('Error stack', error.stack);
    logError('Error message', error.message);
  }
})();

// Preferences and database functions moved to respective modules

// Search functions moved to search module

// Live search functions moved to search module

// Database functions moved to database module

// Database functions moved to database module

// howlerUtils moved to audio module

// Audio functions moved to audio module





// Mode Management Module - Functions extracted to src/renderer/modules/mode-management/
// setHoldingTankMode(), toggleAutoPlay() - All moved to mode-management module

// Song Management Module - Functions extracted to src/renderer/modules/song-management/
// deleteSong(), removeFromHoldingTank(), removeFromHotkey() - All moved to song-management module

// UI functions moved to ui module

// Song Management Module - Functions extracted to src/renderer/modules/song-management/
// editSelectedSong(), deleteSelectedSong() - All moved to song-management module

// Song Management Module - Functions extracted to src/renderer/modules/song-management/
// showBulkAddModal(), addSongsByPath(), saveBulkUpload() - All moved to bulk-operations module

// Categories functions moved to categories module

// All functions have been moved to their respective modules
// Use moduleRegistry to access module functions
// Example: moduleRegistry.ui.toggleSelectedRow(row) instead of toggle_selected_row(row)

// Legacy functions removed - now handled by modules:
// - toggle_selected_row() -> moduleRegistry.ui.toggleSelectedRow()
// - loop_on() -> moduleRegistry.audio.loop_on()
// - closeAllTabs() -> moduleRegistry.ui.closeAllTabs()

/**
 * Set up keyboard shortcuts after modules are loaded
 */
function setupKeyboardShortcuts() {
  var search_field = document.getElementById("omni_search");

  // Set up fkeys
  for (let i = 1; i <= 12; i++) {
    Mousetrap.bind(`f${i}`, function () {
      if (window.playSongFromHotkey) {
        playSongFromHotkey(`f${i}`);
      }
    });

    Mousetrap(search_field).bind(`f${i}`, function () {
      if (window.playSongFromHotkey) {
        playSongFromHotkey(`f${i}`);
      }
    });
  }

  for (let i = 1; i <= 5; i++) {
    Mousetrap.bind(`command+${i}`, function () {
      if (window.switchToHotkeyTab) {
        switchToHotkeyTab(i);
      }
    });
  }

  Mousetrap(search_field).bind("esc", function () {
    if (window.stopPlaying) {
      stopPlaying();
    }
  });

  Mousetrap.bind("esc", function () {
    if (window.stopPlaying) {
      stopPlaying();
    }
  });
  Mousetrap.bind("shift+esc", function () {
    if (window.stopPlaying) {
      stopPlaying(true);
    }
  });

  Mousetrap.bind("command+l", function () {
    $("#omni_search").focus().select();
  });

  Mousetrap.bind("space", function () {
    if (window.pausePlaying) {
      pausePlaying();
    }
    return false;
  });

  Mousetrap.bind("shift+space", function () {
    if (window.pausePlaying) {
      pausePlaying(true);
    }
    return false;
  });

  Mousetrap.bind("return", function () {
    if (!$("#songFormModal").hasClass("show") && window.playSelected) {
      playSelected();
    }
    return false;
  });

  Mousetrap.bind(["backspace", "del"], function () {
    logDebug("Delete key pressed");
    logDebug("selected_row", $("#selected_row"));
    logDebug("holding-tank-column has selected_row", $("#holding-tank-column").has($("#selected_row")).length);
    logDebug("hotkey-tab-content has selected_row", $("#hotkey-tab-content").has($("#selected_row")).length);
    
    // Check if the selected row is in the holding tank
    if ($("#holding-tank-column").has($("#selected_row")).length) {
      logDebug("Selected row is in holding tank");
      // If in holding tank, remove from holding tank
      if (window.removeFromHoldingTank) {
        removeFromHoldingTank();
      }
    } else if ($("#hotkey-tab-content").has($("#selected_row")).length) {
      logDebug("Selected row is in hotkey tab");
      // If in hotkey tab, remove from hotkey
      if (window.removeFromHotkey) {
        removeFromHotkey();
      }
    } else {
      logDebug("Selected row is in search results");
      // If not in holding tank or hotkey, delete from database
      if (window.deleteSong) {
        deleteSong();
      }
    }
    return false;
  });

  Mousetrap.bind("command+l", function () {
    if ($("#omni_search").is(":visible")) {
      $("#omni_search").trigger("focus");
    } else {
      $("#title-search").trigger("focus");
    }
  });
}

$(document).ready(function () {
  // These functions will be called after modules are loaded
  // scale_scrollable();
  // populateCategorySelect();

  // Module initializations will be handled in the loadModules async function

  // Initialize progress bar to 0% width
  $("#audio_progress").width("0%");

  // Set up event handlers that don't depend on modules
  $("#search_results").on("click", "tbody tr", function (event) {
    toggleSelectedRow(this);
  });

  $("#search_results").on("contextmenu", "tbody tr", function (event) {
    toggleSelectedRow(this);
  });

  $("#search_results").on("dblclick", "tbody tr.song", function (event) {
    if (window.playSelected) {
      playSelected();
    }
  });

  // Keyboard shortcuts will be set up after modules are loaded
  // setupKeyboardShortcuts();

  // Set up hotkey and holding tank tabs

  for (var i = 2; i <= 5; i++) {
    var hotkey_node = $("#hotkeys_list_1").clone();
    hotkey_node.attr("id", `hotkeys_list_${i}`);
    hotkey_node.removeClass("show active");
    $("#hotkey-tab-content").append(hotkey_node);

    var holding_tank_node = $("#holding_tank_1").clone();
    holding_tank_node.attr("id", `holding_tank_${i}`);
    holding_tank_node.removeClass("show active");
    $("#holding-tank-tab-content").append(holding_tank_node);
  }

  $.contextMenu({
    selector: ".context-menu",
    items: {
      play: {
        name: "Play",
        icon: "fas fa-play-circle",
        callback: function (key, opt) {
          playSelected();
        },
      },
      edit: {
        name: "Edit",
        icon: "fas fa-edit",
        callback: function (key, opt) {
          editSelectedSong();
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
          deleteSelectedSong();
        },
      },
    },
  });

  $(".holding_tank").on("click", ".list-group-item", function (event) {
    toggleSelectedRow(this);
  });

  $(".holding_tank").on("dblclick", ".list-group-item", function (event) {
    $(".now_playing").first().removeClass("now_playing");

    // Set the clicked item as selected
    $("#selected_row").removeAttr("id");
    $(this).attr("id", "selected_row");

    if (window.getHoldingTankMode() === "playlist") {
      // In playlist mode, mark this song as now playing and start autoplay
      $(this).addClass("now_playing");
      autoplay = true;
    }

    playSelected();
  });

  // Add single-click selection for hotkeys
  $(".hotkeys").on("click", "li", function (event) {
    // Only select if the hotkey has a song assigned
    if ($(this).attr("songid")) {
      $("#selected_row").removeAttr("id");
      $(this).attr("id", "selected_row");
    }
  });

  $(".hotkeys").on("dblclick", "li", function (event) {
    $(".now_playing").first().removeClass("now_playing");
    $("#selected_row").removeAttr("id");
    if ($(this).find("span").text().length) {
      var song_id = $(this).attr("songid");
      if (song_id) {
        playSongFromId(song_id);
      }
    }
  });



  $("#category_select").on("change", function () {
    var category = $("#category_select").prop("selectedIndex");
    logDebug('Category select changed, calling searchData...');
    if (window.searchData) {
      window.searchData();
      logInfo('searchData called successfully from category change');
    } else {
      logWarn('searchData function not available');
    }
    $("#omni_search").focus();
    $("#category_select").prop("selectedIndex", category);
  });

  $("#date-search").on("change", function () {
    logDebug('Date search changed, calling searchData...');
    if (window.searchData) {
      window.searchData();
      logInfo('searchData called successfully from date search change');
    } else {
      logWarn('searchData function not available');
    }
  });



  $("#search_form :input").on("keydown", function (e) {
    if (e.code == "Enter") {
      // Clear any pending live search using shared state
      const searchTimeout = window.searchTimeout;
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
      logDebug('Search form submitted via Enter key, calling searchData...');
      if (window.searchData) {
        window.searchData();
        logInfo('searchData called successfully');
      } else {
        logWarn('searchData function not available');
      }
      return false;
    }
  });

  // Add explicit submit handler for search form
  $("#search_form").on("submit", function (e) {
    e.preventDefault();
    logDebug('Search form submitted, calling searchData...');
    if (window.searchData) {
      window.searchData();
      logInfo('searchData called successfully');
    } else {
      logWarn('searchData function not available');
    }
    $("#omni_search").focus();
    return false;
  });

  // Live search with debouncing

  // triggerLiveSearch function moved to search module

  // Live search on search term input
  $("#omni_search").on("input", function () {
    logDebug('Omni search input changed, triggering live search...');
    if (window.triggerLiveSearch) {
      window.triggerLiveSearch();
      logInfo('triggerLiveSearch called successfully');
    } else {
      logWarn('triggerLiveSearch function not available');
    }
  });

  // Live search when category filter changes
  $("#category_select").on("change", function () {
    var searchTerm = $("#omni_search").val().trim();
    logDebug('Category select changed, search term', searchTerm);
    if (searchTerm.length >= 2) {
      if (window.triggerLiveSearch) {
        window.triggerLiveSearch();
        logInfo('triggerLiveSearch called successfully from category change');
      } else {
        logWarn('triggerLiveSearch function not available');
      }
    }
  });

  // Live search when advanced search fields change
  $("#title-search, #artist-search, #info-search, #date-search").on(
    "input change",
    function () {
      logDebug('Advanced search field changed');
      // When advanced search is active, trigger live search even if omni_search is empty
      if ($("#advanced-search").is(":visible")) {
        if (window.triggerLiveSearch) {
          window.triggerLiveSearch();
          logInfo('triggerLiveSearch called successfully from advanced search');
        } else {
          logWarn('triggerLiveSearch function not available');
        }
      } else {
        var searchTerm = $("#omni_search").val().trim();
        if (searchTerm.length >= 2) {
          if (window.triggerLiveSearch) {
            window.triggerLiveSearch();
            logInfo('triggerLiveSearch called successfully from advanced search (with term)');
          } else {
            logWarn('triggerLiveSearch function not available');
          }
        }
      }
    }
  );

  $("#omni_search").on("keydown", function (e) {
    if (e.code == "Tab") {
      if ((first_row = $("#search_results tbody tr").first())) {
        $("#selected_row").removeAttr("id");
        first_row.attr("id", "selected_row");
        $("#omni_search").blur();
        return false;
      }
    }
  });

  $("#reset_button").on("click", function () {
    logDebug('Reset button clicked');
    // Clear any pending live search
    const searchTimeout = window.searchTimeout;
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    $("#search_form").trigger("reset");
    $("#omni_search").focus();
    $("#search_results tbody").find("tr").remove();
    $("#search_results thead").hide();
    logInfo('Search results cleared');
    return false;
  });

  $("#advanced_search_button").on("click", function () {
    logDebug("Advanced search button clicked");
    if (window.toggleAdvancedSearch) {
      window.toggleAdvancedSearch();
      logInfo('toggleAdvancedSearch called successfully');
    } else {
      logWarn('toggleAdvancedSearch function not available');
    }
    return false;
  });

  $("#pause_button").click(function (e) {
    logDebug('Pause button clicked');
    logDebug('window.pausePlaying function', typeof window.pausePlaying);
    if (window.pausePlaying) {
      if (e.shiftKey) {
        window.pausePlaying(true);
      } else {
        window.pausePlaying();
      }
    } else {
      logError('pausePlaying function not available');
    }
  });

  $("#play_button").click(function (e) {
    logDebug('Play button clicked');
    logDebug('window.pausePlaying function', typeof window.pausePlaying);
    logDebug('window.playSelected function', typeof window.playSelected);
    if (window.pausePlaying && window.playSelected) {
      // Check if there's already a sound loaded and paused
      import('./renderer/modules/shared-state.js').then(sharedStateModule => {
        const sharedState = sharedStateModule.default;
        const sound = sharedState.get('sound');
        
        if (sound && sound.state() === 'loaded' && !sound.playing()) {
          // Sound is loaded but not playing - resume it
          logDebug('Resuming paused sound');
          window.pausePlaying();
        } else {
          // No sound or sound is playing - play selected song
          logDebug('Playing selected song');
          window.playSelected();
        }
      }).catch(error => {
        logError('Failed to import shared state', error);
        // Fallback to playSelected
        window.playSelected();
      });
    } else {
      logError('Required functions not available');
    }
  });

  $("#stop_button").click(function (e) {
    logDebug('Stop button clicked');
    logDebug('window.stopPlaying function', typeof window.stopPlaying);
    if (window.stopPlaying) {
      if (e.shiftKey) {
        window.stopPlaying(true);
      } else {
        window.stopPlaying();
      }
    } else {
      logError('stopPlaying function not available');
    }
  });

  $("#progress_bar").click(function (e) {
    logDebug('Progress bar clicked');
    var percent = (e.clientX - $(this).offset().left) / $(this).width();
    logDebug('Progress bar click - percent', percent);
    
    // Get sound from shared state
    if (window.electronAPI && window.electronAPI.store) {
      import('./renderer/modules/shared-state.js').then(sharedStateModule => {
        const sharedState = sharedStateModule.default;
        const sound = sharedState.get('sound');
        if (sound) {
          logDebug('Seeking to position in sound');
          sound.seek(sound.duration() * percent);
        } else {
          logDebug('No sound object found in shared state');
        }
      }).catch(error => {
        logError('Failed to import shared state', error);
      });
    }
  });

  $("#waveform").click(function (e) {
    logDebug('Waveform clicked');
    var percent = (e.clientX - $(this).offset().left) / $(this).width();
    logDebug('Waveform click - percent', percent);
    
    // Get sound from shared state
    if (window.electronAPI && window.electronAPI.store) {
      import('./renderer/modules/shared-state.js').then(sharedStateModule => {
        const sharedState = sharedStateModule.default;
        const sound = sharedState.get('sound');
        if (sound) {
          logDebug('Seeking to position in sound');
          sound.seek(sound.duration() * percent);
        } else {
          logDebug('No sound object found in shared state');
        }
      }).catch(error => {
        logError('Failed to import shared state', error);
      });
    }
  });

  $("#volume").on("change", function () {
    logDebug('Volume changed');
    var volume = $(this).val() / 100;
    logDebug('New volume', volume);
    
    // Get sound from shared state
    if (window.electronAPI && window.electronAPI.store) {
      // Import shared state to get sound object
      import('./renderer/modules/shared-state.js').then(sharedStateModule => {
        const sharedState = sharedStateModule.default;
        const sound = sharedState.get('sound');
        if (sound) {
          logDebug('Setting volume on sound object');
          sound.volume(volume);
        } else {
          logDebug('No sound object found in shared state');
        }
      }).catch(error => {
        logError('Failed to import shared state', error);
      });
    }
  });

  $("#mute_button").click(function () {
    logDebug('Mute button clicked');
    
    // Get sound from shared state
    if (window.electronAPI && window.electronAPI.store) {
      import('./renderer/modules/shared-state.js').then(sharedStateModule => {
        const sharedState = sharedStateModule.default;
        const sound = sharedState.get('sound');
        if (sound) {
          logDebug('Toggling mute on sound object');
          sound.mute(!sound.mute());
          sound.volume($("#volume").val() / 100);
        } else {
          logDebug('No sound object found in shared state');
        }
      }).catch(error => {
        logError('Failed to import shared state', error);
      });
    }
    
    // Toggle UI state
    $("#mute_button").toggleClass("active");
    $("#song_now_playing").toggleClass("text-secondary");
  });

  $("#loop_button").click(function () {
    logDebug('Loop button clicked');
    logDebug('window.loop_on function', typeof window.loop_on);
    
    if (window.loop_on) {
      // Get current loop state from shared state
      if (window.electronAPI && window.electronAPI.store) {
        import('./renderer/modules/shared-state.js').then(sharedStateModule => {
          const sharedState = sharedStateModule.default;
          const currentLoop = sharedState.get('loop');
          const newLoop = !currentLoop;
          
          logDebug('Toggling loop state', { currentLoop, newLoop });
          sharedState.set('loop', newLoop);
          window.loop_on(newLoop);
        }).catch(error => {
          logError('Failed to import shared state', error);
          // Fallback to simple toggle
          const loopButton = $("#loop_button");
          const isActive = loopButton.hasClass("active");
          window.loop_on(!isActive);
        });
      } else {
        // Fallback to simple toggle
        const loopButton = $("#loop_button");
        const isActive = loopButton.hasClass("active");
        window.loop_on(!isActive);
      }
    } else {
      logError('loop_on function not available');
    }
  });

  $("#waveform_button").on("click", function () {
    toggleWaveform();
  });

  $(".modal").on("show.bs.modal", function () {
    $(".modal").modal("hide");
  });

  $("#hotkey_tabs").on("dblclick", ".nav-link", function () {
    renameHotkeyTab();
  });

  $("#holding_tank_tabs").on("dblclick", ".nav-link", function () {
    renameHoldingTankTab();
  });

  $("#search_results thead").hide();

  $("#songFormModal").on("hidden.bs.modal", function (e) {
    $("#song-form-category").val("");
    $("#song-form-title").val("");
    $("#song-form-new-category").val("");
    $("#song-form-artist").val("");
    $("#song-form-info").val("");
    $("#song-form-duration").val("");
    $("#SongFormNewCategory").hide();
  });

  $("#songFormModal").on("shown.bs.modal", function (e) {
    console.log($("#song-form-title").val().length);
    if (!$("#song-form-title").val().length) {
      $("#song-form-title").focus();
    } else {
      $("#song-form-info").focus();
    }
  });

  $("#preferencesModal").on("shown.bs.modal", function (e) {
    // Load preferences using new store API
    Promise.all([
      window.electronAPI.store.get("database_directory"),
      window.electronAPI.store.get("music_directory"),
      window.electronAPI.store.get("hotkey_directory"),
      window.electronAPI.store.get("fade_out_seconds"),
      window.electronAPI.store.get("debug_log_enabled")
    ]).then(([dbDir, musicDir, hotkeyDir, fadeSeconds, debugLog]) => {
      if (dbDir.success) $("#preferences-database-directory").val(dbDir.value);
      if (musicDir.success) $("#preferences-song-directory").val(musicDir.value);
      if (hotkeyDir.success) $("#preferences-hotkey-directory").val(hotkeyDir.value);
      if (fadeSeconds.success) $("#preferences-fadeout-seconds").val(fadeSeconds.value);
      if (debugLog.success) $("#preferences-debug-log-enabled").prop("checked", debugLog.value);
    }).catch(error => {
      logWarn('Failed to load preferences', error);
      // Fallback to legacy store access
      $("#preferences-database-directory").val(store.get("database_directory"));
      $("#preferences-song-directory").val(store.get("music_directory"));
      $("#preferences-hotkey-directory").val(store.get("hotkey_directory"));
      $("#preferences-fadeout-seconds").val(store.get("fade_out_seconds"));
      $("#preferences-debug-log-enabled").prop("checked", store.get("debug_log_enabled") || false);
    });
  });

  $(window).on("resize", function () {
    if (window.scaleScrollable) {
      window.scaleScrollable();
    }
  });

  // Is there only one song in the db? Pop the first-run modal

  // Use new database API for song count
  if (window.electronAPI && window.electronAPI.database) {
    window.electronAPI.database.query("SELECT count(*) as count from mrvoice WHERE 1").then(result => {
      if (result.success && result.data.length > 0) {
        if (result.data[0].count <= 1) {
          $(`#firstRunModal`).modal("show");
        }
      } else {
        logWarn('Failed to get song count', result.error);
        // Fallback to legacy database access
        if (typeof db !== 'undefined') {
          var stmt = db.prepare("SELECT count(*) as count from mrvoice WHERE 1");
          var query = stmt.get();
          if (query.count <= 1) {
            $(`#firstRunModal`).modal("show");
          }
        }
      }
    }).catch(error => {
      logWarn('Database API error', error);
      // Fallback to legacy database access
      if (typeof db !== 'undefined') {
        var stmt = db.prepare("SELECT count(*) as count from mrvoice WHERE 1");
        var query = stmt.get();
        if (query.count <= 1) {
          $(`#firstRunModal`).modal("show");
        }
      }
    });
  } else {
    // Fallback to legacy database access
    if (typeof db !== 'undefined') {
      var stmt = db.prepare("SELECT count(*) as count from mrvoice WHERE 1");
      var query = stmt.get();
      if (query.count <= 1) {
        $(`#firstRunModal`).modal("show");
      }
    }
  }

  $("#song-form-category")
    .change(function () {
      $(this)
        .find("option:selected")
        .each(function () {
          var optionValue = $(this).attr("value");
          if (optionValue == "--NEW--") {
            $("#SongFormNewCategory").show();
            $("#song-form-new-category").attr("required", "required");
          } else {
            $("#SongFormNewCategory").hide();
            $("#song-form-new-category").removeAttr("required");
          }
        });
    })
    .change();



  // Handle focus restoration for confirmation modal
  $("#confirmationModal").on("hidden.bs.modal", function (e) {
    restoreFocusToSearch();
  });
});

// Test Functions Module - Functions extracted to src/renderer/modules/test-utils/
// testPhase2Migrations(), testDatabaseAPI(), testFileSystemAPI(), testStoreAPI(), testAudioAPI(), testSecurityFeatures() - All moved to test-utils module

