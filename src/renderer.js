var sound;
var categories = [];
var globalAnimation;
var autoplay = false;
var loop = false;
var holdingTankMode = "storage"; // 'storage' or 'playlist'
var searchTimeout; // Global variable for live search debouncing
var wavesurfer = WaveSurfer.create({
  container: "#waveform",
  waveColor: "#e9ecef",
  backgroundColor: "#343a40",
  progressColor: "#007bff",
  cursorColor: "white",
  cursorWidth: 0,
  responsive: true,
  height: 100,
});
var fontSize = 11;

// Initialize shared state with global variables
(async function initializeSharedState() {
  try {
    const sharedStateModule = await import('./renderer/modules/shared-state.js');
    const sharedState = sharedStateModule.default;
    
    // Initialize shared state with current global values
    sharedState.set('sound', sound);
    sharedState.set('globalAnimation', globalAnimation);
    sharedState.set('wavesurfer', wavesurfer);
    sharedState.set('autoplay', autoplay);
    sharedState.set('loop', loop);
    sharedState.set('holdingTankMode', holdingTankMode);
    sharedState.set('fontSize', fontSize);
    sharedState.set('categories', categories);
    
    console.log('✅ Shared state initialized with global variables');
  } catch (error) {
    console.warn('❌ Failed to initialize shared state:', error);
  }
})();

// Load the last holding tank and hotkeys

