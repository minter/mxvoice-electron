// Track renderer errors via analytics
window.addEventListener('error', (event) => {
  window.secureElectronAPI?.analytics?.trackEvent?.('renderer_error', {
    error_message: event.message,
    stack_trace: event.error?.stack,
  });
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  window.secureElectronAPI?.analytics?.trackEvent?.('renderer_error', {
    error_message: reason instanceof Error ? reason.message : String(reason),
    stack_trace: reason instanceof Error ? reason.stack : undefined,
  });
});

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
  } catch {
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
import setupMainProcessEventBridge from './renderer/modules/event-coordination/main-process-events.js';
import showAnalyticsBannerIfNeeded, {
  setupUpdateDeferralTracking
} from './renderer/modules/analytics/consent-banner.js';
import {
  initializeProfileUI,
  showDuplicateProfileModal,
  showNewProfileModal
} from './renderer/modules/profiles/profile-ui-controller.js';

// Global instances - now managed by app-initialization module  
let debugLogger = null;

// Initialize debug logger early with basic configuration
debugLogger = initializeDebugLogger({
  electronAPI: window.secureElectronAPI
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

// Internal module registry populated by the bootstrap loader.
const moduleRegistry = {};

// Set up an early, lightweight IPC bridge for preferences so that
// 'show_preferences' events are handled even if full coordination/
// module loading is still in progress. This avoids races where the
// main process sends 'show_preferences' shortly after startup.
(function setupEarlyPreferencesBridge(maxWait = 5000) {
  try {
    const start = Date.now();

    const trySetup = () => {
      try {
        const api = window.secureElectronAPI;
        if (api && api.events && typeof api.events.onShowPreferences === 'function') {
          api.events.onShowPreferences(() => {
            try {
              const callStart = Date.now();

              const invokeWhenReady = () => {
                try {
                  const openFn = moduleRegistry.preferences?.openPreferencesModal || null;

                  if (openFn) {
                    openFn();
                    return;
                  }

                  if (Date.now() - callStart < maxWait) {
                    setTimeout(invokeWhenReady, 50);
                  } else {
                    window.logWarn('openPreferencesModal not available before timeout in early bridge handler');
                  }
                } catch (handlerError) {
                  window.logError('Error handling show_preferences in early bridge (deferred)', handlerError);
                }
              };

              invokeWhenReady();
            } catch (handlerErrorOuter) {
              window.logError('Error scheduling show_preferences handling in early bridge', handlerErrorOuter);
            }
          });

          window.logInfo('Early preferences IPC bridge initialized');
          return;
        }

        if (Date.now() - start < maxWait) {
          setTimeout(trySetup, 50);
        } else {
          window.logWarn('Timed out waiting for secureElectronAPI in early preferences bridge');
        }
      } catch {
        // Swallow and retry until timeout; renderer may still be initializing
        if (Date.now() - start < maxWait) {
          setTimeout(trySetup, 50);
        }
      }
    };

    trySetup();
  } catch {
    // If something goes wrong here, the later, full bridge setup
    // in the module loader will still attempt to wire events.
  }
})();

initializeProfileUI({ moduleRegistry });

// Import keyboard manager for centralized keyboard shortcut management
import KeyboardManager from './renderer/modules/keyboard-manager/index.js';

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
    if (result.success && result.profile) {
      const profileNameElement = document.getElementById('profile-name');
      if (profileNameElement) {
        profileNameElement.textContent = result.profile;
      }
    } else {
      // Handle case where no profile is available (launcher mode)
      const profileNameElement = document.getElementById('profile-name');
      if (profileNameElement) {
        profileNameElement.textContent = 'No Profile';
      }
    }
  } catch (error) {
    // Use debugLog if available, fallback to console for early initialization
    if (window.debugLog) {
      window.debugLog.error('Failed to load profile', { error: error.message });
    } else {
      // Early initialization - debugLog not available yet
      // Error will be logged when debugLog is available
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
        electronAPI: window.secureElectronAPI
      },
      environment: {
        debugMode: true,
        performanceMonitoring: true
      }
    });
    
    if (!initSuccess) {
      throw new Error('Application initialization failed');
    }
    
    if (window.electronTest?.isE2E) {
      window.sharedState = AppInitialization.getSharedState();
    }
    
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
        electronAPI: window.secureElectronAPI,
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
    window.logDebug('Search', !!moduleRegistry.search);
    window.logDebug('Audio', !!moduleRegistry.audio);
    window.logDebug('UI', !!moduleRegistry.ui);
    window.logDebug('Preferences', !!moduleRegistry.preferences);
    window.logDebug('Database', !!moduleRegistry.database);
    window.logDebug('Utils', !!moduleRegistry.utils);

    // Expose only the narrow production bridge needed by main-process shutdown.
    window.profileStateAPI = {
      flushProfileState: () => moduleRegistry.profileState?.flushProfileState?.()
    };

    // The full registry is an E2E harness, not a production dependency.
    if (window.electronTest?.isE2E) {
      window.moduleRegistry = moduleRegistry;
    }
    
    // Ensure window.debugLog is available for modules
    if (moduleRegistry.debugLog && !window.debugLog) {
      window.debugLog = moduleRegistry.debugLog;
      window.logInfo('Global debugLog made available');
    }
    
    // Initialize profile backup module
    if (moduleRegistry.profileBackup) {
      window.logInfo('💾 Initializing profile backup module...');
      moduleRegistry.profileBackup.initializeProfileBackup({
        electronAPI: window.secureElectronAPI,
        moduleRegistry
      });
    }
    
    // Initialize library transfer module
    if (moduleRegistry.libraryTransfer) {
      window.logInfo('📦 Initializing library transfer module...');
      moduleRegistry.libraryTransfer.initializeLibraryTransfer({
        electronAPI: window.secureElectronAPI
      });
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
      const apiToUse = window.secureElectronAPI;
      
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
      }
      
      // Logout event listener
      if (apiToUse && apiToUse.events && apiToUse.events.onLogout) {
        window.logInfo('🚪 Setting up logout event listener...');
        apiToUse.events.onLogout(async () => {
          window.logInfo('🚪 Logout requested from menu');
          try {
            // Save current state before logging out
            window.logInfo('💾 Saving current profile state before logout...');
            if (moduleRegistry.profileState && moduleRegistry.profileState.extractProfileState) {
              try {
                const state = moduleRegistry.profileState.extractProfileState();
                const saveResult = await window.secureElectronAPI.profile.saveStateBeforeSwitch(state);
                
                if (!saveResult.success) {
                  window.logError('Failed to save state before logout:', saveResult.error);
                } else {
                  window.logInfo('✅ State saved successfully before logout');
                }
              } catch (stateError) {
                window.logError('Error saving state before logout:', stateError);
              }
            }
            
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
      
      // Backup menu event listeners
      // Remove existing listeners first to prevent duplicates
      if (apiToUse && apiToUse.events && apiToUse.events.removeAllListeners) {
        apiToUse.events.removeAllListeners('menu:create-backup');
        apiToUse.events.removeAllListeners('menu:restore-backup');
        apiToUse.events.removeAllListeners('menu:backup-settings');
      }
      
      if (apiToUse && apiToUse.events && apiToUse.events.onCreateBackup) {
        window.logInfo('💾 Setting up create backup event listener...');
        apiToUse.events.onCreateBackup(async () => {
          window.logInfo('💾 Create backup requested from menu');
          if (moduleRegistry.profileBackup && moduleRegistry.profileBackup.createBackupNow) {
            await moduleRegistry.profileBackup.createBackupNow();
          } else {
            window.logWarn('Profile backup module not available for create backup');
          }
        });
      }
      
      if (apiToUse && apiToUse.events && apiToUse.events.onRestoreBackup) {
        window.logInfo('📥 Setting up restore backup event listener...');
        apiToUse.events.onRestoreBackup(async () => {
          window.logInfo('📥 Restore backup requested from menu');
          if (moduleRegistry.profileBackup && moduleRegistry.profileBackup.openBackupRestoreDialog) {
            await moduleRegistry.profileBackup.openBackupRestoreDialog();
          } else {
            window.logWarn('Profile backup module not available for restore backup');
          }
        });
      }
      
      if (apiToUse && apiToUse.events && apiToUse.events.onBackupSettings) {
        window.logInfo('⚙️ Setting up backup settings event listener...');
        apiToUse.events.onBackupSettings(async () => {
          window.logInfo('⚙️ Backup settings requested from menu');
          if (moduleRegistry.profileBackup && moduleRegistry.profileBackup.openBackupSettingsDialog) {
            await moduleRegistry.profileBackup.openBackupSettingsDialog();
          } else {
            window.logWarn('Profile backup module not available for backup settings');
          }
        });
      }

      if (apiToUse && apiToUse.events && apiToUse.events.onExportLibrary) {
        window.logInfo('📦 Setting up export library event listener...');
        apiToUse.events.onExportLibrary(async () => {
          window.logInfo('📦 Export library requested from menu');
          if (moduleRegistry.libraryTransfer && moduleRegistry.libraryTransfer.startExport) {
            await moduleRegistry.libraryTransfer.startExport();
          } else {
            window.logWarn('Library transfer module not available for export');
          }
        });
      }

      if (apiToUse && apiToUse.events && apiToUse.events.onImportLibrary) {
        window.logInfo('📦 Setting up import library event listener...');
        apiToUse.events.onImportLibrary(async () => {
          window.logInfo('📦 Import library requested from menu');
          if (moduleRegistry.libraryTransfer && moduleRegistry.libraryTransfer.startImport) {
            await moduleRegistry.libraryTransfer.startImport();
          } else {
            window.logWarn('Library transfer module not available for import');
          }
        });
      }

      if (apiToUse && apiToUse.events && apiToUse.events.onWhatsNew) {
        window.logInfo('🆕 Setting up What\'s New event listener...');
        apiToUse.events.onWhatsNew(async () => {
          window.logInfo('🆕 What\'s New requested from menu');
          if (moduleRegistry.whatsNew && moduleRegistry.whatsNew.showWhatsNew) {
            await moduleRegistry.whatsNew.showWhatsNew();
          } else {
            window.logWarn('What\'s New module not available');
          }
        });
      }
    }
    
    // Clear profile restoration lock now that app initialization is complete.
    if (moduleRegistry.profileState && moduleRegistry.profileState.clearProfileRestorationLock) {
      moduleRegistry.profileState.clearProfileRestorationLock();
      window.logInfo('✅ Profile restoration lock cleared - app fully initialized');
    }

    // Restore holding tank mode (playlist/storage) from profile preferences
    // This runs after full initialization to ensure all UI elements and modules are ready
    if (moduleRegistry.holdingTank?.initHoldingTank) {
      moduleRegistry.holdingTank.initHoldingTank().then(result => {
        window.logInfo(`Holding tank mode restored: ${result?.mode || 'storage'}`);
      }).catch(() => {});
    }

    // Bridge secure IPC events to renderer functions under context isolation.
    // This runs even when function coordination initialization fails.
    try {
      setupMainProcessEventBridge({
        electronAPI: window.secureElectronAPI,
        moduleRegistry,
        logWarn: window.logWarn,
        logError: window.logError
      });
    } catch (bridgeError) {
      window.logWarn('Failed setting up secure API event bridges', { error: bridgeError?.message });
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
      moduleRegistry.ui?.scaleScrollable?.();

      if (!moduleRegistry.categories?.populateCategorySelect) {
        throw new Error('Categories module cannot populate the category select');
      }
      window.logInfo('Attempting to populate categories...');
      await moduleRegistry.categories.populateCategorySelect();
      window.logInfo('Categories populated successfully');

      if (!moduleRegistry.search?.performLiveSearch) {
        throw new Error('Search module cannot perform the initial search');
      }
      window.logInfo('Loading initial search results...');
      await moduleRegistry.search.performLiveSearch('');
      window.logInfo('Initial search results loaded successfully');

      window.logInfo('Module-dependent functions called successfully!');
    } catch (error) {
      window.logError('Error calling module-dependent functions', error);
    }

    // Auto-trigger What's New tour if applicable
    if (moduleRegistry.whatsNew && moduleRegistry.whatsNew.initWhatsNew) {
      await moduleRegistry.whatsNew.initWhatsNew();
    }

    // Set up keyboard shortcuts using the keyboard manager module
    try {
      window.logInfo('Initializing keyboard manager...');
      keyboardManager = new KeyboardManager({
        debugLog: window.debugLog || debugLogger,
        electronAPI: window.secureElectronAPI,
        moduleRegistry
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
    // Ensure the profile restoration lock is cleared even if init threw before
    // reaching the normal clear path. Otherwise saves stay blocked all session.
    try {
      if (moduleRegistry?.profileState?.clearProfileRestorationLock) {
        moduleRegistry.profileState.clearProfileRestorationLock();
      } else if (window.isRestoringProfileState) {
        window.isRestoringProfileState = false;
      }
    } catch (_error) {
      // Preserve the original initialization error.
    }
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
    setupUpdateDeferralTracking({ electronAPI: window.secureElectronAPI });

    // Initialize DOM-dependent features from app-initialization module
    if (AppInitialization.isInitialized()) {
      await AppInitialization.initializeDOMDependentFeatures();
    }
    
    window.logInfo('DOM ready, initializing event coordination...');
    
    // Initialize event coordination module
    eventCoordination = new EventCoordination({
      electronAPI: window.secureElectronAPI,
      debugLog: debugLogger,
      moduleRegistry: moduleRegistry
    });

    // Initialize the event coordination system
    const initialized = await eventCoordination.init({
      electronAPI: window.secureElectronAPI,
      debugLog: debugLogger,
      moduleRegistry: moduleRegistry
    });
    if (!initialized) throw new Error('Event coordination initialization failed');
    window.logInfo('Event coordination initialized successfully');

    // Attach all event handlers - this replaces all the jQuery event handling code
    const handlersAttached = await eventCoordination.attachEventHandlers();
    if (!handlersAttached) throw new Error('Event handlers failed to attach');
    window.logInfo('All event handlers attached via event coordination module');

    // Hotkeys module is now handled by EventCoordination system
    // No manual initialization needed

    // Initialize cleanup module for resource cleanup on window close
    if (moduleRegistry.cleanup && moduleRegistry.cleanup.initializeCleanup) {
      window.logInfo('Initializing cleanup module...');
      moduleRegistry.cleanup.initializeCleanup({
        debugLog: debugLogger,
        eventCoordination: eventCoordination
      });
      window.logInfo('Cleanup module initialized successfully');
    }

    // Show analytics consent banner if not yet shown
    await showAnalyticsBannerIfNeeded({
      electronAPI: window.secureElectronAPI,
      testEnvironment: window.electronTest
    });

  } catch (error) {
    window.logError('Error initializing event coordination:', error);
  }
});
