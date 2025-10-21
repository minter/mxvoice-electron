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
      
      // Check if we need to load legacy HTML data (migration from 3.1.5 scenario)
      const needsMigrationLoad = await this.checkNeedsMigrationLoad();
      
      if (needsMigrationLoad) {
        this.logInfo('Migration detected: loading hotkeys/holding tank from config.json');
        await this.loadHotkeys();
        await this.loadHoldingTank();
        // Flag that we need to save profile state after DOM is ready
        window._needsInitialStateSave = true;
      }
      
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
   * Check if we need to load legacy HTML (migration from 3.1.5 to 4.1+)
   * Returns true ONLY for Default User profile, ONLY ONCE when upgrading from pre-4.1
   * 
   * IMPORTANT: Migration is a ONE-TIME event:
   * - Only happens for "Default User" profile
   * - Only happens on first run after upgrading from pre-4.1 (pre-profiles)
   * - Checks for migration_completed flag to prevent re-running
   * - New profiles NEVER migrate from global config.json
   * 
   * After migration, global config.json is only used for:
   * - Directory paths (music_directory, hotkey_directory, database_directory)
   * - Window state and other global settings
   * - NOT for hotkeys or holding_tank data
   * 
   * @returns {Promise<boolean>}
   */
  async checkNeedsMigrationLoad() {
    try {
      const electronAPI = window.secureElectronAPI || window.electronAPI;
      if (!electronAPI?.profile) {
        return false;
      }
      
      // Get current profile name
      const currentProfileResult = await electronAPI.profile.getCurrent();
      const currentProfile = currentProfileResult?.profile;
      
      // ONLY "Default User" can migrate from global config.json
      // All other profiles (including newly created ones) should start fresh
      if (currentProfile !== 'Default User') {
        this.logInfo('Skipping migration check for non-Default User profile', {
          profile: currentProfile
        });
        return false;
      }
      
      this.logInfo('Checking migration need for Default User profile');
      
      // Check if migration has already been completed
      const preferencesResult = await electronAPI.profile.getPreference('migration_completed');
      if (preferencesResult?.success && preferencesResult?.value === true) {
        this.logInfo('Migration already completed for Default User, skipping');
        return false;
      }
      
      // Check if profile state file exists
      const dirResult = await electronAPI.profile.getDirectory('state');
      if (!dirResult.success) {
        return false;
      }
      
      const stateFileResult = await electronAPI.path.join(dirResult.directory, 'state.json');
      if (!stateFileResult.success) {
        return false;
      }
      
      const existsResult = await electronAPI.fileSystem.exists(stateFileResult.data);
      
      // If state file already exists, mark migration as completed and skip
      if (existsResult.exists) {
        this.logInfo('State file exists for Default User, marking migration as completed');
        // Mark migration as done so we don't check again
        await electronAPI.profile.setPreference('migration_completed', true);
        return false;
      }
      
      // State file doesn't exist - check if we have legacy HTML in global config.json
      // We need to read config.json directly because profile store deletes hotkeys/holding_tank
      const userDataResult = await electronAPI.fileSystem.getUserDataPath();
      if (!userDataResult.success) {
        return false;
      }
      
      const configPathResult = await electronAPI.path.join(userDataResult.path, 'config.json');
      if (!configPathResult.success) {
        return false;
      }
      
      const configExistsResult = await electronAPI.fileSystem.exists(configPathResult.data);
      if (!configExistsResult.success || !configExistsResult.exists) {
        this.logInfo('No global config.json found, no migration needed');
        // Mark migration as done so we don't check again
        await electronAPI.profile.setPreference('migration_completed', true);
        return false;
      }
      
      // Read config.json directly
      const configReadResult = await electronAPI.fileSystem.read(configPathResult.data);
      if (!configReadResult.success) {
        return false;
      }
      
      try {
        const config = JSON.parse(configReadResult.data);
        const hasHotkeys = config.hotkeys && typeof config.hotkeys === 'string' && config.hotkeys.includes('songid=');
        const hasHoldingTank = config.holding_tank && typeof config.holding_tank === 'string' && config.holding_tank.includes('songid=');
        
        if (hasHotkeys || hasHoldingTank) {
          this.logInfo('ONE-TIME MIGRATION: Default User upgrading from pre-4.1, will load legacy data from global config.json');
          // Don't mark as completed yet - will be marked after successful migration
          return true;
        } else {
          this.logInfo('No legacy data in global config.json');
          // Mark migration as done so we don't check again
          await electronAPI.profile.setPreference('migration_completed', true);
          return false;
        }
      } catch (parseError) {
        this.logError('Error parsing config.json', parseError);
        return false;
      }
    } catch (error) {
      this.logError('Error checking migration status', error);
      return false;
    }
  }

  /**
   * Load hotkeys from electron store or config.json (for migration)
   * @returns {Promise<void>}
   */
  async loadHotkeys() {
    try {
      // When profiles are active, skip global store - profile state will load instead
      const electronAPI = window.secureElectronAPI || window.electronAPI;
      if (electronAPI && electronAPI.profile) {
        const currentProfileResult = await electronAPI.profile.getCurrent();
        if (currentProfileResult && currentProfileResult.profile) {
          this.logInfo('Profile active - skipping global hotkeys store, will use profile state');
          return;
        }
      }
      
      let storedHotkeysHtml = null;
      
      // First try the store
      const hasHotkeys = await secureStore.has("hotkeys");
      
      if (hasHotkeys) {
        const result = await secureStore.get("hotkeys");
        // Unwrap the result if it's wrapped in {success: true, value: ...}
        storedHotkeysHtml = result?.value || result;
      } else {
        // Store doesn't have it - read from config.json directly (migration scenario)
        const electronAPI = window.secureElectronAPI || window.electronAPI;
        const userDataResult = await electronAPI.fileSystem.getUserDataPath();
        
        if (userDataResult.success) {
          const configPathResult = await electronAPI.path.join(userDataResult.path, 'config.json');
          
          if (configPathResult.success) {
            const configReadResult = await electronAPI.fileSystem.read(configPathResult.data);
            
            if (configReadResult.success) {
              try {
                const config = JSON.parse(configReadResult.data);
                storedHotkeysHtml = config.hotkeys;
                if (storedHotkeysHtml) {
                  this.logInfo("Loaded hotkeys from config.json for migration");
                }
              } catch (parseError) {
                this.logError('Error parsing config.json for hotkeys', parseError);
              }
            }
          }
        }
      }
      
      if (storedHotkeysHtml && typeof storedHotkeysHtml === 'string') {
        // Check if HTML has songid data - if so, load it regardless of header format
        const hasSongData = storedHotkeysHtml.includes('songid=');
        
        if (hasSongData) {
          // Parse HTML to extract song data for all tabs
          const parser = new DOMParser();
          const doc = parser.parseFromString(storedHotkeysHtml, 'text/html');
          
          let totalMigrated = 0;
          
          // Extract data for all 5 tabs
          for (let tabNum = 1; tabNum <= 5; tabNum++) {
            // Use only the FIRST instance of each tab ID (avoid duplicates from old saves)
            const tabContent = doc.querySelector(`#hotkeys_list_${tabNum}`);
            if (!tabContent) continue;
            
            // Find all hotkeys with song IDs in this tab
            for (let keyNum = 1; keyNum <= 12; keyNum++) {
              const hotkeyElement = tabContent.querySelector(`#f${keyNum}_hotkey[songid]`);
              if (hotkeyElement) {
                const songId = hotkeyElement.getAttribute('songid');
                const songText = hotkeyElement.querySelector('span.song')?.textContent || '';
                
                if (songId) {
                  // Apply to the live DOM
                  const currentTabContent = document.getElementById(`hotkeys_list_${tabNum}`);
                  if (currentTabContent) {
                    const currentHotkeyElement = currentTabContent.querySelector(`#f${keyNum}_hotkey`);
                    if (currentHotkeyElement) {
                      currentHotkeyElement.setAttribute('songid', songId);
                      const songSpan = currentHotkeyElement.querySelector('span.song');
                      if (songSpan) {
                        songSpan.setAttribute('songid', songId);
                        songSpan.textContent = songText;
                      }
                      totalMigrated++;
                    }
                  }
                }
              }
            }
          }
          
          if (totalMigrated > 0) {
            this.logInfo(`Migrated ${totalMigrated} hotkeys from legacy data`);
          }
        } else if (
          storedHotkeysHtml.includes("Hotkeys") &&
          !storedHotkeysHtml.includes("header-button")
        ) {
          // Old empty HTML format without song data, clear it
          await secureStore.delete("hotkeys");
        }
      }
    } catch (error) {
      this.logError('Error loading hotkeys', error);
    }
  }

  /**
   * Load holding tank from electron store or config.json (for migration)
   * @returns {Promise<void>}
   */
  async loadHoldingTank() {
    try {
      // When profiles are active, skip global store - profile state will load instead
      const electronAPI = window.secureElectronAPI || window.electronAPI;
      if (electronAPI && electronAPI.profile) {
        const currentProfileResult = await electronAPI.profile.getCurrent();
        if (currentProfileResult && currentProfileResult.profile) {
          this.logInfo('Profile active - skipping global holding tank store, will use profile state');
          return;
        }
      }
      
      let storedHoldingTankHtml = null;
      
      // First try the store
      const hasHoldingTank = await secureStore.has("holding_tank");
      
      if (hasHoldingTank) {
        const result = await secureStore.get("holding_tank");
        // Unwrap the result if it's wrapped in {success: true, value: ...}
        storedHoldingTankHtml = result?.value || result;
      } else {
        // Store doesn't have it - read from config.json directly (migration scenario)
        const electronAPI = window.secureElectronAPI || window.electronAPI;
        const userDataResult = await electronAPI.fileSystem.getUserDataPath();
        
        if (userDataResult.success) {
          const configPathResult = await electronAPI.path.join(userDataResult.path, 'config.json');
          
          if (configPathResult.success) {
            const configReadResult = await electronAPI.fileSystem.read(configPathResult.data);
            
            if (configReadResult.success) {
              try {
                const config = JSON.parse(configReadResult.data);
                storedHoldingTankHtml = config.holding_tank;
                if (storedHoldingTankHtml) {
                  this.logInfo("Loaded holding tank from config.json for migration");
                }
              } catch (parseError) {
                this.logError('Error parsing config.json for holding tank', parseError);
              }
            }
          }
        }
      }
      
      if (storedHoldingTankHtml && typeof storedHoldingTankHtml === 'string') {
        // Check if HTML has songid data
        const hasSongData = storedHoldingTankHtml.includes('songid=');
        
        if (hasSongData) {
          // Parse HTML to extract song data for all tabs
          const parser = new DOMParser();
          const doc = parser.parseFromString(storedHoldingTankHtml, 'text/html');
          
          let totalMigrated = 0;
          
          // Extract data for all 5 tabs
          for (let tabNum = 1; tabNum <= 5; tabNum++) {
            // Use only the FIRST instance of each tab ID (avoid duplicates from old saves)
            const tabContent = doc.querySelector(`#holding_tank_${tabNum}`);
            if (!tabContent) continue;
            
            // Find all songs with song IDs in this tab
            const songElements = tabContent.querySelectorAll('li[songid]');
            
            if (songElements.length > 0) {
              // Get the current tab in the live DOM
              const currentTabContent = document.getElementById(`holding_tank_${tabNum}`);
              if (currentTabContent) {
                // Clear current content
                currentTabContent.innerHTML = '';
                
                // Add each song
                songElements.forEach(songElement => {
                  const songId = songElement.getAttribute('songid');
                  const songText = songElement.textContent.trim();
                  
                  if (songId) {
                    const li = document.createElement('li');
                    li.className = 'song list-group-item';
                    li.style.fontSize = '11px';
                    li.setAttribute('draggable', 'true');
                    li.setAttribute('songid', songId);
                    li.textContent = songText;
                    
                    currentTabContent.appendChild(li);
                    totalMigrated++;
                  }
                });
              }
            }
          }
          
          if (totalMigrated > 0) {
            this.logInfo(`Migrated ${totalMigrated} holding tank songs from legacy data`);
          }
        }
      }
    } catch (error) {
      this.logError('Error loading holding tank', error);
    }
  }

  /**
   * Load column order from profile preferences
   * @returns {Promise<void>}
   */
  async loadColumnOrder() {
    try {
      this.logInfo('Loading column order from profile preferences...');
      
      const electronAPI = window.secureElectronAPI || window.electronAPI;
      if (!electronAPI || !electronAPI.profile) {
        this.logWarn('Profile API not available, trying global store');
        const hasColumnOrder = await secureStore.has("column_order");
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
      if (window.electronAPI && window.electronAPI.profile) {
        const result = await window.electronAPI.profile.getPreference('font_size');
        if (result && result.success && result.value !== undefined && result.value !== null) {
          this.logInfo(`Font size loaded from profile preferences: ${result.value}`);
          return;
        }
      }

      // Fallback to legacy store for backward compatibility
      const hasFontSize = await secureStore.has("font-size");
      if (hasFontSize) {
        const size = await secureStore.get("font-size");
        if (size !== undefined && size !== null) {
          // Migrate to profile preferences if available
          if (window.electronAPI && window.electronAPI.profile) {
            await window.electronAPI.profile.setPreference('font_size', size);
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
