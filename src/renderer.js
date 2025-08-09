// Remove legacy global variables and use shared state instead
// Legacy globals moved to shared state module

// Import debug logger for centralized logging
import initializeDebugLogger from './renderer/modules/debug-log/debug-logger.js';

// Global instances - now managed by app-initialization module  
let debugLogger = null;
let sharedStateInstance = null;
let sharedStateInitialized = false;

// Set up immediate fallback logging functions to prevent "not a function" errors
// These will be replaced by proper logging functions after app-initialization completes
window.logInfo = window.logInfo || function(message, context) {
  console.log(`ℹ️ ${message}`, context || '');
};
window.logDebug = window.logDebug || function(message, context) {
  console.log(`🐛 ${message}`, context || '');
};
window.logWarn = window.logWarn || function(message, context) {
  console.warn(`⚠️ ${message}`, context || '');
};
window.logError = window.logError || function(message, context) {
  console.error(`❌ ${message}`, context || '');
};

// Module registry to avoid window pollution
const moduleRegistry = {};

// Import function coordination module for centralized function management
import FunctionCoordination from './renderer/modules/function-coordination/index.js';

// Function coordination instance - initialized after debug logger is available
let functionCoordination = null;

// Data loading and initialization now handled by app-initialization module

// File Operations Module - Functions extracted to src/renderer/modules/file-operations/
// openHotkeyFile(), openHoldingTankFile(), saveHotkeyFile(), saveHoldingTankFile()
// pickDirectory(), installUpdate() - All moved to file-operations module

// Import bootstrap module for module loading
import AppBootstrap from './renderer/modules/app-bootstrap/index.js';

// Import app initialization module for centralized initialization
import AppInitialization from './renderer/modules/app-initialization/index.js';

