// Data Preloader Module
// Extracted from renderer.js lines 195-296 for app-initialization module

/**
 * Data Preloader class for loading initial application data
 * Handles loading data from electron store, HTML initialization, and legacy compatibility
 */
export class DataPreloader {
  constructor(debugLoggerSetup = null) {
    this.debugLoggerSetup = debugLoggerSetup;
  }

  /**
   * Load all initial data from electron store
   * @returns {Promise<boolean>} Success status
   */
  async loadInitialData() {
    try {
      this.logInfo('Starting initial data loading...');
      
      // Clear holding tank store to ensure we load new HTML
      await this.clearHoldingTankStore();
      
      // Load hotkeys data
      await this.loadHotkeys();
      
      // Load column order
      await this.loadColumnOrder();
      
      // Load font size
      await this.loadFontSize();
      
      this.logInfo('Initial data loading completed successfully');
      return true;
    } catch (error) {
      this.logError('Error during initial data loading', error);
      return false;
    }
  }

  /**
   * Clear holding tank store to ensure we load new HTML
   * @returns {Promise<void>}
   */
  async clearHoldingTankStore() {
    try {
      const hasHoldingTank = await window.electronAPI.store.has("holding_tank");
      if (hasHoldingTank) {
        await window.electronAPI.store.delete("holding_tank");
        this.logInfo("Cleared holding tank store to load new HTML");
      }
    } catch (error) {
      this.logError('Error clearing holding tank store', error);
    }
  }

  /**
   * Load hotkeys from electron store
   * @returns {Promise<void>}
   */
  async loadHotkeys() {
    try {
      const hasHotkeys = await window.electronAPI.store.has("hotkeys");
      if (hasHotkeys) {
        const storedHotkeysHtml = await window.electronAPI.store.get("hotkeys");
        
        // Check if the stored HTML contains the old plain text header
        if (
          storedHotkeysHtml && typeof storedHotkeysHtml === 'string' &&
          storedHotkeysHtml.includes("Hotkeys") &&
          !storedHotkeysHtml.includes("header-button")
        ) {
          // This is the old HTML format, clear it so the new HTML loads
          await window.electronAPI.store.delete("hotkeys");
          this.logInfo("Cleared old hotkeys HTML format");
        } else if (storedHotkeysHtml && typeof storedHotkeysHtml === 'string') {
          // Check if jQuery is available and DOM is ready
          if (typeof $ !== 'undefined' && document.getElementById('hotkeys-column')) {
            $("#hotkeys-column").html(storedHotkeysHtml);
            $("#selected_row").removeAttr("id");
            this.logInfo("Loaded hotkeys from store");
          } else {
            this.logWarn("jQuery or hotkeys-column element not available for hotkeys loading");
          }
        }
      }
    } catch (error) {
      this.logError('Error loading hotkeys', error);
    }
  }

  /**
   * Load column order from electron store
   * @returns {Promise<void>}
   */
  async loadColumnOrder() {
    try {
      const hasColumnOrder = await window.electronAPI.store.has("column_order");
      if (hasColumnOrder) {
        const columnOrder = await window.electronAPI.store.get("column_order");
        if (columnOrder && Array.isArray(columnOrder)) {
          // Check if jQuery and DOM elements are available
          if (typeof $ !== 'undefined' && document.getElementById('top-row')) {
            columnOrder.forEach(function (val) {
              $("#top-row").append($("#top-row").children(`#${val}`).detach());
            });
            this.logInfo("Applied column order from store");
          } else {
            this.logWarn("jQuery or top-row element not available for column order");
          }
        }
      }
    } catch (error) {
      this.logError('Error loading column order', error);
    }
  }

  /**
   * Load font size from electron store
   * @returns {Promise<void>}
   */
  async loadFontSize() {
    try {
      const hasFontSize = await window.electronAPI.store.has("font-size");
      if (hasFontSize) {
        const size = await window.electronAPI.store.get("font-size");
        if (size !== undefined && size !== null) {
          // Font size is now managed by shared state
          // This is kept for backward compatibility but doesn't set moduleRegistry.fontSize
          this.logInfo(`Font size loaded from store: ${size}`);
        }
      }
    } catch (error) {
      this.logError('Error loading font size', error);
    }
  }

  /**
   * Save holding tank to store utility function
   * @returns {void}
   */
  saveHoldingTankToStore() {
    try {
      // Only save if we have the new HTML format with mode toggle
      if (typeof $ !== 'undefined' && document.getElementById('holding-tank-column')) {
        const currentHtml = $("#holding-tank-column").html();
        if (currentHtml && currentHtml.includes("mode-toggle")) {
          window.electronAPI.store.set("holding_tank", currentHtml);
          this.logInfo("Saved holding tank to store");
        }
      }
    } catch (error) {
      this.logError('Error saving holding tank to store', error);
    }
  }

  /**
   * Save hotkeys to store utility function
   * @returns {void}
   */
  saveHotkeysToStore() {
    try {
      // Only save if we have the new HTML format with header button
      if (typeof $ !== 'undefined' && document.getElementById('hotkeys-column')) {
        const currentHtml = $("#hotkeys-column").html();
        if (currentHtml && currentHtml.includes("header-button")) {
          window.electronAPI.store.set("hotkeys", currentHtml);
          this.logInfo("Saved hotkeys to store");
        }
      }
    } catch (error) {
      this.logError('Error saving hotkeys to store', error);
    }
  }

  /**
   * Initialize DOM-dependent data loading when DOM is ready
   * This should be called after DOM is fully loaded
   * @returns {Promise<void>}
   */
  async initializeDOMDependentData() {
    try {
      this.logInfo('Initializing DOM-dependent data...');
      
      // Re-run data loading that requires DOM elements
      await this.loadHotkeys();
      await this.loadColumnOrder();
      
      // Make save functions available globally
      window.saveHoldingTankToStore = this.saveHoldingTankToStore.bind(this);
      window.saveHotkeysToStore = this.saveHotkeysToStore.bind(this);
      
      this.logInfo('DOM-dependent data initialization completed');
    } catch (error) {
      this.logError('Error initializing DOM-dependent data', error);
    }
  }

  // Logging helper methods that use debug logger setup if available
  logInfo(message, context = null) {
    if (this.debugLoggerSetup) {
      this.debugLoggerSetup.logInfo(message, context);
    } else {
      console.log(`ℹ️ ${message}`, context);
    }
  }

  logDebug(message, context = null) {
    if (this.debugLoggerSetup) {
      this.debugLoggerSetup.logDebug(message, context);
    } else {
      console.log(`🐛 ${message}`, context);
    }
  }

  logWarn(message, context = null) {
    if (this.debugLoggerSetup) {
      this.debugLoggerSetup.logWarn(message, context);
    } else {
      console.warn(`⚠️ ${message}`, context);
    }
  }

  logError(message, context = null) {
    if (this.debugLoggerSetup) {
      this.debugLoggerSetup.logError(message, context);
    } else {
      console.error(`❌ ${message}`, context);
    }
  }
}

// Export default instance for immediate use
export { DataPreloader as default };
