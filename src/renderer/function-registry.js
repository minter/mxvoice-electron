/**
 * Centralized Function Registry
 * 
 * Manages all global function assignments to prevent window pollution
 * and provide consistent error handling.
 */

class FunctionRegistry {
  constructor() {
    this.registry = new Map();
    this.fallbacks = new Map();
    this.moduleRegistry = null;
    this.registeredFunctions = new Set();
  }

  setModuleRegistry(moduleRegistry) {
    this.moduleRegistry = moduleRegistry;
  }

  // Register a function with optional fallback
  register(name, fn, fallback = null) {
    this.registry.set(name, fn);
    this.registeredFunctions.add(name);
    
    if (fallback) {
      this.fallbacks.set(name, fallback);
    }
    
    // Only assign to window if not already present
    if (!window[name]) {
      window[name] = fn;
      console.log(`✅ Registered function: ${name}`);
    } else {
      console.log(`⚠️ Function ${name} already exists on window, skipping`);
    }
  }

  // Register multiple functions from a module
  registerModule(moduleName, functions) {
    console.log(`🔄 Registering functions for module: ${moduleName}`);
    
    if (!this.moduleRegistry || !this.moduleRegistry[moduleName]) {
      console.warn(`⚠️ Module ${moduleName} not available, using fallbacks`);
      Object.entries(functions).forEach(([name, fallback]) => {
        if (typeof fallback === 'function') {
          this.register(name, fallback, fallback);
        }
      });
      return;
    }

    const module = this.moduleRegistry[moduleName];
    Object.entries(functions).forEach(([name, fnPath]) => {
      // Skip fallback entries, they're handled separately
      if (typeof fnPath === 'string' && fnPath.endsWith('Fallback')) {
        return;
      }
      
      // Handle different types of function paths
      let fn = null;
      if (typeof fnPath === 'string') {
        fn = this.getFunctionFromPath(module, fnPath);
      } else if (typeof fnPath === 'function') {
        fn = fnPath;
      }
      
      const fallbackKey = `${name}Fallback`;
      const fallback = functions[fallbackKey];
      
      if (fn) {
        this.register(name, fn, fallback);
      } else {
        console.warn(`⚠️ Function ${fnPath} not found in module ${moduleName}`);
        if (fallback) {
          this.register(name, fallback, fallback);
        }
      }
    });
  }

  // Register functions from a module-specific registry
  async registerModuleFromRegistry(moduleName, registryName) {
    console.log(`🔄 Registering functions for module: ${moduleName} using registry: ${registryName}`);
    
    try {
      // Import the module-specific registry
      // Convert camelCase module name to kebab-case for directory path
      const directoryName = moduleName.replace(/([A-Z])/g, '-$1').toLowerCase();
      const registryPath = `./modules/${directoryName}/function-registry.js`;
      const registryModule = await import(registryPath);
      const functions = registryModule.default || registryModule[registryName];
      
      if (functions) {
        this.registerModule(moduleName, functions);
      } else {
        console.warn(`⚠️ Registry ${registryName} not found for module ${moduleName}`);
      }
    } catch (error) {
      console.warn(`⚠️ Failed to load registry for module ${moduleName}:`, error);
      // Fall back to inline registration if registry fails to load
      this.registerModuleInline(moduleName);
    }
  }