// Load modules dynamically and make functions globally available
(async function loadModules() {
  try {
    console.log('🔧 Starting module loading...');
    
    // Initialize the application using the app-initialization module
    console.log('🚀 Initializing application components...');
    const initSuccess = await AppInitialization.initialize({
      debug: {
        electronAPI: window.electronAPI,
        db: window.db,
        store: window.store
      },
      environment: {
        debugMode: true,
        performanceMonitoring: true
      }
    });
    
    if (!initSuccess) {
      throw new Error('Application initialization failed');
    }
    
    // Get initialized instances for backward compatibility
    debugLogger = AppInitialization.getDebugLogger();
    sharedStateInstance = AppInitialization.getSharedState();
    sharedStateInitialized = AppInitialization.isInitialized();
    
    // Update logging functions to use the debug logger (fallbacks already set above)
    if (debugLogger) {
      window.logInfo = (msg, ctx) => {
        try {
          const result = debugLogger.info(msg, ctx);
          if (result && typeof result.catch === 'function') {
            return result.catch(() => console.log(`ℹ️ ${msg}`, ctx));
          }
          return result;
        } catch (error) {
          console.log(`ℹ️ ${msg}`, ctx);
        }
      };
      window.logDebug = (msg, ctx) => {
        try {
          const result = debugLogger.debug(msg, ctx);
          if (result && typeof result.catch === 'function') {
            return result.catch(() => console.log(`🐛 ${msg}`, ctx));
          }
          return result;
        } catch (error) {
          console.log(`🐛 ${msg}`, ctx);
        }
      };
      window.logWarn = (msg, ctx) => {
        try {
          const result = debugLogger.warn(msg, ctx);
          if (result && typeof result.catch === 'function') {
            return result.catch(() => console.warn(`⚠️ ${msg}`, ctx));
          }
          return result;
        } catch (error) {
          console.warn(`⚠️ ${msg}`, ctx);
        }
      };
      window.logError = (msg, ctx) => {
        try {
          const result = debugLogger.error(msg, ctx);
          if (result && typeof result.catch === 'function') {
            return result.catch(() => console.error(`❌ ${msg}`, ctx));
          }
          return result;
        } catch (error) {
          console.error(`❌ ${msg}`, ctx);
        }
      };
    }
    
    window.logInfo('Application initialization completed, proceeding with module loading...');
    
    // Load basic modules using the bootstrap module
    window.logInfo('Loading modules using bootstrap configuration...');
    await AppBootstrap.loadBasicModules(
      AppBootstrap.moduleConfig, 
      moduleRegistry, 
      window.logInfo, 
      window.logError, 
      window.logWarn,
      {
        electronAPI: window.electronAPI,
        db: window.db,
        store: window.store,
        debugLog: window.debugLog
      }
    );
    window.logInfo('Basic module loading completed');
    
    // Module loading is now handled by the bootstrap module above
    // All modules are loaded and available in moduleRegistry





    // Set up critical function wrapper for backward compatibility with HTML
    // The deleteCategory function is called from HTML, so we need to ensure it's available
    window.deleteCategory = function(event, code, description) {
      if (moduleRegistry.categories && moduleRegistry.categories.deleteCategoryUI) {
        return moduleRegistry.categories.deleteCategoryUI(event, code, description);
      } else {
        window.logError('Categories module not available');
        alert('Category deletion requires the categories module to be loaded. Please try again.');
      }
    };

    window.logInfo('All modules loaded successfully via bootstrap!');
    window.logInfo('Module Registry Summary:');
    window.logDebug('File Operations', !!moduleRegistry.fileOperations);
    window.logDebug('Song Management', !!moduleRegistry.songManagement);
    window.logDebug('Holding Tank', !!moduleRegistry.holdingTank);
    window.logDebug('Hotkeys', !!moduleRegistry.hotkeys);
    window.logDebug('Categories', !!moduleRegistry.categories);
    window.logDebug('Bulk Operations', !!moduleRegistry.bulkOperations);
    window.logDebug('Drag Drop', !!moduleRegistry.dragDrop);
    window.logDebug('Navigation', !!moduleRegistry.navigation);
    window.logDebug('Mode Management', !!moduleRegistry.modeManagement);
    window.logDebug('Test Utils', !!moduleRegistry.testUtils);
    window.logDebug('Search', !!moduleRegistry.search);
    window.logDebug('Audio', !!moduleRegistry.audio);
    window.logDebug('UI', !!moduleRegistry.ui);
    window.logDebug('Preferences', !!moduleRegistry.preferences);
    window.logDebug('Database', !!moduleRegistry.database);
    window.logDebug('Utils', !!moduleRegistry.utils);

    // Make module registry available for debugging and development
    window.moduleRegistry = moduleRegistry;
    
    // Ensure window.debugLog is available for modules
    if (moduleRegistry.debugLog && !window.debugLog) {
      window.debugLog = moduleRegistry.debugLog;
      window.logInfo('Global debugLog made available');
    }
    
    // Initialize function coordination system
    window.logInfo('Initializing function coordination system...');
    functionCoordination = new FunctionCoordination({
      debugLog: window.debugLog || debugLogger,
      electronAPI: window.electronAPI,
      db: window.db,
      store: window.store
    });
    
    // Initialize all function coordination components
    const coordinationSuccess = await functionCoordination.initialize(
      window.debugLog || debugLogger, 
      moduleRegistry
    );
    
    if (!coordinationSuccess) {
      window.logError('Function coordination initialization failed, but continuing...');
    } else {
      window.logInfo('Function coordination system initialized successfully');
      
      // Get comprehensive statistics
      const comprehensiveStats = functionCoordination.getComprehensiveStats();
      window.logInfo('Function Coordination Statistics', comprehensiveStats);
      
      // Perform health check
      const healthCheck = functionCoordination.performHealthCheck(moduleRegistry);
      window.logInfo('Function Coordination Health Check', healthCheck);
    }
    
    // Make function coordination available for debugging and access to components
    window.functionCoordination = functionCoordination;
    
    // Maintain backward compatibility by exposing individual components
    if (functionCoordination) {
      const components = functionCoordination.getComponents();
      window.functionRegistry = components.functionRegistry;
      window.eventManager = components.eventManager;
      window.functionMonitor = components.functionMonitor;
    }
    
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
      window.logInfo('All modules initialized successfully!');
    } catch (error) {
      window.logError('Error initializing modules', error);
    }

    // Call functions that depend on loaded modules
    try {
      if (window.scale_scrollable) {
        window.scale_scrollable();
      }
      // Ensure categories are populated after database module is loaded
      if (window.populateCategorySelect) {
        window.logInfo('Attempting to populate categories...');
        await window.populateCategorySelect();
        window.logInfo('Categories populated successfully');
      } else {
        window.logWarn('populateCategorySelect function not available');
      }
      window.logInfo('Module-dependent functions called successfully!');
    } catch (error) {
      window.logError('Error calling module-dependent functions', error);
    }

    // Set up keyboard shortcuts after modules are loaded
    try {
      setupKeyboardShortcuts();
      window.logInfo('Keyboard shortcuts set up successfully!');
    } catch (error) {
      window.logError('Error setting up keyboard shortcuts', error);
    }
  } catch (error) {
    window.logError('Error loading modules', error);
    window.logError('Error stack', error.stack);
    window.logError('Error message', error.message);
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
    window.logDebug("Delete key pressed");
    window.logDebug("selected_row", $("#selected_row"));
    window.logDebug("holding-tank-column has selected_row", $("#holding-tank-column").has($("#selected_row")).length);
    window.logDebug("hotkey-tab-content has selected_row", $("#hotkey-tab-content").has($("#selected_row")).length);
    
    // Check if the selected row is in the holding tank
    if ($("#holding-tank-column").has($("#selected_row")).length) {
      window.logDebug("Selected row is in holding tank");
      // If in holding tank, remove from holding tank
      if (window.removeFromHoldingTank) {
        removeFromHoldingTank();
      }
    } else if ($("#hotkey-tab-content").has($("#selected_row")).length) {
      window.logDebug("Selected row is in hotkey tab");
      // If in hotkey tab, remove from hotkey
      if (window.removeFromHotkey) {
        removeFromHotkey();
      }
    } else {
      window.logDebug("Selected row is in search results");
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

// Import event coordination module for centralized event handling
import EventCoordination from './renderer/modules/event-coordination/index.js';

// Global event coordination instance
let eventCoordination = null;

$(document).ready(async function () {
  try {
    // Initialize DOM-dependent features from app-initialization module
    if (AppInitialization.isInitialized()) {
      await AppInitialization.initializeDOMDependentFeatures();
    }
    
    window.logInfo('DOM ready, initializing event coordination...');
    
    // Initialize event coordination module
    eventCoordination = new EventCoordination({
      electronAPI: window.electronAPI,
      db: window.db,
      store: window.store,
      debugLog: debugLogger,
      moduleRegistry: moduleRegistry
    });

    // Initialize the event coordination system
    await eventCoordination.initialize();
    window.logInfo('Event coordination initialized successfully');

    // Attach all event handlers - this replaces all the jQuery event handling code
    await eventCoordination.attachEventHandlers();
    window.logInfo('All event handlers attached via event coordination module');

    // Make event coordination available globally for debugging
    window.eventCoordination = eventCoordination;

  } catch (error) {
    window.logError('Error initializing event coordination:', error);
    window.logError('Falling back to basic initialization');
    
    // Minimal fallback initialization if event coordination fails
    $("#audio_progress").width("0%");
    $("#search_results thead").hide();
  }
});

// Test Functions Module - Functions extracted to src/renderer/modules/test-utils/
// testPhase2Migrations(), testDatabaseAPI(), testFileSystemAPI(), testStoreAPI(), testAudioAPI(), testSecurityFeatures() - All moved to test-utils module

