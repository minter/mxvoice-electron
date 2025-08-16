/**
 * Function Monitor
 * 
 * Provides real-time monitoring of function availability and health checking
 * for the MxVoice Electron application.
 */

class FunctionMonitor {
  constructor(functionRegistry, debugLogger = null) {
    this.functionRegistry = functionRegistry;
    this.debugLog = debugLogger;
    this.monitoring = false;
    this.healthChecks = new Map();
    this.availabilityHistory = new Map();
    this.criticalFunctions = [
      'playSongFromId', 'stopPlaying', 'searchData', 'populateCategorySelect',
      'openHotkeyFile', 'saveHotkeyFile', 'openHoldingTankFile', 'saveHoldingTankFile'
    ];
  }

  // Set debug logger after initialization
  setDebugLogger(debugLogger) {
    if (!debugLogger) {
      throw new Error('FunctionMonitor requires a valid debug logger');
    }
    this.debugLog = debugLogger;
    this.debugLog.info('FunctionMonitor debug logger set', { 
      function: "setDebugLogger" 
    });
  }

  // Ensure debug logger is available before use
  ensureDebugLogger() {
    if (!this.debugLog) {
      throw new Error('DebugLogger not initialized. FunctionMonitor requires DebugLogger to be available.');
    }
  }

  /**
   * Start monitoring function availability
   */
  startMonitoring() {
    this.ensureDebugLogger();
    
    if (this.monitoring) {
      this.debugLog.warn('Function monitoring already active', { function: "startMonitoring" });
      return;
    }

    this.debugLog.info('Starting function availability monitoring...', { function: "startMonitoring" });
    this.monitoring = true;

    // Initial health check
    this.performHealthCheck();

    // Set up periodic health checks
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000); // Check every 30 seconds

    // Monitor for function changes
    this.setupFunctionChangeMonitoring();

