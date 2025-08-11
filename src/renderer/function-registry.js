/**
 * Centralized Function Registry
 * 
 * Manages all global function assignments to prevent window pollution
 * and provide consistent error handling.
 */

// DebugLog will be accessed when needed

class FunctionRegistry {
  constructor(debugLogger = null) {
    this.registry = new Map();
    this.fallbacks = new Map();
    this.moduleRegistry = null;
    this.registeredFunctions = new Set();
    this.debugLog = debugLogger;
  }

  // Set debug logger after initialization
  setDebugLogger(debugLogger) {
    if (!debugLogger) {
      throw new Error('FunctionRegistry requires a valid debug logger');
    }
    this.debugLog = debugLogger;
    this.debugLog.info('FunctionRegistry debug logger set', { 
      function: "setDebugLogger" 
    });
  }

  // Ensure debug logger is available before use
  ensureDebugLogger() {
    if (!this.debugLog) {
      throw new Error('DebugLogger not initialized. FunctionRegistry requires DebugLogger to be available.');
    }
  }

  setModuleRegistry(moduleRegistry) {
    this.moduleRegistry = moduleRegistry;
  }

  // Register a function with optional fallback
  register(name, fn, fallback = null) {
    this.ensureDebugLogger();
    
    this.registry.set(name, fn);
    this.registeredFunctions.add(name);
    
    if (fallback) {
      this.fallbacks.set(name, fallback);
    }
    
    // Only assign to window if not already present
    if (!window[name]) {
      window[name] = fn;
      this.debugLog.info(`Registered function: ${name}`, { 
        function: "register",
        data: { functionName: name }
      });
    } else {
      this.debugLog.warn(`Function ${name} already exists on window, skipping`, { 
        function: "register",
        data: { functionName: name }
      });
    }
  }

