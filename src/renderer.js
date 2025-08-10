// Remove legacy global variables and use shared state instead
// Legacy globals moved to shared state module

// Import debug logger for centralized logging
import initializeDebugLogger from './renderer/modules/debug-log/debug-logger.js';

// Global instances - now managed by app-initialization module  
let debugLogger = null;
let sharedStateInstance = null;
let sharedStateInitialized = false;

// Initialize debug logger early with basic configuration
debugLogger = initializeDebugLogger({
  electronAPI: window.electronAPI,
  db: window.db,
  store: window.store
});

// Set up logging functions using the debug logger (assuming always available)
window.logInfo = async (message, context) => {
  await debugLogger.info(message, context);
};

window.logDebug = async (message, context) => {
  await debugLogger.debug(message, context);
};

window.logWarn = async (message, context) => {
  await debugLogger.warn(message, context);
};

window.logError = async (message, context) => {
  await debugLogger.error(message, context);
};

// Module registry to avoid window pollution
const moduleRegistry = {};

// Import function coordination module for centralized function management
import FunctionCoordination from './renderer/modules/function-coordination/index.js';

// Import keyboard manager for centralized keyboard shortcut management
import KeyboardManager from './renderer/modules/keyboard-manager/index.js';

// Function coordination instance - initialized after debug logger is available
let functionCoordination = null;

// Global keyboard manager instance
let keyboardManager = null;

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
    window.logInfo('🔧 Starting module loading...');
    
    // Initialize the application using the app-initialization module
    window.logInfo('🚀 Initializing application components...');
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
    sharedStateInstance = AppInitialization.getSharedState();
    sharedStateInitialized = AppInitialization.isInitialized();
    
    // Debug logger already initialized early, no need to reinitialize
    
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
      
      // Bridge secure IPC events to renderer functions under context isolation
      try {
        if (window.secureElectronAPI && window.secureElectronAPI.events) {
          // Holding tank load → populateHoldingTank
          if (typeof window.secureElectronAPI.events.onHoldingTankLoad === 'function') {
            window.secureElectronAPI.events.onHoldingTankLoad((songIds) => {
              if (typeof window.populateHoldingTank === 'function') {
                window.populateHoldingTank(songIds);
              } else {
                window.logWarn('populateHoldingTank not yet available when holding_tank_load fired');
              }
            });
          }

          // Hotkey load → populateHotkeys
          if (typeof window.secureElectronAPI.events.onFkeyLoad === 'function') {
            window.secureElectronAPI.events.onFkeyLoad((fkeys, title) => {
              if (typeof window.populateHotkeys === 'function') {
                window.populateHotkeys(fkeys, title);
              } else {
                window.logWarn('populateHotkeys not yet available when fkey_load fired');
              }
            });
          }

          // Manage categories → openCategoriesModal
          if (typeof window.secureElectronAPI.events.onManageCategories === 'function') {
            window.secureElectronAPI.events.onManageCategories(() => {
              if (typeof window.openCategoriesModal === 'function') {
                window.openCategoriesModal();
              } else {
                window.logWarn('openCategoriesModal not yet available when manage_categories fired');
              }
            });
          }
          
          // Preferences → openPreferencesModal (if available)
          if (typeof window.secureElectronAPI.events.onShowPreferences === 'function') {
            window.secureElectronAPI.events.onShowPreferences(() => {
              if (typeof window.openPreferencesModal === 'function') {
                window.openPreferencesModal();
              } else {
                window.logWarn('openPreferencesModal not yet available when show_preferences fired');
              }
            });
          }

          // Edit selected song → editSelectedSong
          if (typeof window.secureElectronAPI.events.onEditSelectedSong === 'function') {
            window.secureElectronAPI.events.onEditSelectedSong(() => {
              if (typeof window.editSelectedSong === 'function') {
                window.editSelectedSong();
              } else if (window.moduleRegistry?.ui?.editSelectedSong) {
                window.moduleRegistry.ui.editSelectedSong();
              } else if (window.moduleRegistry?.songManagement?.editSelectedSong) {
                window.moduleRegistry.songManagement.editSelectedSong();
              } else {
                window.logWarn('editSelectedSong not available when edit_selected_song fired');
              }
            });
          }

          // Delete selected song → deleteSelectedSong
          if (typeof window.secureElectronAPI.events.onDeleteSelectedSong === 'function') {
            window.secureElectronAPI.events.onDeleteSelectedSong(() => {
              if (typeof window.deleteSelectedSong === 'function') {
                window.deleteSelectedSong();
              } else if (window.moduleRegistry?.ui?.deleteSelectedSong) {
                window.moduleRegistry.ui.deleteSelectedSong();
              } else if (window.moduleRegistry?.songManagement?.deleteSelectedSong) {
                window.moduleRegistry.songManagement.deleteSelectedSong();
              } else {
                window.logWarn('deleteSelectedSong not available when delete_selected_song fired');
              }
            });
          }

          // Font size events → UI controls
          if (typeof window.secureElectronAPI.events.onIncreaseFontSize === 'function') {
            window.secureElectronAPI.events.onIncreaseFontSize(() => {
              if (typeof window.increaseFontSize === 'function') {
                window.increaseFontSize();
              } else if (window.moduleRegistry?.ui?.increaseFontSize) {
                window.moduleRegistry.ui.increaseFontSize();
              } else {
                window.logWarn('increaseFontSize not available when increase_font_size fired');
              }
            });
          }
          if (typeof window.secureElectronAPI.events.onDecreaseFontSize === 'function') {
            window.secureElectronAPI.events.onDecreaseFontSize(() => {
              if (typeof window.decreaseFontSize === 'function') {
                window.decreaseFontSize();
              } else if (window.moduleRegistry?.ui?.decreaseFontSize) {
                window.moduleRegistry.ui.decreaseFontSize();
              } else {
                window.logWarn('decreaseFontSize not available when decrease_font_size fired');
              }
            });
          }
        }
      } catch (bridgeError) {
        window.logWarn('Failed setting up secure API event bridges', { error: bridgeError?.message });
      }

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

    // Set up keyboard shortcuts using the keyboard manager module
    try {
      window.logInfo('Initializing keyboard manager...');
      keyboardManager = new KeyboardManager({
        debugLog: window.debugLog || debugLogger,
        electronAPI: window.electronAPI,
        db: window.db,
        store: window.store
      });
      
      // Initialize and set up keyboard shortcuts
      const keyboardSuccess = await keyboardManager.setupKeyboardShortcuts();
      
      if (keyboardSuccess) {
        window.logInfo('Keyboard shortcuts set up successfully!');
        
        // Get keyboard manager statistics
        const keyboardStats = keyboardManager.getComprehensiveStats();
        window.logInfo('Keyboard Manager Statistics', keyboardStats);
        
        // Perform health check
        const keyboardHealth = keyboardManager.performHealthCheck();
        window.logInfo('Keyboard Manager Health Check', keyboardHealth);
      } else {
        window.logError('Failed to set up keyboard shortcuts, but continuing...');
      }
      
      // Make keyboard manager available for debugging
      window.keyboardManager = keyboardManager;
      
    } catch (error) {
      window.logError('Error setting up keyboard shortcuts', error);
    }
  } catch (error) {
    window.logError('Error loading modules', error);
    window.logError('Error stack', error.stack);
    window.logError('Error message', error.message);
  }
})();

// Legacy functions moved to respective modules (preferences, search, database, audio, etc.)





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

// Keyboard shortcuts now handled by the keyboard-manager module
// This function is kept for backward compatibility but now uses the KeyboardManager

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