    debugLog.info('Function monitoring started', { function: "startMonitoring" });
  }

  /**
   * Stop monitoring function availability
   */
  stopMonitoring() {
    if (!this.monitoring) {
      debugLog.warn('Function monitoring not active', { function: "stopMonitoring" });
      return;
    }

    debugLog.info('Stopping function availability monitoring...', { function: "stopMonitoring" });
    this.monitoring = false;

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    debugLog.info('Function monitoring stopped', { function: "stopMonitoring" });
  }

  /**
   * Perform a comprehensive health check
   */
  performHealthCheck() {
    const healthReport = {
      timestamp: new Date().toISOString(),
      criticalFunctions: {},
      moduleFunctions: {},
      overallHealth: 'healthy',
      issues: []
    };

    // Check critical functions
    this.criticalFunctions.forEach(funcName => {
      const isAvailable = typeof window[funcName] === 'function';
      healthReport.criticalFunctions[funcName] = {
        available: isAvailable,
        type: typeof window[funcName]
      };

      if (!isAvailable) {
        healthReport.overallHealth = 'degraded';
        healthReport.issues.push(`Critical function ${funcName} is not available`);
      }
    });

    // Check module functions
    if (this.functionRegistry && this.functionRegistry.moduleRegistry) {
      Object.keys(this.functionRegistry.moduleRegistry).forEach(moduleName => {
        const module = this.functionRegistry.moduleRegistry[moduleName];
        const moduleFunctions = this.getModuleFunctions(moduleName);
        
        healthReport.moduleFunctions[moduleName] = {
          available: !!module,
          functionCount: moduleFunctions.length,
          functions: moduleFunctions.map(fn => ({
            name: fn,
            available: typeof window[fn] === 'function'
          }))
        };
      });
    }

    // Store health check history
    this.healthChecks.set(healthReport.timestamp, healthReport);

    // Log health report
    this.logHealthReport(healthReport);

    return healthReport;
  }

  /**
   * Get functions for a specific module
   */
  getModuleFunctions(moduleName) {
    const moduleFunctionMappings = {
      audio: ['playSongFromId', 'stopPlaying', 'pausePlaying', 'resetUIState', 'autoplay_next', 'cancel_autoplay', 'playSelected', 'loop_on'],
      fileOperations: ['openHotkeyFile', 'openHoldingTankFile', 'saveHotkeyFile', 'saveHoldingTankFile', 'pickDirectory', 'installUpdate'],
      ui: ['scaleScrollable', 'editSelectedSong', 'deleteSelectedSong', 'closeAllTabs', 'toggleSelectedRow', 'switchToHotkeyTab', 'increaseFontSize', 'decreaseFontSize', 'toggleWaveform', 'getFontSize', 'setFontSize'],
      search: ['searchData', 'performLiveSearch', 'triggerLiveSearch', 'clearSearchResults', 'buildSearchQuery'],
      database: ['addToHoldingTank', 'populateHoldingTank'],
      utils: ['animateCSS', 'customConfirm', 'customPrompt', 'restoreFocusToSearch', 'isValidSongId', 'isValidCategoryCode', 'isValidFilePath', 'isValidHotkey'],
              preferences: ['openPreferencesModal', 'loadPreferences', 'savePreferences', 'getPreference', 'setPreference', 'getDatabaseDirectory', 'getMusicDirectory', 'getHotkeyDirectory', 'getFadeOutSeconds', 'getPrereleaseUpdates', 'getScreenMode'],
              modeManagement: ['setHoldingTankMode', 'getHoldingTankMode', 'toggleAutoPlay', 'getAutoPlayState'],
        themeManagement: ['initThemeManagement', 'setUserTheme', 'getCurrentTheme', 'getUserThemePreference', 'getSystemTheme', 'isDarkTheme', 'isLightTheme', 'isAutoTheme', 'refreshTheme'],
      navigation: ['sendToHotkeys', 'sendToHoldingTank', 'selectNext', 'selectPrev'],
      bulkOperations: ['showBulkAddModal', 'addSongsByPath', 'saveBulkUpload'],
      categories: ['populateCategorySelect', 'openCategoriesModal', 'addNewCategory', 'saveCategories', 'editCategoryUI', 'deleteCategoryUI'],
      hotkeys: ['playSongFromHotkey', 'switchToHotkeyTab', 'populateHotkeys', 'setLabelFromSongId', 'sendToHotkeys', 'hotkeyDrop', 'allowHotkeyDrop', 'removeFromHotkey'],
      holdingTank: ['clearHoldingTank', 'renameHoldingTankTab', 'scale_scrollable', 'saveHoldingTankToStore', 'holdingTankDrop'],
      dragDrop: ['songDrag'],
      songManagement: ['saveEditedSong', 'saveNewSong', 'editSelectedSong', 'deleteSelectedSong', 'deleteSong', 'removeFromHoldingTank', 'removeFromHotkey']
    };

    return moduleFunctionMappings[moduleName] || [];
  }

  /**
   * Log health report with appropriate formatting
   */
  logHealthReport(report) {
    const status = report.overallHealth === 'healthy' ? '✅' : '⚠️';
    debugLog.info(`${status} Function Health Check - ${report.overallHealth.toUpperCase()}`, { 
      function: "logHealthReport",
      data: { overallHealth: report.overallHealth }
    });

    if (report.issues.length > 0) {
      debugLog.warn('Issues detected:', { 
        function: "logHealthReport",
        data: { issues: report.issues }
      });
    }

    // Log critical function status
    const criticalStatus = Object.entries(report.criticalFunctions)
      .map(([func, status]) => `${func}: ${status.available ? '✅' : '❌'}`)
      .join(', ');
    debugLog.info(`Critical Functions: ${criticalStatus}`, { 
      function: "logHealthReport",
      data: { criticalFunctions: report.criticalFunctions }
    });

    // Log module health summary
    const moduleSummary = Object.entries(report.moduleFunctions)
      .map(([module, status]) => `${module}: ${status.available ? '✅' : '❌'} (${status.functionCount} functions)`)
      .join(', ');
    debugLog.info(`Module Health: ${moduleSummary}`, { 
      function: "logHealthReport",
      data: { moduleFunctions: report.moduleFunctions }
    });
  }

  /**
   * Setup monitoring for function changes
   */
  setupFunctionChangeMonitoring() {
    // Monitor for function additions/removals
    const originalWindow = { ...window };
    
    setInterval(() => {
      const currentFunctions = Object.keys(window).filter(key => typeof window[key] === 'function');
      const originalFunctions = Object.keys(originalWindow).filter(key => typeof originalWindow[key] === 'function');
      
      const newFunctions = currentFunctions.filter(fn => !originalFunctions.includes(fn));
      const removedFunctions = originalFunctions.filter(fn => !currentFunctions.includes(fn));
      
      if (newFunctions.length > 0) {
        debugLog.info('New functions detected:', { 
          function: "setupFunctionChangeMonitoring",
          data: { newFunctions }
        });
      }
      
      if (removedFunctions.length > 0) {
        debugLog.warn('Functions removed:', { 
          function: "setupFunctionChangeMonitoring",
          data: { removedFunctions }
        });
      }
    }, 10000); // Check every 10 seconds
  }

  /**
   * Get monitoring statistics
   */
  getStats() {
    const latestHealthCheck = Array.from(this.healthChecks.values()).pop();
    
    return {
      monitoring: this.monitoring,
      healthChecksPerformed: this.healthChecks.size,
      latestHealthStatus: latestHealthCheck?.overallHealth || 'unknown',
      criticalFunctionsCount: this.criticalFunctions.length,
      criticalFunctionsAvailable: this.criticalFunctions.filter(fn => typeof window[fn] === 'function').length,
      totalFunctionsAvailable: Object.keys(window).filter(key => typeof window[key] === 'function').length
    };
  }

  /**
   * Get detailed health report
   */
  getDetailedHealthReport() {
    const latestHealthCheck = Array.from(this.healthChecks.values()).pop();
    return {
      current: latestHealthCheck,
      history: Array.from(this.healthChecks.values()).slice(-5), // Last 5 health checks
      stats: this.getStats()
    };
  }

  /**
   * Check if a specific function is available
   */
  isFunctionAvailable(functionName) {
    return typeof window[functionName] === 'function';
  }

  /**
   * Get all available functions
   */
  getAvailableFunctions() {
    return Object.keys(window).filter(key => typeof window[key] === 'function');
  }

  /**
   * Get missing critical functions
   */
  getMissingCriticalFunctions() {
    return this.criticalFunctions.filter(func => !this.isFunctionAvailable(func));
  }
}

export default FunctionMonitor; 