  // Register multiple functions from a module
  registerModule(moduleName, functions) {
    this.ensureDebugLogger();
    
    this.debugLog.info(`Registering functions for module: ${moduleName}`, { 
      function: "registerModule",
      data: { moduleName, functionCount: Object.keys(functions).length }
    });
    
    if (!this.moduleRegistry || !this.moduleRegistry[moduleName]) {
      this.debugLog.warn(`Module ${moduleName} not available, using fallbacks`, { 
        function: "registerModule",
        data: { moduleName }
      });
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
        this.debugLog.warn(`Function ${fnPath} not found in module ${moduleName}`, { 
          function: "registerModule",
          data: { moduleName, functionPath: fnPath, functionName: name }
        });
        if (fallback) {
          this.register(name, fallback, fallback);
        }
      }
    });
  }

  // Register functions from a module-specific registry
  async registerModuleFromRegistry(moduleName, registryName) {
    this.debugLog.info(`Registering functions for module: ${moduleName} using registry: ${registryName}`, { 
      function: "registerModuleFromRegistry",
      data: { moduleName, registryName }
    });
    
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
        this.debugLog.warn(`Registry ${registryName} not found for module ${moduleName}`, { 
          function: "registerModuleFromRegistry",
          data: { moduleName, registryName }
        });
      }
    } catch (error) {
      this.debugLog.warn(`Failed to load registry for module ${moduleName}`, { 
        function: "registerModuleFromRegistry",
        data: { moduleName, registryName },
        error: error.message
      });
      // Fall back to inline registration if registry fails to load
      this.registerModuleInline(moduleName);
    }
  }

  // Fallback inline registration for modules without specific registries
  registerModuleInline(moduleName) {
    this.debugLog.info(`Using inline registration for module: ${moduleName}`, { 
      function: "registerModuleInline",
      data: { moduleName }
    });
    
    // Define inline function mappings for modules without specific registries
    const inlineMappings = {
      fileOperations: {
        openHotkeyFile: 'openHotkeyFile',
        openHoldingTankFile: 'openHoldingTankFile',
        saveHotkeyFile: 'saveHotkeyFile',
        saveHoldingTankFile: 'saveHoldingTankFile',
        pickDirectory: 'pickDirectory',
        installUpdate: 'installUpdate',
              openHotkeyFileFallback: () => this.debugLog.warn('File operations not available', { function: 'fileOperationsFallback' }),
      openHoldingTankFileFallback: () => this.debugLog.warn('File operations not available', { function: 'fileOperationsFallback' }),
      saveHotkeyFileFallback: () => this.debugLog.warn('File operations not available', { function: 'fileOperationsFallback' }),
      saveHoldingTankFileFallback: () => this.debugLog.warn('File operations not available', { function: 'fileOperationsFallback' }),
      pickDirectoryFallback: () => this.debugLog.warn('File operations not available', { function: 'fileOperationsFallback' }),
      installUpdateFallback: () => this.debugLog.warn('File operations not available', { function: 'fileOperationsFallback' })
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
        closeAllTabs: 'closeAllTabs',
        toggleSelectedRow: 'toggleSelectedRow',
        renameHotkeyTab: 'renameHotkeyTabWrapper',
        renameHoldingTankTab: 'renameHoldingTankTabUIWrapper',
        increaseFontSize: 'increaseFontSize',
        decreaseFontSize: 'decreaseFontSize',
        toggleWaveform: 'toggleWaveform',
        pickDirectory: 'pickDirectory',
        installUpdate: 'installUpdate',
        getFontSize: 'getFontSize',
        setFontSize: 'setFontSize'
      }
    };
    
    const mapping = inlineMappings[moduleName];
    if (mapping) {
      this.registerModule(moduleName, mapping);
    } else {
            this.debugLog.warn(`No inline mapping available for module: ${moduleName}`, {
        function: "registerModuleInline",
        data: { moduleName }
      });
    }
  }

  // Get function from dot notation path (e.g., "audio.playSongFromId")
  getFunctionFromPath(obj, path) {
    const fn = path.split('.').reduce((current, key) => {
      return current && current[key];
    }, obj);
    
    // If the function exists and the object is a class instance, bind it
    if (fn && typeof fn === 'function' && obj && typeof obj === 'object') {
      return fn.bind(obj);
    }
    
    return fn;
  }

  // Register all HTML-compatible functions
  async registerAllFunctions() {
    this.ensureDebugLogger();
    
    this.debugLog.info('Starting function registration...', { 
      function: "registerAllFunctions" 
    });
    
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
      saveEditedSongFallback: () => this.debugLog.warn('Song management not available', { function: 'songManagementFallback' }),
      saveNewSongFallback: () => this.debugLog.warn('Song management not available', { function: 'songManagementFallback' }),
      editSelectedSongFallback: () => this.debugLog.warn('Song management not available', { function: 'songManagementFallback' }),
      deleteSelectedSongFallback: () => this.debugLog.warn('Song management not available', { function: 'songManagementFallback' }),
      deleteSongFallback: () => this.debugLog.warn('Song management not available', { function: 'songManagementFallback' }),
      removeFromHoldingTankFallback: () => this.debugLog.warn('Song management not available', { function: 'songManagementFallback' })
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
      addToHoldingTank: 'addToHoldingTank',
      populateHoldingTank: 'populateHoldingTank'
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
      populateHotkeys: 'populateHotkeysWrapper',
      clearHotkeys: 'clearHotkeysWrapper',
      renameHotkeyTab: 'renameHotkeyTabWrapper',
      setLabelFromSongId: 'setLabelFromSongId',
      sendToHotkeys: 'sendToHotkeys',
      hotkeyDrop: 'hotkeyDrop',
      allowHotkeyDrop: 'allowHotkeyDrop',
      removeFromHotkey: 'removeFromHotkey'
    });

    // Holding Tank Functions
    this.registerModule('holdingTank', {
      clearHoldingTank: 'clearHoldingTankWrapper',
      renameHoldingTankTab: 'renameHoldingTankTabWrapper',
      scale_scrollable: 'scale_scrollable',
      saveHoldingTankToStore: 'saveHoldingTankToStoreWrapper',
      holdingTankDrop: 'holdingTankDrop'
    });

    // Drag Drop Functions
    this.registerModule('dragDrop', {
      songDrag: 'songDrag',
      columnDrag: 'columnDrag'
    });

    this.debugLog.info('Function registration completed', { 
      function: "registerAllFunctions" 
    });
  }

  // Validate all required functions are available
  validateFunctions() {
    const requiredFunctions = [
      'playSongFromId', 'stopPlaying', 'searchData', 'populateCategorySelect',
      'openHotkeyFile', 'saveHotkeyFile', 'openHoldingTankFile', 'saveHoldingTankFile'
    ];

    const missing = requiredFunctions.filter(fn => !window[fn]);
    if (missing.length > 0) {
      this.debugLog.warn('Missing required functions', { 
        function: "validateFunctions",
        data: { missingFunctions: missing }
      });
      return false;
    }
    
    this.debugLog.info('All required functions are available', { 
      function: "validateFunctions",
      data: { requiredFunctions }
    });
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