// Always clear the holding tank store to ensure we load the new HTML
window.electronAPI.store.has("holding_tank").then(hasHoldingTank => {
  if (hasHoldingTank) {
    window.electronAPI.store.delete("holding_tank").then(() => {
      console.log("Cleared holding tank store to load new HTML");
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
          console.log("Cleared old hotkeys HTML format");
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
        fontSize = size;
        $(".song").css("font-size", fontSize + "px");
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

// Load modules dynamically and make functions globally available
(async function loadModules() {
  try {
    console.log('🔄 Starting module loading...');
    
    // Declare module variables
    let fileOperationsModule, songManagementModule, holdingTankModule, hotkeysModule;
    let categoriesModule, bulkOperationsModule, dragDropModule, navigationModule;
    let modeManagementModule, testUtilsModule, searchModule, audioModule;
    let uiModule, preferencesModule, databaseModule, utilsModule;
    
    // Import file operations module and make functions globally available
    try {
      console.log('🔄 Loading file-operations module...');
      fileOperationsModule = await import('./renderer/modules/file-operations/index.js');
      console.log('✅ file-operations module loaded successfully');
    } catch (error) {
      console.error('❌ Error loading file-operations module:', error);
      throw error;
    }
    
    // Make file operations functions globally available
    window.openHotkeyFile = fileOperationsModule.default.openHotkeyFile;
    window.openHoldingTankFile = fileOperationsModule.default.openHoldingTankFile;
    window.saveHotkeyFile = fileOperationsModule.default.saveHotkeyFile;
    window.saveHoldingTankFile = fileOperationsModule.default.saveHoldingTankFile;
    window.pickDirectory = fileOperationsModule.default.pickDirectory;
    window.installUpdate = fileOperationsModule.default.installUpdate;

    // Import song management module and make functions globally available
    try {
      console.log('🔄 Loading song-management module...');
      songManagementModule = await import('./renderer/modules/song-management/index.js');
      console.log('✅ song-management module loaded successfully');
    } catch (error) {
      console.error('❌ Error loading song-management module:', error);
      throw error;
    }
    
    // Make song management functions globally available
    window.saveEditedSong = songManagementModule.default.saveEditedSong;
    window.saveNewSong = songManagementModule.default.saveNewSong;
    window.editSelectedSong = songManagementModule.default.editSelectedSong;
    window.deleteSelectedSong = songManagementModule.default.deleteSelectedSong;
    window.deleteSong = songManagementModule.default.deleteSong;
    window.removeFromHoldingTank = songManagementModule.default.removeFromHoldingTank;
    window.removeFromHotkey = songManagementModule.default.removeFromHotkey;

    // Import holding tank module for additional functions
    try {
      console.log('🔄 Loading holding-tank module...');
      holdingTankModule = await import('./renderer/modules/holding-tank/index.js');
      console.log('✅ holding-tank module loaded successfully');
    } catch (error) {
      console.error('❌ Error loading holding-tank module:', error);
      throw error;
    }
    
    // Make holding tank functions globally available
    // Create synchronous wrappers for async functions since they're called from HTML onclick
    window.clearHoldingTank = function() {
      holdingTankModule.default.clearHoldingTank().catch(error => {
        console.error('❌ Error in clearHoldingTank:', error);
      });
    };
    window.renameHoldingTankTab = function() {
      holdingTankModule.default.renameHoldingTankTab().catch(error => {
        console.error('❌ Error in renameHoldingTankTab:', error);
      });
    };
    window.scale_scrollable = holdingTankModule.default.scale_scrollable;
    window.saveHoldingTankToStore = saveHoldingTankToStore;

    // Import hotkeys module and make functions globally available
    try {
      console.log('🔄 Loading hotkeys module...');
      hotkeysModule = await import('./renderer/modules/hotkeys/index.js');
      console.log('✅ hotkeys module loaded successfully');
      
      // Create hotkeys module instance and make functions globally available
      console.log('🔄 Creating hotkeys module instance...');
      console.log('🔄 window.electronAPI available:', !!window.electronAPI);
      console.log('🔄 window.electronAPI.store available:', !!window.electronAPI?.store);
      
      const hotkeysInstance = new hotkeysModule.default({
        electronAPI: window.electronAPI,
        db: null, // Legacy database not used
        store: window.electronAPI?.store
      });
      
      console.log('🔄 Hotkeys module instance created successfully');
      console.log('🔄 hotkeysInstance.populateHotkeys available:', typeof hotkeysInstance.populateHotkeys);
      // Create a synchronous wrapper for clearHotkeys since it's called from HTML onclick
      window.clearHotkeys = function() {
        hotkeysInstance.clearHotkeys().catch(error => {
          console.error('❌ Error in clearHotkeys:', error);
        });
      };
      window.renameHotkeyTab = function() {
        hotkeysInstance.renameHotkeyTab().catch(error => {
          console.error('❌ Error in renameHotkeyTab:', error);
        });
      };
      window.playSongFromHotkey = hotkeysInstance.playSongFromHotkey.bind(hotkeysInstance);
      window.switchToHotkeyTab = hotkeysInstance.switchToHotkeyTab.bind(hotkeysInstance);
      // Bind populateHotkeys with proper context
      window.populateHotkeys = function(fkeys, title) {
        console.log('🔄 window.populateHotkeys called with:', { fkeys, title });
        console.log('🔄 hotkeysInstance type:', typeof hotkeysInstance);
        console.log('🔄 hotkeysInstance.populateHotkeys type:', typeof hotkeysInstance.populateHotkeys);
        console.log('🔄 hotkeysInstance.populateHotkeys.toString():', hotkeysInstance.populateHotkeys.toString().substring(0, 100));
        
        try {
          console.log('🔄 About to call hotkeysInstance.populateHotkeys...');
          const result = hotkeysInstance.populateHotkeys.call(hotkeysInstance, fkeys, title);
          console.log('✅ populateHotkeys completed successfully');
          return result;
        } catch (error) {
          console.error('❌ Error in populateHotkeys:', error);
          console.error('❌ Error stack:', error.stack);
          console.error('❌ Error message:', error.message);
          throw error;
        }
      };
      window.setLabelFromSongId = hotkeysInstance.setLabelFromSongId.bind(hotkeysInstance);
      window.sendToHotkeys = hotkeysInstance.sendToHotkeys.bind(hotkeysInstance);
      window.hotkeyDrop = hotkeysInstance.hotkeyDrop.bind(hotkeysInstance);
      window.allowHotkeyDrop = hotkeysInstance.allowHotkeyDrop.bind(hotkeysInstance);
      window.removeFromHotkey = hotkeysInstance.removeFromHotkey.bind(hotkeysInstance);
      console.log('✅ Hotkeys module loaded successfully');
      console.log('✅ populateHotkeys function is now available globally');
      
      // Test the hotkeys instance
      console.log('🔄 Testing hotkeys instance...');
      console.log('🔄 hotkeysInstance type:', typeof hotkeysInstance);
      console.log('🔄 hotkeysInstance.populateHotkeys type:', typeof hotkeysInstance.populateHotkeys);
      console.log('🔄 hotkeysInstance.electronAPI available:', !!hotkeysInstance.electronAPI);
    } catch (error) {
      console.warn('❌ Failed to load hotkeys module:', error);
      // Continue loading other modules even if hotkeys fails
    }

    console.log('🔄 REACHED: After hotkeys module, before categories module...');
    // Import categories module and make functions globally available
    console.log('🔄 REACHED: About to start categories module loading...');
    try {
      console.log('🔄 Loading categories module...');
      console.log('🔄 About to import categories module...');
      
      // Create a temporary deleteCategory function to prevent errors
      window.deleteCategory = function(event, code, description) {
        console.log('deleteCategory called with:', { event, code, description });
        
        // Simple fallback implementation
        if (confirm(`Are you sure you want to delete "${description}" from Mx. Voice permanently? All songs in this category will be changed to the category "Uncategorized."`)) {
          console.log(`Deleting category ${code}`);
          // For now, just show a message that the module isn't loaded
          alert('Category deletion requires the categories module to be loaded. Please try again.');
        }
        
        // Also try the deferred approach
        setTimeout(() => {
          console.log('Checking for deleteCategoryUI...');
          console.log('window.deleteCategoryUI:', typeof window.deleteCategoryUI);
          console.log('window.deleteCategory:', typeof window.deleteCategory);
          if (window.deleteCategoryUI) {
            console.log('Calling deleteCategoryUI...');
            window.deleteCategoryUI(event, code, description);
          } else {
            console.error('deleteCategoryUI not available');
            console.log('Available window functions:', Object.keys(window).filter(key => key.includes('delete')));
          }
        }, 100);
      };
      
      console.log('🔄 Starting import of categories module...');
      try {
        categoriesModule = await import('./renderer/modules/categories/index.js');
        console.log('✅ categories module import successful');
      } catch (importError) {
        console.error('❌ Categories module import failed:', importError);
        throw importError;
      }
      console.log('✅ categories module loaded successfully');
      
      // The categories module exports a singleton instance, not a constructor
      const categoriesInstance = categoriesModule.default;
      console.log('✅ categoriesInstance created:', typeof categoriesInstance);
      console.log('✅ categoriesInstance.deleteCategoryUI:', typeof categoriesInstance.deleteCategoryUI);
      
      // Initialize the categories module
      await categoriesInstance.init();
      
      console.log('✅ Categories module initialized');
      console.log('✅ deleteCategoryUI available:', typeof categoriesInstance.deleteCategoryUI);
      
      window.populateCategorySelect = categoriesInstance.populateCategorySelect.bind(categoriesInstance);
      window.openCategoriesModal = categoriesInstance.openCategoriesModal.bind(categoriesInstance);
      window.addNewCategory = categoriesInstance.addNewCategoryUI.bind(categoriesInstance);
      window.saveCategories = categoriesInstance.saveCategories.bind(categoriesInstance);
      window.editCategoryUI = categoriesInstance.editCategoryUI.bind(categoriesInstance);
      window.deleteCategoryUI = categoriesInstance.deleteCategoryUI.bind(categoriesInstance);
      
      // Update the wrapper function for the HTML onclick compatibility
      window.deleteCategory = function(event, code, description) {
        console.log('deleteCategory wrapper called with:', { event, code, description });
        console.log('deleteCategory parameters - code:', code, 'description:', description);
        return categoriesInstance.deleteCategoryUI(event, code, description);
      };
      
      console.log('✅ Categories module loaded successfully');
      console.log('✅ deleteCategory function available:', typeof window.deleteCategory);
    } catch (error) {
      console.warn('❌ Failed to load categories module:', error);
      console.error('❌ Categories module error details:', error);
      // Continue loading other modules even if categories fails
    }

    // Import bulk operations module and make functions globally available
    try {
      console.log('🔄 Loading bulk-operations module...');
      bulkOperationsModule = await import('./renderer/modules/bulk-operations/index.js');
      console.log('✅ bulk-operations module loaded successfully');
    } catch (error) {
      console.error('❌ Error loading bulk-operations module:', error);
      throw error;
    }
    
    // Make bulk operations functions globally available
    window.showBulkAddModal = bulkOperationsModule.default.showBulkAddModal;
    window.addSongsByPath = bulkOperationsModule.default.addSongsByPath;
    window.saveBulkUpload = bulkOperationsModule.default.saveBulkUpload;

    // Import drag and drop module and make functions globally available
    try {
      console.log('🔄 Loading drag-drop module...');
      dragDropModule = await import('./renderer/modules/drag-drop/index.js');
      console.log('✅ drag-drop module loaded successfully');
    } catch (error) {
      console.error('❌ Error loading drag-drop module:', error);
      throw error;
    }
    
    // Make drag and drop functions globally available
    window.hotkeyDrop = dragDropModule.default.hotkeyDrop;
    window.holdingTankDrop = dragDropModule.default.holdingTankDrop;
    window.allowHotkeyDrop = dragDropModule.default.allowHotkeyDrop;
    window.songDrag = dragDropModule.default.songDrag;
    window.columnDrag = dragDropModule.default.columnDrag;

    // Import navigation module and make functions globally available
    try {
      console.log('🔄 Loading navigation module...');
      navigationModule = await import('./renderer/modules/navigation/index.js');
      console.log('✅ navigation module loaded successfully');
    } catch (error) {
      console.error('❌ Error loading navigation module:', error);
      throw error;
    }
    
    // Make navigation functions globally available
    window.sendToHotkeys = navigationModule.default.sendToHotkeys;
    window.sendToHoldingTank = navigationModule.default.sendToHoldingTank;
    window.selectNext = navigationModule.default.selectNext;
    window.selectPrev = navigationModule.default.selectPrev;

    // Import mode management module and make functions globally available
    try {
      console.log('🔄 Loading mode-management module...');
      modeManagementModule = await import('./renderer/modules/mode-management/index.js');
      console.log('✅ mode-management module loaded successfully');
    } catch (error) {
      console.error('❌ Error loading mode-management module:', error);
      throw error;
    }
    
    // Make mode management functions globally available
    window.setHoldingTankMode = modeManagementModule.default.setHoldingTankMode;
    window.getHoldingTankMode = modeManagementModule.default.getHoldingTankMode;
    window.toggleAutoPlay = modeManagementModule.default.toggleAutoPlay;
    window.getAutoPlayState = modeManagementModule.default.getAutoPlayState;
    window.resetToDefaultMode = modeManagementModule.default.resetToDefaultMode;

    // Initialize mode management module
    modeManagementModule.default.initModeManagement().then(result => {
      if (result.success) {
        console.log('✅ Mode management module initialized:', result.mode);
      } else {
        console.warn('❌ Failed to initialize mode management module:', result.error);
      }
    }).catch(error => {
      console.error('❌ Mode management module initialization error:', error);
    });

    // Import test functions module and make functions globally available
    try {
      console.log('🔄 Loading test-utils module...');
      testUtilsModule = await import('./renderer/modules/test-utils/index.js');
      console.log('✅ test-utils module loaded successfully');
    } catch (error) {
      console.error('❌ Error loading test-utils module:', error);
      throw error;
    }
    
    // Make test functions globally available
    window.testPhase2Migrations = testUtilsModule.default.testPhase2Migrations;
    window.testDatabaseAPI = testUtilsModule.default.testDatabaseAPI;
    window.testFileSystemAPI = testUtilsModule.default.testFileSystemAPI;
    window.testStoreAPI = testUtilsModule.default.testStoreAPI;
    window.testAudioAPI = testUtilsModule.default.testAudioAPI;
    window.testSecurityFeatures = testUtilsModule.default.testSecurityFeatures;
    window.runAllTests = testUtilsModule.default.runAllTests;

    // Import search module and make functions globally available
    try {
      console.log('🔄 Loading search module...');
      searchModule = await import('./renderer/modules/search/index.js');
      console.log('✅ search module loaded successfully');
      
      // The search module exports a singleton instance, not a constructor
      const searchInstance = searchModule.default;
      
      // Initialize the search module
      searchInstance.init();
      
      window.searchData = searchInstance.searchData.bind(searchInstance);
      window.performLiveSearch = searchInstance.performLiveSearch.bind(searchInstance);
      window.toggleAdvancedSearch = searchInstance.toggleAdvancedSearch.bind(searchInstance);
      window.triggerLiveSearch = searchInstance.triggerLiveSearch.bind(searchInstance);
      window.clearSearchResults = searchInstance.clearSearchResults.bind(searchInstance);
      console.log('✅ Search module loaded successfully');
    } catch (error) {
      console.warn('❌ Failed to load search module:', error);
      // Continue loading other modules even if search fails
    }

    // Import audio module and make functions globally available
    try {
      console.log('🔄 Loading audio module...');
      audioModule = await import('./renderer/modules/audio/index.js');
      console.log('✅ audio module loaded successfully');
      
      // The audio module exports a singleton instance, not a constructor
      const audioInstance = audioModule.default;
      
      // Initialize the audio module
      audioInstance.init();
      
      window.playSongFromId = audioInstance.playSongFromId.bind(audioInstance);
      window.stopPlaying = audioInstance.stopPlaying.bind(audioInstance);
      window.pausePlaying = audioInstance.pausePlaying.bind(audioInstance);
      window.resetUIState = audioInstance.resetUIState.bind(audioInstance);
      window.autoplay_next = audioInstance.autoplay_next.bind(audioInstance);
      window.cancel_autoplay = audioInstance.cancel_autoplay.bind(audioInstance);
      window.playSelected = audioInstance.playSelected.bind(audioInstance);
      window.loop_on = audioInstance.loop_on.bind(audioInstance);
      // window.howlerUtils = audioInstance.howlerUtils.bind(audioInstance); // Function not implemented yet
      console.log('✅ Audio module loaded successfully');
    } catch (error) {
      console.warn('❌ Failed to load audio module:', error);
      // Continue loading other modules even if audio fails
    }

    // Import UI module and make functions globally available
    try {
      console.log('🔄 Loading ui module...');
      uiModule = await import('./renderer/modules/ui/index.js');
      console.log('✅ ui module loaded successfully');
      
      // Re-initialize UI module with proper dependencies
      const uiInstance = uiModule.default.reinitializeUI({
        electronAPI: window.electronAPI,
        db: window.db,
        store: null // Legacy store not available, will use electronAPI.store
      });
      
      // Update the module exports with the properly initialized instance
      Object.assign(uiModule.default, uiInstance);
    } catch (error) {
      console.error('❌ Error loading ui module:', error);
      throw error;
    }
    
    // Make UI functions globally available
    window.scaleScrollable = uiModule.default.scaleScrollable;
    window.editSelectedSong = uiModule.default.editSelectedSong;
    window.deleteSelectedSong = uiModule.default.deleteSelectedSong;
    window.closeAllTabs = uiModule.default.closeAllTabs;
    window.toggleSelectedRow = uiModule.default.toggleSelectedRow;
    window.switchToHotkeyTab = uiModule.default.switchToHotkeyTab;
    window.renameHotkeyTab = function() {
      uiModule.default.renameHotkeyTab().catch(error => {
        console.error('❌ Error in renameHotkeyTab:', error);
      });
    };
    window.renameHoldingTankTab = function() {
      uiModule.default.renameHoldingTankTab().catch(error => {
        console.error('❌ Error in renameHoldingTankTab:', error);
      });
    };
    window.increaseFontSize = uiModule.default.increaseFontSize;
    window.decreaseFontSize = uiModule.default.decreaseFontSize;
    window.toggleWaveform = uiModule.default.toggleWaveform;
    // toggleAdvancedSearch is handled by the search module
    window.pickDirectory = uiModule.default.pickDirectory;
    window.installUpdate = uiModule.default.installUpdate;
    window.getFontSize = uiModule.default.getFontSize;
    window.setFontSize = uiModule.default.setFontSize;

    // Import preferences module and make functions globally available
    try {
      console.log('🔄 Loading preferences module...');
      preferencesModule = await import('./renderer/modules/preferences/index.js');
      console.log('✅ preferences module loaded successfully');
      
      // Re-initialize preferences module with proper dependencies
      const preferencesInstance = preferencesModule.default.reinitializePreferences({
        electronAPI: window.electronAPI,
        db: window.db,
        store: null // Legacy store not available, will use electronAPI.store
      });
      
      // Make preferences functions globally available
      window.openPreferencesModal = preferencesInstance.openPreferencesModal;
      window.loadPreferences = preferencesInstance.loadPreferences;
      window.savePreferences = preferencesInstance.savePreferences;
      window.getPreference = preferencesInstance.getPreference;
      window.setPreference = preferencesInstance.setPreference;
      window.getDatabaseDirectory = preferencesInstance.getDatabaseDirectory;
      window.getMusicDirectory = preferencesInstance.getMusicDirectory;
      window.getHotkeyDirectory = preferencesInstance.getHotkeyDirectory;
      window.getFadeOutSeconds = preferencesInstance.getFadeOutSeconds;
    } catch (error) {
      console.error('❌ Error loading preferences module:', error);
      throw error;
    }

    // Import database module and make functions globally available
    try {
      console.log('🔄 Loading database module...');
      try {
        databaseModule = await import('./renderer/modules/database/index.js');
        console.log('✅ Database module import successful');
      } catch (importError) {
        console.error('❌ Database module import failed:', importError);
        console.error('❌ Import error stack:', importError.stack);
        console.error('❌ Import error message:', importError.message);
        throw importError;
      }
      console.log('✅ database module loaded successfully');
      
      // The database module exports a singleton instance, not a constructor
      const databaseInstance = databaseModule.default.database;
      
      // Initialize the database module
      databaseInstance.init();
      
      // Make functions globally available (no binding needed for simple functions)
      window.setLabelFromSongId = databaseInstance.setLabelFromSongId;
      window.addToHoldingTank = databaseInstance.addToHoldingTank;
      window.populateHoldingTank = databaseInstance.populateHoldingTank;
      window.populateCategorySelect = databaseInstance.populateCategorySelect;
      console.log('✅ Database module loaded successfully');
      console.log('✅ populateHoldingTank function is now available globally');
    } catch (error) {
      console.error('❌ Failed to load database module:', error);
      console.error('❌ Database module error stack:', error.stack);
      console.error('❌ Database module error message:', error.message);
      console.error('❌ Database module error name:', error.name);
      if (error.line) console.error('❌ Database module error line:', error.line);
      if (error.column) console.error('❌ Database module error column:', error.column);
      // Continue loading other modules even if database fails
    }

    // Import utils module and make functions globally available
    try {
      console.log('🔄 Loading utils module...');
      try {
        utilsModule = await import('./renderer/modules/utils/index.js');
        console.log('✅ Utils module import successful');
      } catch (importError) {
        console.error('❌ Utils module import failed:', importError);
        console.error('❌ Import error stack:', importError.stack);
        console.error('❌ Import error message:', importError.message);
        throw importError;
      }
      console.log('✅ utils module loaded successfully');
      
      // The utils module exports a singleton instance, not a constructor
      const utilsInstance = utilsModule.default;
      
      // Initialize the utils module
      utilsInstance.init();
      
      // Make functions globally available (no binding needed for simple functions)
      window.animateCSS = utilsInstance.animateCSS;
      window.customConfirm = utilsInstance.customConfirm;
      window.customPrompt = utilsInstance.customPrompt;
      window.restoreFocusToSearch = utilsInstance.restoreFocusToSearch;
      window.isValidSongId = utilsInstance.isValidSongId;
      window.isValidCategoryCode = utilsInstance.isValidCategoryCode;
      window.isValidFilePath = utilsInstance.isValidFilePath;
      window.isValidHotkey = utilsInstance.isValidHotkey;
      console.log('✅ Utils module loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load utils module:', error);
      console.error('❌ Utils module error stack:', error.stack);
      console.error('❌ Utils module error message:', error.message);
      console.error('❌ Utils module error name:', error.name);
      if (error.line) console.error('❌ Utils module error line:', error.line);
      if (error.column) console.error('❌ Utils module error column:', error.column);
      // Continue loading other modules even if utils fails
    }

    console.log('✅ All modules loaded successfully!');

    // Initialize modules after loading
    try {
      bulkOperationsModule.default.initializeBulkOperations();
      dragDropModule.default.initializeDragDrop();
      navigationModule.default.initializeNavigation();
      console.log('✅ All modules initialized successfully!');
    } catch (error) {
      console.error('❌ Error initializing modules:', error);
    }

    // Call functions that depend on loaded modules
    try {
      if (window.scale_scrollable) {
        window.scale_scrollable();
      }
      // Ensure categories are populated after database module is loaded
      if (window.populateCategorySelect) {
        console.log('🔄 Attempting to populate categories...');
        await window.populateCategorySelect();
        console.log('✅ Categories populated successfully');
      } else {
        console.warn('❌ populateCategorySelect function not available');
      }
      console.log('✅ Module-dependent functions called successfully!');
    } catch (error) {
      console.error('❌ Error calling module-dependent functions:', error);
    }

    // Set up keyboard shortcuts after modules are loaded
    try {
      setupKeyboardShortcuts();
      console.log('✅ Keyboard shortcuts set up successfully!');
    } catch (error) {
      console.error('❌ Error setting up keyboard shortcuts:', error);
    }
  } catch (error) {
    console.error('❌ Error loading modules:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error message:', error.message);
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

function toggle_selected_row(row) {
  // if ($(row).attr('id') == "selected_row") {
  //   $(row).removeAttr("id");
  // } else {
  $("#selected_row").removeAttr("id");
  $(row).attr("id", "selected_row");
  $("#play_button").removeAttr("disabled");
  // }
}

function loop_on(bool) {
  if (bool == true) {
    $("#loop_button").addClass("active");
  } else {
    $("#loop_button").removeClass("active");
  }
}

// pickDirectory() and installUpdate() functions moved to file-operations module

// UI and search functions moved to respective modules

function closeAllTabs() {
  customConfirm(`Are you sure you want to close all open Holding Tanks and Hotkeys?`, function() {
    // Use new store API for cleanup operations
    Promise.all([
      window.electronAPI.store.delete("holding_tank"),
      window.electronAPI.store.delete("hotkeys"),
      window.electronAPI.store.delete("column_order"),
      window.electronAPI.store.delete("font-size")
    ]).then(() => {
      console.log('✅ All tabs closed successfully');
      location.reload();
    }).catch(error => {
      console.warn('❌ Failed to close tabs:', error);
      // Fallback to legacy store access
      store.delete("holding_tank");
      store.delete("hotkeys");
      store.delete("column_order");
      store.delete("font-size");
      location.reload();
    });
  });
}

// Utility functions moved to utils module

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
    console.log("Delete key pressed");
    console.log("selected_row:", $("#selected_row"));
    console.log("holding-tank-column has selected_row:", $("#holding-tank-column").has($("#selected_row")).length);
    console.log("hotkey-tab-content has selected_row:", $("#hotkey-tab-content").has($("#selected_row")).length);
    
    // Check if the selected row is in the holding tank
    if ($("#holding-tank-column").has($("#selected_row")).length) {
      console.log("Selected row is in holding tank");
      // If in holding tank, remove from holding tank
      if (window.removeFromHoldingTank) {
        removeFromHoldingTank();
      }
    } else if ($("#hotkey-tab-content").has($("#selected_row")).length) {
      console.log("Selected row is in hotkey tab");
      // If in hotkey tab, remove from hotkey
      if (window.removeFromHotkey) {
        removeFromHotkey();
      }
    } else {
      console.log("Selected row is in search results");
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
    toggle_selected_row(this);
  });

  $("#search_results").on("contextmenu", "tbody tr", function (event) {
    toggle_selected_row(this);
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
    toggle_selected_row(this);
  });

  $(".holding_tank").on("dblclick", ".list-group-item", function (event) {
    $(".now_playing").first().removeClass("now_playing");

    // Set the clicked item as selected
    $("#selected_row").removeAttr("id");
    $(this).attr("id", "selected_row");

    if (holdingTankMode === "playlist") {
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
    console.log('🔄 Category select changed, calling searchData...');
    if (window.searchData) {
      window.searchData();
      console.log('✅ searchData called successfully from category change');
    } else {
      console.warn('❌ searchData function not available');
    }
    $("#omni_search").focus();
    $("#category_select").prop("selectedIndex", category);
  });

  $("#date-search").on("change", function () {
    console.log('🔄 Date search changed, calling searchData...');
    if (window.searchData) {
      window.searchData();
      console.log('✅ searchData called successfully from date search change');
    } else {
      console.warn('❌ searchData function not available');
    }
  });



  $("#search_form :input").on("keydown", function (e) {
    if (e.code == "Enter") {
      // Clear any pending live search
      clearTimeout(searchTimeout);
      console.log('🔄 Search form submitted via Enter key, calling searchData...');
      if (window.searchData) {
        window.searchData();
        console.log('✅ searchData called successfully');
      } else {
        console.warn('❌ searchData function not available');
      }
      return false;
    }
  });

  // Add explicit submit handler for search form
  $("#search_form").on("submit", function (e) {
    e.preventDefault();
    console.log('🔄 Search form submitted, calling searchData...');
    if (window.searchData) {
      window.searchData();
      console.log('✅ searchData called successfully');
    } else {
      console.warn('❌ searchData function not available');
    }
    $("#omni_search").focus();
    return false;
  });

  // Live search with debouncing

  // triggerLiveSearch function moved to search module

  // Live search on search term input
  $("#omni_search").on("input", function () {
    console.log('🔄 Omni search input changed, triggering live search...');
    if (window.triggerLiveSearch) {
      window.triggerLiveSearch();
      console.log('✅ triggerLiveSearch called successfully');
    } else {
      console.warn('❌ triggerLiveSearch function not available');
    }
  });

  // Live search when category filter changes
  $("#category_select").on("change", function () {
    var searchTerm = $("#omni_search").val().trim();
    console.log('🔄 Category select changed, search term:', searchTerm);
    if (searchTerm.length >= 2) {
      if (window.triggerLiveSearch) {
        window.triggerLiveSearch();
        console.log('✅ triggerLiveSearch called successfully from category change');
      } else {
        console.warn('❌ triggerLiveSearch function not available');
      }
    }
  });

  // Live search when advanced search fields change
  $("#title-search, #artist-search, #info-search, #date-search").on(
    "input change",
    function () {
      console.log('🔄 Advanced search field changed');
      // When advanced search is active, trigger live search even if omni_search is empty
      if ($("#advanced-search").is(":visible")) {
        if (window.triggerLiveSearch) {
          window.triggerLiveSearch();
          console.log('✅ triggerLiveSearch called successfully from advanced search');
        } else {
          console.warn('❌ triggerLiveSearch function not available');
        }
      } else {
        var searchTerm = $("#omni_search").val().trim();
        if (searchTerm.length >= 2) {
          if (window.triggerLiveSearch) {
            window.triggerLiveSearch();
            console.log('✅ triggerLiveSearch called successfully from advanced search (with term)');
          } else {
            console.warn('❌ triggerLiveSearch function not available');
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
    console.log('🔄 Reset button clicked');
    // Clear any pending live search
    clearTimeout(searchTimeout);
    $("#search_form").trigger("reset");
    $("#omni_search").focus();
    $("#search_results tbody").find("tr").remove();
    $("#search_results thead").hide();
    console.log('✅ Search results cleared');
    return false;
  });

  $("#advanced_search_button").on("click", function () {
    console.log("🔄 Advanced search button clicked");
    if (window.toggleAdvancedSearch) {
      window.toggleAdvancedSearch();
      console.log('✅ toggleAdvancedSearch called successfully');
    } else {
      console.warn('❌ toggleAdvancedSearch function not available');
    }
    return false;
  });

  $("#pause_button").click(function (e) {
    console.log('🔍 Pause button clicked');
    console.log('🔍 window.pausePlaying function:', typeof window.pausePlaying);
    if (window.pausePlaying) {
      if (e.shiftKey) {
        window.pausePlaying(true);
      } else {
        window.pausePlaying();
      }
    } else {
      console.error('❌ pausePlaying function not available');
    }
  });

  $("#play_button").click(function (e) {
    console.log('🔍 Play button clicked');
    console.log('🔍 window.pausePlaying function:', typeof window.pausePlaying);
    console.log('🔍 window.playSelected function:', typeof window.playSelected);
    if (window.pausePlaying && window.playSelected) {
      // Check if sound exists in shared state
      if (window.electronAPI && window.electronAPI.store) {
        // For now, just call playSelected since we can't easily check sound state
        window.playSelected();
      } else {
        window.playSelected();
      }
    } else {
      console.error('❌ Required functions not available');
    }
  });

  $("#stop_button").click(function (e) {
    console.log('🔍 Stop button clicked');
    console.log('🔍 window.stopPlaying function:', typeof window.stopPlaying);
    if (window.stopPlaying) {
      if (e.shiftKey) {
        window.stopPlaying(true);
      } else {
        window.stopPlaying();
      }
    } else {
      console.error('❌ stopPlaying function not available');
    }
  });

  $("#progress_bar").click(function (e) {
    console.log('🔍 Progress bar clicked');
    var percent = (e.clientX - $(this).offset().left) / $(this).width();
    console.log('🔍 Progress bar click - percent:', percent);
    
    // Get sound from shared state
    if (window.electronAPI && window.electronAPI.store) {
      import('./renderer/modules/shared-state.js').then(sharedStateModule => {
        const sharedState = sharedStateModule.default;
        const sound = sharedState.get('sound');
        if (sound) {
          console.log('🔍 Seeking to position in sound');
          sound.seek(sound.duration() * percent);
        } else {
          console.log('🔍 No sound object found in shared state');
        }
      }).catch(error => {
        console.error('❌ Failed to import shared state:', error);
      });
    }
  });

  $("#waveform").click(function (e) {
    console.log('🔍 Waveform clicked');
    var percent = (e.clientX - $(this).offset().left) / $(this).width();
    console.log('🔍 Waveform click - percent:', percent);
    
    // Get sound from shared state
    if (window.electronAPI && window.electronAPI.store) {
      import('./renderer/modules/shared-state.js').then(sharedStateModule => {
        const sharedState = sharedStateModule.default;
        const sound = sharedState.get('sound');
        if (sound) {
          console.log('🔍 Seeking to position in sound');
          sound.seek(sound.duration() * percent);
        } else {
          console.log('🔍 No sound object found in shared state');
        }
      }).catch(error => {
        console.error('❌ Failed to import shared state:', error);
      });
    }
  });

  $("#volume").on("change", function () {
    console.log('🔍 Volume changed');
    var volume = $(this).val() / 100;
    console.log('🔍 New volume:', volume);
    
    // Get sound from shared state
    if (window.electronAPI && window.electronAPI.store) {
      // Import shared state to get sound object
      import('./renderer/modules/shared-state.js').then(sharedStateModule => {
        const sharedState = sharedStateModule.default;
        const sound = sharedState.get('sound');
        if (sound) {
          console.log('🔍 Setting volume on sound object');
          sound.volume(volume);
        } else {
          console.log('🔍 No sound object found in shared state');
        }
      }).catch(error => {
        console.error('❌ Failed to import shared state:', error);
      });
    }
  });

  $("#mute_button").click(function () {
    console.log('🔍 Mute button clicked');
    
    // Get sound from shared state
    if (window.electronAPI && window.electronAPI.store) {
      import('./renderer/modules/shared-state.js').then(sharedStateModule => {
        const sharedState = sharedStateModule.default;
        const sound = sharedState.get('sound');
        if (sound) {
          console.log('🔍 Toggling mute on sound object');
          sound.mute(!sound.mute());
          sound.volume($("#volume").val() / 100);
        } else {
          console.log('🔍 No sound object found in shared state');
        }
      }).catch(error => {
        console.error('❌ Failed to import shared state:', error);
      });
    }
    
    // Toggle UI state
    $("#mute_button").toggleClass("active");
    $("#song_now_playing").toggleClass("text-secondary");
  });

  $("#loop_button").click(function () {
    console.log('🔍 Loop button clicked');
    console.log('🔍 window.loop_on function:', typeof window.loop_on);
    
    if (window.loop_on) {
      // Get current loop state from shared state
      if (window.electronAPI && window.electronAPI.store) {
        import('./renderer/modules/shared-state.js').then(sharedStateModule => {
          const sharedState = sharedStateModule.default;
          const currentLoop = sharedState.get('loop');
          const newLoop = !currentLoop;
          
          console.log('🔍 Toggling loop state:', currentLoop, '->', newLoop);
          sharedState.set('loop', newLoop);
          window.loop_on(newLoop);
        }).catch(error => {
          console.error('❌ Failed to import shared state:', error);
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
      console.error('❌ loop_on function not available');
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
      window.electronAPI.store.get("fade_out_seconds")
    ]).then(([dbDir, musicDir, hotkeyDir, fadeSeconds]) => {
      if (dbDir.success) $("#preferences-database-directory").val(dbDir.value);
      if (musicDir.success) $("#preferences-song-directory").val(musicDir.value);
      if (hotkeyDir.success) $("#preferences-hotkey-directory").val(hotkeyDir.value);
      if (fadeSeconds.success) $("#preferences-fadeout-seconds").val(fadeSeconds.value);
    }).catch(error => {
      console.warn('Failed to load preferences:', error);
      // Fallback to legacy store access
      $("#preferences-database-directory").val(store.get("database_directory"));
      $("#preferences-song-directory").val(store.get("music_directory"));
      $("#preferences-hotkey-directory").val(store.get("hotkey_directory"));
      $("#preferences-fadeout-seconds").val(store.get("fade_out_seconds"));
    });
  });

  $(window).on("resize", function () {
    this.scale_scrollable();
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
        console.warn('❌ Failed to get song count:', result.error);
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
      console.warn('❌ Database API error:', error);
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