  // Fallback inline registration for modules without specific registries
  registerModuleInline(moduleName) {
    console.log(`🔄 Using inline registration for module: ${moduleName}`);
    
    // Define inline function mappings for modules without specific registries
    const inlineMappings = {
      fileOperations: {
        openHotkeyFile: 'openHotkeyFile',
        openHoldingTankFile: 'openHoldingTankFile',
        saveHotkeyFile: 'saveHotkeyFile',
        saveHoldingTankFile: 'saveHoldingTankFile',
        pickDirectory: 'pickDirectory',
        installUpdate: 'installUpdate',
        openHotkeyFileFallback: () => console.warn('⚠️ File operations not available'),
        openHoldingTankFileFallback: () => console.warn('⚠️ File operations not available'),
        saveHotkeyFileFallback: () => console.warn('⚠️ File operations not available'),
        saveHoldingTankFileFallback: () => console.warn('⚠️ File operations not available'),
        pickDirectoryFallback: () => console.warn('⚠️ File operations not available'),
        installUpdateFallback: () => console.warn('⚠️ File operations not available')
      },
      audio: {
        playSongFromId: 'playSongFromId',
        stopPlaying: 'stopPlaying',
        pausePlaying: 'pausePlaying',
        resetUIState: 'resetUIState',
        autoplay_next: 'autoplay_next',
        cancel_autoplay: 'cancel_autoplay',
        playSelected: 'playSelected',
        loop_on: 'loop_on'
      },
      ui: {
        scaleScrollable: 'scaleScrollable',
        editSelectedSong: 'editSelectedSong',
        deleteSelectedSong: 'deleteSelectedSong',
        closeAllTabs: 'closeAllTabs',
        toggleSelectedRow: 'toggleSelectedRow',
        switchToHotkeyTab: 'switchToHotkeyTab',
        increaseFontSize: 'increaseFontSize',
        decreaseFontSize: 'decreaseFontSize',
        toggleWaveform: 'toggleWaveform',
        getFontSize: 'getFontSize',
        setFontSize: 'setFontSize'
      }
    };
    
    const mapping = inlineMappings[moduleName];
    if (mapping) {
      this.registerModule(moduleName, mapping);
    } else {
      console.warn(`⚠️ No inline mapping available for module: ${moduleName}`);
    }
  }

