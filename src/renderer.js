// Set window title based on platform (macOS HIG compliance)
// On macOS, window title should be empty; on other platforms, use default from HTML
async function setWindowTitle() {
  try {
    const platformResponse = await window.secureElectronAPI.os.platform();
    
    // Handle the IPC response format: { success: true, data: 'darwin' }
    const platform = platformResponse?.data || platformResponse;
    
    if (platform === 'darwin') {
      // macOS: use zero-width space character (completely invisible)
      document.title = '\u200B'; // Zero-width space
    }
    // For other platforms, leave the default title from HTML file
  } catch (error) {
    // If platform detection fails, leave the default title from HTML file
  }
}

// Set title immediately when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setWindowTitle);
} else {
  setWindowTitle();
}

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

// Load and display current profile
(async function loadProfileIndicator() {
  try {
    const result = await window.secureElectronAPI.profile.getCurrent();
    if (result.success) {
      const profileNameElement = document.getElementById('profile-name');
      if (profileNameElement) {
        profileNameElement.textContent = result.profile;
      }
      
    }
  } catch (error) {
    // Use debugLog if available, fallback to console for early initialization
    if (window.debugLog) {
      window.debugLog.error('Failed to load profile', { error: error.message });
    } else {
      console.error('Failed to load profile:', error);
    }
  }
})();

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
    
    // Hotkeys module will be initialized via EventCoordination system
    // No manual initialization needed
    
    // Initialize theme management with preferences module dependency
    window.logInfo('Initializing theme management...');
    await AppBootstrap.initializeThemeManagement(
      moduleRegistry,
      window.logInfo,
      window.logError
    );
    
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
    window.logDebug('Theme Management', !!moduleRegistry.themeManagement);
    window.logDebug('Test Utils', !!moduleRegistry.testUtils);
    window.logDebug('Search', !!moduleRegistry.search);
    window.logDebug('Audio', !!moduleRegistry.audio);
    window.logDebug('UI', !!moduleRegistry.ui);
    window.logDebug('Preferences', !!moduleRegistry.preferences);
    window.logDebug('Database', !!moduleRegistry.database);
    window.logDebug('Utils', !!moduleRegistry.utils);

    // Make module registry available for debugging and development
    window.moduleRegistry = moduleRegistry;
    
    // Make holding tank module available for keyboard shortcuts
    if (moduleRegistry.holdingTank) {
      window.holdingTank = moduleRegistry.holdingTank;
      window.logInfo('Holding tank module made available on window object');
    }
    
    // Make hotkeys module available
    if (moduleRegistry.hotkeys) {
      window.hotkeysModule = moduleRegistry.hotkeys;
      window.logInfo('Hotkeys module made available on window object');
    }
    
    // Ensure window.debugLog is available for modules
    if (moduleRegistry.debugLog && !window.debugLog) {
      window.debugLog = moduleRegistry.debugLog;
      window.logInfo('Global debugLog made available');
    }
    
    // Initialize profile state persistence
    if (moduleRegistry.profileState) {
      window.logInfo('🔄 Initializing profile state persistence...');
      moduleRegistry.profileState.initializeProfileState({
        hotkeysModule: moduleRegistry.hotkeys,
        holdingTankModule: moduleRegistry.holdingTank
      });
      
      // Load saved profile state (hotkeys + holding tank)
      window.logInfo('📂 Loading profile state...');
      const loadResult = await moduleRegistry.profileState.loadProfileState({
        hotkeysModule: moduleRegistry.hotkeys,
        holdingTankModule: moduleRegistry.holdingTank
      });
      
      if (loadResult.loaded) {
        window.logInfo('✅ Profile state restored successfully');
      } else {
        window.logInfo('ℹ️ No previous state found, starting fresh');
      }
      
      // Set up profile event listeners
      const apiToUse = window.secureElectronAPI || window.electronAPI;
      
      // Profile switch event listener
      if (apiToUse && apiToUse.events && apiToUse.events.onSwitchProfile) {
        window.logInfo('🔀 Setting up profile switch event listener...');
        apiToUse.events.onSwitchProfile(async () => {
          window.logInfo('🔀 Profile switch requested from menu');
          if (moduleRegistry.profileState && moduleRegistry.profileState.switchProfileWithSave) {
            await moduleRegistry.profileState.switchProfileWithSave();
          } else {
            window.logError('Profile state module not available for switch');
          }
        });
      } else if (apiToUse && apiToUse.onSwitchProfile) {
        // Fallback to legacy namespace
        window.logInfo('🔀 Setting up profile switch event listener (legacy)...');
        apiToUse.onSwitchProfile(async () => {
          window.logInfo('🔀 Profile switch requested from menu');
          if (moduleRegistry.profileState && moduleRegistry.profileState.switchProfileWithSave) {
            await moduleRegistry.profileState.switchProfileWithSave();
          } else {
            window.logError('Profile state module not available for switch');
          }
        });
      }
      
      // Logout event listener
      if (apiToUse && apiToUse.events && apiToUse.events.onLogout) {
        window.logInfo('🚪 Setting up logout event listener...');
        apiToUse.events.onLogout(async () => {
          window.logInfo('🚪 Logout requested from menu');
          try {
            const result = await window.secureElectronAPI.profile.switchToProfile('Default User');
            if (!result.success) {
              window.logError('Failed to logout (switch to Default Profile):', result.error);
              alert(`Failed to logout: ${result.error}`);
            }
          } catch (error) {
            window.logError('Error logging out:', error);
            alert(`Error logging out: ${error.message}`);
          }
        });
      }
      
      // New profile event listener
      if (apiToUse && apiToUse.events && apiToUse.events.onNewProfile) {
        window.logInfo('🆕 Setting up new profile event listener...');
        apiToUse.events.onNewProfile(async () => {
          window.logInfo('🆕 New profile requested from menu');
          showNewProfileModal();
        });
      }
      
      // Duplicate profile event listener
      if (apiToUse && apiToUse.events && apiToUse.events.onDuplicateProfile) {
        window.logInfo('📋 Setting up duplicate profile event listener...');
        apiToUse.events.onDuplicateProfile(async () => {
          window.logInfo('📋 Duplicate profile requested from menu');
          showDuplicateProfileModal();
        });
      }
      
      // Delete current profile event listener
      if (apiToUse && apiToUse.events && apiToUse.events.onDeleteCurrentProfile) {
        window.logInfo('🗑️ Setting up delete current profile event listener...');
        apiToUse.events.onDeleteCurrentProfile(async () => {
          window.logInfo('🗑️ Delete current profile requested from menu');
          try {
            const currentProfile = await window.secureElectronAPI.profile.getCurrent();
            if (currentProfile.success) {
              const confirmed = confirm(`Are you sure you want to delete the profile "${currentProfile.profile}"?\n\nThis will remove all preferences and data for this profile.`);
              if (confirmed) {
                const result = await window.secureElectronAPI.profile.deleteProfile(currentProfile.profile);
                if (result.success) {
                  // Profile deleted, switch to launcher to select a different profile
                  if (moduleRegistry.profileState && moduleRegistry.profileState.switchProfileWithSave) {
                    await moduleRegistry.profileState.switchProfileWithSave();
                  }
                } else {
                  alert(`Failed to delete profile: ${result.error}`);
                }
              }
            } else {
              alert('Could not determine current profile');
            }
          } catch (error) {
            window.logError('Error deleting current profile', { error: error.message });
            alert(`Error deleting profile: ${error.message}`);
          }
        });
      }
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
    const coordinationSuccess = await functionCoordination.init({
      debugLogger: window.debugLog || debugLogger, 
      moduleRegistry: moduleRegistry
    });
    
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

          // Add file dialog → startAddNewSong
          if (typeof window.secureElectronAPI.events.onAddDialogLoad === 'function') {
            window.secureElectronAPI.events.onAddDialogLoad((filename, metadata) => {
              if (typeof window.startAddNewSong === 'function') {
                window.startAddNewSong(filename, metadata);
              } else if (window.moduleRegistry?.songManagement?.startAddNewSong) {
                window.moduleRegistry.songManagement.startAddNewSong(filename, metadata);
              } else {
                window.logWarn('startAddNewSong not available when add_dialog_load fired');
              }
            });
          }

          // Bulk add dialog → showBulkAddModal
          if (typeof window.secureElectronAPI.events.onBulkAddDialogLoad === 'function') {
            window.secureElectronAPI.events.onBulkAddDialogLoad((dirname) => {
              if (typeof window.showBulkAddModal === 'function') {
                window.showBulkAddModal(dirname);
              } else if (window.moduleRegistry?.bulkOperations?.showBulkAddModal) {
                window.moduleRegistry.bulkOperations.showBulkAddModal(dirname);
              } else {
                window.logWarn('showBulkAddModal not available when bulk_add_dialog_load fired');
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

          // UI toggles
          if (typeof window.secureElectronAPI.events.onToggleWaveform === 'function') {
            window.secureElectronAPI.events.onToggleWaveform(() => {
              if (typeof window.toggleWaveform === 'function') {
                window.toggleWaveform();
              } else if (window.moduleRegistry?.ui?.toggleWaveform) {
                window.moduleRegistry.ui.toggleWaveform();
              } else {
                window.logWarn('toggleWaveform not available when toggle_wave_form fired');
              }
            });
          }
          if (typeof window.secureElectronAPI.events.onToggleAdvancedSearch === 'function') {
            window.secureElectronAPI.events.onToggleAdvancedSearch(() => {
              if (typeof window.toggleAdvancedSearch === 'function') {
                window.toggleAdvancedSearch();
              } else if (window.moduleRegistry?.ui?.toggleAdvancedSearch) {
                window.moduleRegistry.ui.toggleAdvancedSearch();
              } else {
                window.logWarn('toggleAdvancedSearch not available when toggle_advanced_search fired');
              }
            });
          }

          // Close all tabs → UI manager closeAllTabs (Start A New Session)
          if (typeof window.secureElectronAPI.events.onCloseAllTabs === 'function') {
            window.secureElectronAPI.events.onCloseAllTabs(() => {
              if (typeof window.closeAllTabs === 'function') {
                window.closeAllTabs();
              } else if (window.moduleRegistry?.ui?.closeAllTabs) {
                window.moduleRegistry.ui.closeAllTabs();
              } else {
                window.logWarn('closeAllTabs not available when close_all_tabs fired');
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
      if (moduleRegistry.modeManagement && moduleRegistry.modeManagement.initModeManagement) {
        await moduleRegistry.modeManagement.initModeManagement();
      }
      window.logInfo('All modules initialized successfully!');
    } catch (error) {
      window.logError('Error initializing modules', error);
    }

    // Call functions that depend on loaded modules
    try {
      if (window.scaleScrollable) {
        window.scaleScrollable();
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

document.addEventListener('DOMContentLoaded', async function () {
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
    await eventCoordination.init({
      electronAPI: window.electronAPI,
      db: window.db,
      store: window.store,
      debugLog: debugLogger,
      moduleRegistry: moduleRegistry
    });
    window.logInfo('Event coordination initialized successfully');

    // Attach all event handlers - this replaces all the jQuery event handling code
    await eventCoordination.attachEventHandlers();
    window.logInfo('All event handlers attached via event coordination module');

    // Hotkeys module is now handled by EventCoordination system
    // No manual initialization needed

    // Make event coordination available globally for debugging
    window.eventCoordination = eventCoordination;

    // Provide global aliases for UI scaling (legacy underscore and new camelCase)
    try {
      const uiModule = moduleRegistry.ui;
      const holdingModule = moduleRegistry.holdingTank;
      const scaleFn = (uiModule && uiModule.scaleScrollable) || (holdingModule && holdingModule.scaleScrollable) || null;
      if (!window.scaleScrollable) {
        window.scaleScrollable = scaleFn;
      }
      if (!window.scaleScrollable) {
        window.scaleScrollable = scaleFn;
      }
    } catch {}

  } catch (error) {
    window.logError('Error initializing event coordination:', error);
    window.logError('Falling back to basic initialization');
    
    // Minimal fallback initialization if event coordination fails
    const progress = document.getElementById('audio_progress'); if (progress) progress.style.width = '0%';
    const thead = document.querySelector('#search_results thead'); if (thead) thead.style.display = 'none';
  }
});

// Test Functions Module - Functions extracted to src/renderer/modules/test-utils/
// testPhase2Migrations(), testDatabaseAPI(), testFileSystemAPI(), testStoreAPI(), testAudioAPI(), testSecurityFeatures() - All moved to test-utils module

/**
 * Show the new profile creation modal
 */
function showNewProfileModal() {
  // Clear any previous form data
  document.getElementById('newProfileName').value = '';
  document.getElementById('newProfileDescription').value = '';
  
  // Show the modal
  const modal = new bootstrap.Modal(document.getElementById('newProfileModal'));
  modal.show();
  
  // Focus the name input after modal is shown
  document.getElementById('newProfileModal').addEventListener('shown.bs.modal', function () {
    document.getElementById('newProfileName').focus();
  }, { once: true });
}

/**
 * Handle new profile form submission
 */
async function handleNewProfileSubmit() {
  const nameInput = document.getElementById('newProfileName');
  const descInput = document.getElementById('newProfileDescription');
  
  const name = nameInput.value.trim();
  const description = descInput.value.trim();
  
  // Validate profile name
  if (!name) {
    alert('Profile name is required');
    nameInput.focus();
    return;
  }
  
  // Check for invalid characters (basic validation)
  if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
    alert('Profile name can only contain letters, numbers, spaces, hyphens, and underscores');
    nameInput.focus();
    return;
  }
  
  try {
    // Create the profile
    const result = await window.secureElectronAPI.profile.createProfile(name, description);
    
    if (result.success) {
      // Close the modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('newProfileModal'));
      modal.hide();
      
      // Switch directly to the newly created profile
      try {
        const switchResult = await window.secureElectronAPI.profile.switchToProfile(name);
        if (!switchResult.success) {
          window.logError('Failed to switch to new profile:', switchResult.error);
          // Fallback: just refresh the indicator
          await refreshProfileIndicator();
        }
      } catch (switchError) {
        window.logError('Error switching to new profile:', switchError);
        // Fallback: just refresh the indicator
        await refreshProfileIndicator();
      }
    } else {
      alert(`Failed to create profile: ${result.error}`);
    }
  } catch (error) {
    window.logError('Error creating new profile:', error);
    alert(`Error creating profile: ${error.message}`);
  }
}

/**
 * Show the duplicate profile modal
 */
async function showDuplicateProfileModal() {
  try {
    // Get current profile name
    const currentProfile = await window.secureElectronAPI.profile.getCurrent();
    if (!currentProfile.success) {
      alert('Could not determine current profile');
      return;
    }
    
    // Store the current profile name for use in duplication
    window.currentProfileForDuplication = currentProfile.profile;
    
    // Clear target fields
    document.getElementById('duplicateTargetName').value = '';
    document.getElementById('duplicateTargetDescription').value = '';
    
    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('duplicateProfileModal'));
    modal.show();
    
    // Focus the target name input after modal is shown
    document.getElementById('duplicateProfileModal').addEventListener('shown.bs.modal', function () {
      document.getElementById('duplicateTargetName').focus();
    }, { once: true });
  } catch (error) {
    window.logError('Error showing duplicate profile modal:', error);
    alert(`Error: ${error.message}`);
  }
}

/**
 * Handle duplicate profile form submission
 */
async function handleDuplicateProfileSubmit() {
  const targetNameInput = document.getElementById('duplicateTargetName');
  const targetDescInput = document.getElementById('duplicateTargetDescription');
  
  const sourceName = window.currentProfileForDuplication;
  const targetName = targetNameInput.value.trim();
  const targetDescription = targetDescInput.value.trim();
  
  // Validate source profile exists
  if (!sourceName) {
    alert('Could not determine source profile');
    return;
  }
  
  // Validate target profile name
  if (!targetName) {
    alert('New profile name is required');
    targetNameInput.focus();
    return;
  }
  
  // Check for invalid characters (basic validation)
  if (!/^[a-zA-Z0-9\s\-_]+$/.test(targetName)) {
    alert('Profile name can only contain letters, numbers, spaces, hyphens, and underscores');
    targetNameInput.focus();
    return;
  }
  
  // Check if trying to duplicate to same name
  if (sourceName === targetName) {
    alert('New profile name must be different from the source profile');
    targetNameInput.focus();
    return;
  }
  
  try {
    // Duplicate the profile
    const result = await window.secureElectronAPI.profile.duplicateProfile(sourceName, targetName, targetDescription);
    
    if (result && result.success) {
      // Close the modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('duplicateProfileModal'));
      modal.hide();
      
      // Switch directly to the newly duplicated profile
      try {
        const switchResult = await window.secureElectronAPI.profile.switchToProfile(targetName);
        if (!switchResult.success) {
          window.logError('Failed to switch to duplicated profile:', switchResult.error);
          // Fallback: just refresh the indicator
          await refreshProfileIndicator();
        }
      } catch (switchError) {
        window.logError('Error switching to duplicated profile:', switchError);
        // Fallback: just refresh the indicator
        await refreshProfileIndicator();
      }
    } else {
      const errorMessage = result?.error || 'Unknown error occurred';
      alert(`Failed to duplicate profile: ${errorMessage}`);
    }
  } catch (error) {
    window.logError('Error duplicating profile:', error);
    alert(`Error duplicating profile: ${error.message}`);
  }
}

/**
 * Refresh the profile indicator after profile changes
 */
async function refreshProfileIndicator() {
  try {
    const result = await window.secureElectronAPI.profile.getCurrent();
    if (result.success) {
      const profileNameElement = document.getElementById('profile-name');
      if (profileNameElement) {
        profileNameElement.textContent = `Profile: ${result.profile}`;
      }
    }
  } catch (error) {
    window.logError('Failed to refresh profile indicator:', error);
  }
}

// Set up event listeners for the profile modals
document.addEventListener('DOMContentLoaded', function() {
  // New profile modal handlers
  document.getElementById('createProfileBtn').addEventListener('click', handleNewProfileSubmit);
  
  document.getElementById('newProfileName').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleNewProfileSubmit();
    }
  });
  
  document.getElementById('newProfileDescription').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleNewProfileSubmit();
    }
  });
  
  // Duplicate profile modal handlers
  document.getElementById('duplicateProfileBtn').addEventListener('click', handleDuplicateProfileSubmit);
  
  document.getElementById('duplicateTargetName').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleDuplicateProfileSubmit();
    }
  });
  
  document.getElementById('duplicateTargetDescription').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleDuplicateProfileSubmit();
    }
  });
});

