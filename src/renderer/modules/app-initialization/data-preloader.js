// Data Preloader Module
// Extracted from renderer.js lines 195-296 for app-initialization module

// Import secure adapters
import { secureStore } from '../adapters/secure-adapter.js';

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
      const hasHoldingTank = await secureStore.has("holding_tank");
      if (hasHoldingTank) {
        await secureStore.delete("holding_tank");
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
      const hasHotkeys = await secureStore.has("hotkeys");
      if (hasHotkeys) {
        const storedHotkeysHtml = await secureStore.get("hotkeys");
        
        // Check if the stored HTML contains the old plain text header
        if (
          storedHotkeysHtml && typeof storedHotkeysHtml === 'string' &&
          storedHotkeysHtml.includes("Hotkeys") &&
          !storedHotkeysHtml.includes("header-button")
        ) {
          // This is the old HTML format, clear it so the new HTML loads
          await secureStore.delete("hotkeys");
          this.logInfo("Cleared old hotkeys HTML format");
        } else if (storedHotkeysHtml && typeof storedHotkeysHtml === 'string') {
          const col = document.getElementById('hotkeys-column');
          if (col) {
            col.innerHTML = storedHotkeysHtml;
            document.getElementById('selected_row')?.removeAttribute('id');
            this.logInfo("Loaded hotkeys from store");
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
      this.logInfo('Loading column order from store...');
      const hasColumnOrder = await secureStore.has("column_order");
      this.logInfo(`Column order exists in store: ${hasColumnOrder}`);
      
      if (hasColumnOrder) {
        const columnOrderData = await secureStore.get("column_order");
        this.logInfo(`Retrieved column order from store:`, columnOrderData);
        
        // Handle both wrapped format {success: true, value: [...]} and direct array format [...]
        let columnOrder = null;
        if (columnOrderData && typeof columnOrderData === 'object') {
          if (Array.isArray(columnOrderData)) {
            // Direct array format
            columnOrder = columnOrderData;
          } else if (columnOrderData.value && Array.isArray(columnOrderData.value)) {
            // Wrapped format {success: true, value: [...]}
            columnOrder = columnOrderData.value;
          }
        }
        
        if (columnOrder && Array.isArray(columnOrder)) {
          const topRow = document.getElementById('top-row');
          if (topRow) {
            this.logInfo('Top row found, applying column order...');
            
            // Log the current order before reordering
            const currentOrder = Array.from(topRow.children).map(el => el.id).filter(id => id && id.includes('-column'));
            this.logInfo(`Current column order before reordering:`, currentOrder);
            
            columnOrder.forEach((val) => {
              const child = topRow.querySelector(`#${val}`);
              if (child) {
                topRow.appendChild(child);
                this.logInfo(`Moved column ${val} to end`);
              } else {
                this.logInfo(`Column ${val} not found in DOM`);
              }
            });
            
            // Log the final order after reordering
            const finalOrder = Array.from(topRow.children).map(el => el.id).filter(id => id && id.includes('-column'));
            this.logInfo(`Final column order after reordering:`, finalOrder);
            
            this.logInfo("Applied column order from store");
            
            // Add a small delay to ensure the column order is not overridden
            // by other initialization processes that might manipulate the DOM
            setTimeout(() => {
              // Verify the final order after the delay
              const verifiedOrder = Array.from(topRow.children).map(el => el.id).filter(id => id && id.includes('-column'));
              this.logInfo(`Verified column order after delay:`, verifiedOrder);
              
              // Refresh column drop zones after reordering
              // This ensures drop zones are positioned correctly after column order is restored
              if (window.refreshColumnDropZones && typeof window.refreshColumnDropZones === 'function') {
                this.logInfo('Refreshing column drop zones...');
                window.refreshColumnDropZones();
                this.logInfo('Column drop zones refreshed');
              } else {
                this.logWarn('refreshColumnDropZones function not available');
              }
            }, 100);
          } else {
            this.logWarn('Top row not found, cannot apply column order');
          }
        } else {
          this.logWarn('Column order is not a valid array:', columnOrderData);
        }
      } else {
        this.logInfo('No saved column order found in store');
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
      const hasFontSize = await secureStore.has("font-size");
      if (hasFontSize) {
        const size = await secureStore.get("font-size");
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
      const col = document.getElementById('holding-tank-column');
      const currentHtml = col ? col.innerHTML : '';
      if (currentHtml && currentHtml.includes("mode-toggle")) {
        secureStore.set("holding_tank", currentHtml);
        this.logInfo("Saved holding tank to store");
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
      const col = document.getElementById('hotkeys-column');
      const currentHtml = col ? col.innerHTML : '';
      if (currentHtml && currentHtml.includes("header-button")) {
        secureStore.set("hotkeys", currentHtml);
        this.logInfo("Saved hotkeys to store");
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
      this.logInfo('🚀 Initializing DOM-dependent data...');
      
      // Re-run data loading that requires DOM elements
      this.logInfo('📊 Loading hotkeys...');
      await this.loadHotkeys();
      
      this.logInfo('📐 Loading column order...');
      await this.loadColumnOrder();
      
      // Make save functions available globally
      this.logInfo('🔧 Setting up global save functions...');
      window.saveHoldingTankToStore = this.saveHoldingTankToStore.bind(this);
      window.saveHotkeysToStore = this.saveHotkeysToStore.bind(this);
      
      this.logInfo('✅ DOM-dependent data initialization completed');
    } catch (error) {
      this.logError('❌ Error initializing DOM-dependent data', error);
      throw error; // Re-throw to ensure the error is visible
    }
  }

  // Logging helper methods that use debug logger setup if available
  logInfo(message, context = null) {
    if (this.debugLoggerSetup) {
      this.debugLoggerSetup.logInfo(message, context);
    } else if (typeof window?.logInfo === 'function') {
      window.logInfo(message, context);
    }
  }

  logDebug(message, context = null) {
    if (this.debugLoggerSetup) {
      this.debugLoggerSetup.logDebug(message, context);
    } else if (typeof window?.logDebug === 'function') {
      window.logDebug(message, context);
    }
  }

  logWarn(message, context = null) {
    if (this.debugLoggerSetup) {
      this.debugLoggerSetup.logWarn(message, context);
    } else if (typeof window?.logWarn === 'function') {
      window.logWarn(message, context);
    }
  }

  logError(message, context = null) {
    if (this.debugLoggerSetup) {
      this.debugLoggerSetup.logError(message, context);
    } else if (typeof window?.logError === 'function') {
      window.logError(message, context);
    }
  }
}

// Export default instance for immediate use
export { DataPreloader as default };