  // Get function from dot notation path (e.g., "audio.playSongFromId")
  getFunctionFromPath(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key];
    }, obj);
  }

  // Register all HTML-compatible functions
  async registerAllFunctions() {
    console.log('🔄 Starting function registration...');
    
    // Import module-specific function registries
    await this.registerModuleFromRegistry('fileOperations', 'fileOperationsFunctions');
    await this.registerModuleFromRegistry('audio', 'audioFunctions');
    await this.registerModuleFromRegistry('ui', 'uiFunctions');
    
    // Song Management
    this.registerModule('songManagement', {
      saveEditedSong: 'saveEditedSong',
      saveNewSong: 'saveNewSong',
      editSelectedSong: 'editSelectedSong',
      deleteSelectedSong: 'deleteSelectedSong',
      deleteSong: 'deleteSong',
      removeFromHoldingTank: 'removeFromHoldingTank',
      removeFromHotkey: 'removeFromHotkey',
      saveEditedSongFallback: () => console.warn('⚠️ Song management not available'),
      saveNewSongFallback: () => console.warn('⚠️ Song management not available'),
      editSelectedSongFallback: () => console.warn('⚠️ Song management not available'),
      deleteSelectedSongFallback: () => console.warn('⚠️ Song management not available'),
      deleteSongFallback: () => console.warn('⚠️ Song management not available'),
      removeFromHoldingTankFallback: () => console.warn('⚠️ Song management not available'),
      removeFromHotkeyFallback: () => console.warn('⚠️ Song management not available')
    });

    // Search Functions
    this.registerModule('search', {
      searchData: 'searchData',
      performLiveSearch: 'performLiveSearch',
      toggleAdvancedSearch: 'toggleAdvancedSearch',
      triggerLiveSearch: 'triggerLiveSearch',
      clearSearchResults: 'clearSearchResults'
    });

    // Database Functions
    this.registerModule('database', {
      setLabelFromSongId: 'setLabelFromSongId',
      addToHoldingTank: 'addToHoldingTank',
      populateHoldingTank: 'populateHoldingTank',
      populateCategorySelect: 'populateCategorySelect'
    });

    // Utils Functions
    this.registerModule('utils', {
      animateCSS: 'animateCSS',
      customConfirm: 'customConfirm',
      customPrompt: 'customPrompt',
      restoreFocusToSearch: 'restoreFocusToSearch',
      isValidSongId: 'isValidSongId',
      isValidCategoryCode: 'isValidCategoryCode',
      isValidFilePath: 'isValidFilePath',
      isValidHotkey: 'isValidHotkey'
    });

    // Preferences Functions
    this.registerModule('preferences', {
      openPreferencesModal: 'openPreferencesModal',
      loadPreferences: 'loadPreferences',
      savePreferences: 'savePreferences',
      getPreference: 'getPreference',
      setPreference: 'setPreference',
      getDatabaseDirectory: 'getDatabaseDirectory',
      getMusicDirectory: 'getMusicDirectory',
      getHotkeyDirectory: 'getHotkeyDirectory',
      getFadeOutSeconds: 'getFadeOutSeconds'
    });

    // Mode Management Functions
    this.registerModule('modeManagement', {
      setHoldingTankMode: 'setHoldingTankMode',
      getHoldingTankMode: 'getHoldingTankMode',
      toggleAutoPlay: 'toggleAutoPlay',
      getAutoPlayState: 'getAutoPlayState'
    });

    // Navigation Functions
    this.registerModule('navigation', {
      sendToHotkeys: 'sendToHotkeys',
      sendToHoldingTank: 'sendToHoldingTank',
      selectNext: 'selectNext',
      selectPrev: 'selectPrev'
    });

    // Bulk Operations Functions
    this.registerModule('bulkOperations', {
      showBulkAddModal: 'showBulkAddModal',
      addSongsByPath: 'addSongsByPath',
      saveBulkUpload: 'saveBulkUpload'
    });

    // Categories Functions
    this.registerModule('categories', {
      populateCategorySelect: 'populateCategorySelect',
      openCategoriesModal: 'openCategoriesModal',
      addNewCategory: 'addNewCategoryUI',
      saveCategories: 'saveCategories',
      editCategoryUI: 'editCategoryUI',
      deleteCategoryUI: 'deleteCategoryUI'
    });

    // Hotkeys Functions
    this.registerModule('hotkeys', {
      playSongFromHotkey: 'playSongFromHotkey',
      switchToHotkeyTab: 'switchToHotkeyTab',
      populateHotkeys: 'populateHotkeys',
      setLabelFromSongId: 'setLabelFromSongId',
      sendToHotkeys: 'sendToHotkeys',
      hotkeyDrop: 'hotkeyDrop',
      allowHotkeyDrop: 'allowHotkeyDrop',
      removeFromHotkey: 'removeFromHotkey'
    });

    // Holding Tank Functions
    this.registerModule('holdingTank', {
      clearHoldingTank: 'clearHoldingTank',
      renameHoldingTankTab: 'renameHoldingTankTab',
      scale_scrollable: 'scale_scrollable',
      saveHoldingTankToStore: 'saveHoldingTankToStore',
      holdingTankDrop: 'holdingTankDrop'
    });

    // Drag Drop Functions
    this.registerModule('dragDrop', {
      songDrag: 'songDrag',
      columnDrag: 'columnDrag'
    });

    console.log('✅ Function registration completed');
  }

  // Validate all required functions are available
  validateFunctions() {
    const requiredFunctions = [
      'playSongFromId', 'stopPlaying', 'searchData', 'populateCategorySelect',
      'openHotkeyFile', 'saveHotkeyFile', 'openHoldingTankFile', 'saveHoldingTankFile'
    ];

    const missing = requiredFunctions.filter(fn => !window[fn]);
    if (missing.length > 0) {
      console.warn('⚠️ Missing required functions:', missing);
      return false;
    }
    
    console.log('✅ All required functions are available');
    return true;
  }

  // Get list of all registered functions
  getRegisteredFunctions() {
    return Array.from(this.registeredFunctions);
  }

  // Check if a function is registered
  isRegistered(name) {
    return this.registeredFunctions.has(name);
  }

  // Get registry statistics
  getStats() {
    return {
      totalRegistered: this.registeredFunctions.size,
      totalModules: this.moduleRegistry ? Object.keys(this.moduleRegistry).length : 0,
      registeredFunctions: this.getRegisteredFunctions()
    };
  }
}

export default FunctionRegistry; 