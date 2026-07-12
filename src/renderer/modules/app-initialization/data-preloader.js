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
      
      // Load column order
      await this.loadColumnOrder();
      
      // Load font size
      await this.loadFontSize();

      // Load categories
      await this.loadCategories();

      this.logInfo('Initial data loading completed successfully');
      return true;
    } catch (error) {
      this.logError('Error during initial data loading', error);
      return false;
    }
  }


  /**
   * Load column order from profile preferences
   * @returns {Promise<void>}
   */
  async loadColumnOrder() {
    try {
      this.logInfo('Loading column order from profile preferences...');
      
      const electronAPI = window.secureElectronAPI;
      if (!electronAPI || !electronAPI.profile) {
        this.logWarn('Profile API not available, trying global store');
        const hasColumnOrderResult = await secureStore.has("column_order");
        const hasColumnOrder = hasColumnOrderResult?.success && hasColumnOrderResult.has;
        this.logInfo(`Column order exists in global store: ${hasColumnOrder}`);
        
        if (hasColumnOrder) {
          const columnOrderData = await secureStore.get("column_order");
          this.logInfo(`Retrieved column order from global store:`, columnOrderData);
          
          // Handle both wrapped format {success: true, value: [...]} and direct array format [...]
          let columnOrder = null;
          if (columnOrderData && typeof columnOrderData === 'object') {
            if (Array.isArray(columnOrderData)) {
              columnOrder = columnOrderData;
            } else if (columnOrderData.value && Array.isArray(columnOrderData.value)) {
              columnOrder = columnOrderData.value;
            }
          }
          
          if (columnOrder && Array.isArray(columnOrder)) {
            const topRow = document.getElementById('top-row');
            if (topRow) {
              columnOrder.forEach((val) => {
                const child = topRow.querySelector(`#${val}`);
                if (child) {
                  topRow.appendChild(child);
                }
              });
              this.logInfo('Column order applied from global store successfully');
            }
          }
        }
        return;
      }
      
      // Use profile preferences
      const result = await electronAPI.profile.getPreference('column_order');
      this.logInfo(`Retrieved column order from profile:`, result);
      
      if (result.success && result.value && Array.isArray(result.value)) {
          const columnOrder = result.value;
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
        this.logInfo('No saved column order found in profile');
      }
    } catch (error) {
      this.logError('Error loading column order', error);
    }
  }

  /**
   * Load font size from profile preferences
   * @returns {Promise<void>}
   */
  async loadFontSize() {
    try {
      // Try to load from profile preferences first (new system)
      if (window.secureElectronAPI?.profile) {
        const result = await window.secureElectronAPI.profile.getPreference('font_size');
        if (result && result.success && result.value !== undefined && result.value !== null) {
          this.logInfo(`Font size loaded from profile preferences: ${result.value}`);
          return;
        }
      }

      // Fallback to legacy store for backward compatibility
      const hasFontSizeResult = await secureStore.has("font-size");
      if (hasFontSizeResult?.success && hasFontSizeResult.has) {
        const sizeResult = await secureStore.get("font-size");
        const size = sizeResult?.success ? sizeResult.value : null;
        if (size !== undefined && size !== null) {
          // Migrate to profile preferences if available
          if (window.secureElectronAPI?.profile) {
            await window.secureElectronAPI.profile.setPreference('font_size', size);
            this.logInfo(`Font size migrated from legacy store to profile: ${size}`);
          } else {
            this.logInfo(`Font size loaded from legacy store: ${size}`);
          }
        }
      }
    } catch (error) {
      this.logError('Error loading font size', error);
    }
  }

  /**
   * Load categories from database into shared state
   * @returns {Promise<void>}
   */
  async loadCategories() {
    try {
      this.logInfo('Loading categories from database...');

      // Import the categories module
      const { loadCategories } = await import('../categories/index.js');

      if (typeof loadCategories === 'function') {
        const result = await loadCategories();
        if (result.success) {
          this.logInfo(`Categories loaded successfully: ${Object.keys(result.data).length} categories`);
        } else {
          this.logWarn(`Failed to load categories: ${result.error}`);
        }
      } else {
        this.logWarn('loadCategories function not available');
      }
    } catch (error) {
      this.logError('Error loading categories', error);
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
      
      this.logInfo('📐 Loading column order...');
      await this.loadColumnOrder();
      
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
