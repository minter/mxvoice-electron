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
    
    // Module loading is now handled by the bootstrap module above
    // All modules are loaded and available in moduleRegistry





    // Set up critical function wrapper for backward compatibility with HTML
    // The deleteCategory function is called from HTML, so we need to ensure it's available
    window.deleteCategory = function(event, code, description) {
      if (moduleRegistry.categories && moduleRegistry.categories.deleteCategoryUI) {
        return moduleRegistry.categories.deleteCategoryUI(event, code, description);
      } else {
        logError('Categories module not available');
        alert('Category deletion requires the categories module to be loaded. Please try again.');
      }
    };

    logInfo('All modules loaded successfully via bootstrap!');
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
    
    // Ensure window.debugLog is available for FunctionMonitor
    if (moduleRegistry.debugLog && !window.debugLog) {
      window.debugLog = moduleRegistry.debugLog;
      logInfo('Global debugLog made available');
    }
    
    // Initialize dependent classes with the debug logger
    if (!functionRegistry) {
      functionRegistry = new FunctionRegistry(window.debugLog || debugLogger);
      eventManager = new EventManager(functionRegistry, window.debugLog || debugLogger);
      functionMonitor = new FunctionMonitor(functionRegistry, window.debugLog || debugLogger);
      logInfo('Dependent classes initialized with debug logger');
    }
    
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

// Import event coordination module for centralized event handling
import EventCoordination from './renderer/modules/event-coordination/index.js';

// Global event coordination instance
let eventCoordination = null;

$(document).ready(async function () {
  try {
    logInfo('DOM ready, initializing event coordination...');
    
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
    logInfo('Event coordination initialized successfully');

    // Attach all event handlers - this replaces all the jQuery event handling code
    await eventCoordination.attachEventHandlers();
    logInfo('All event handlers attached via event coordination module');

    // Make event coordination available globally for debugging
    window.eventCoordination = eventCoordination;

  } catch (error) {
    logError('Error initializing event coordination:', error);
    logError('Falling back to basic initialization');
    
    // Minimal fallback initialization if event coordination fails
    $("#audio_progress").width("0%");
    $("#search_results thead").hide();
  }
});

// Test Functions Module - Functions extracted to src/renderer/modules/test-utils/
// testPhase2Migrations(), testDatabaseAPI(), testFileSystemAPI(), testStoreAPI(), testAudioAPI(), testSecurityFeatures() - All moved to test-utils module

