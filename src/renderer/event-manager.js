/**
 * Event Manager for HTML Interactions
 * 
 * Replaces onclick attributes with proper event listeners
 * to reduce window pollution and improve architecture
 */

class EventManager {
  constructor(functionRegistry, debugLogger = null) {
    this.functionRegistry = functionRegistry;
    this.debugLog = debugLogger;
    this.eventHandlers = new Map();
    this.initialized = false;
  }

  // Set debug logger after initialization
  setDebugLogger(debugLogger) {
    if (!debugLogger) {
      throw new Error('EventManager requires a valid debug logger');
    }
    this.debugLog = debugLogger;
    this.debugLog.info('EventManager debug logger set', { 
      function: "setDebugLogger" 
    });
  }

  // Ensure debug logger is available before use
  ensureDebugLogger() {
    if (!this.debugLog) {
      throw new Error('DebugLogger not initialized. EventManager requires DebugLogger to be available.');
    }
  }

  /**
   * Migrate an inline onclick attribute to a proper event listener.
   * Finds an element by its onclick value, replaces it with an addEventListener
   * call that delegates to window[fnName], and removes the onclick attribute.
   *
   * @param {string} fnName - The global function name (e.g. 'openHotkeyFile')
   * @param {string} callerContext - Logging context for which setup method called this
   */
  migrateOnclick(fnName, callerContext) {
    const el = document.querySelector(`[onclick="${fnName}()"]`);
    if (!el) return;
    el.addEventListener('click', () => {
      if (window[fnName]) {
        window[fnName]();
      } else {
        this.debugLog.warn(`${fnName} function not available`, { function: callerContext });
      }
    });
    el.removeAttribute('onclick');
  }

  /**
   * Initialize the event manager
   */
  initialize() {
    this.ensureDebugLogger();
    
    if (this.initialized) {
      this.debugLog.warn('Event manager already initialized', { function: "initialize" });
      return;
    }

    this.debugLog.info('Initializing event manager...', { function: "initialize" });
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.setupEventListeners();
      });
    } else {
      this.setupEventListeners();
    }

    this.initialized = true;
    this.debugLog.info('Event manager initialized', { function: "initialize" });
  }

  /**
   * Setup all event listeners
   */
  setupEventListeners() {
    this.setupModeButtons();
    this.setupFileOperations();
    this.setupHoldingTankOperations();
    this.setupHotkeyOperations();
    this.setupPreferencesOperations();
    this.setupUpdateOperations();
    this.setupDynamicElements();
    
    this.debugLog.info('All event listeners set up', { function: "setupEventListeners" });
  }

  /**
   * Setup mode toggle buttons
   */
  setupModeButtons() {
    const storageBtn = document.getElementById('storage_mode_btn');
    const playlistBtn = document.getElementById('playlist_mode_btn');
    
    if (storageBtn) {
      storageBtn.addEventListener('click', () => {
        if (window.setHoldingTankMode) {
          window.setHoldingTankMode('storage');
        } else {
          this.debugLog.warn('setHoldingTankMode function not available', { function: "setupModeButtons" });
        }
      });
      storageBtn.removeAttribute('onclick');
      this.debugLog.info('Storage mode button event listener set up', { function: "setupModeButtons" });
    }
    
    if (playlistBtn) {
      playlistBtn.addEventListener('click', () => {
        if (window.setHoldingTankMode) {
          window.setHoldingTankMode('playlist');
        } else {
          this.debugLog.warn('setHoldingTankMode function not available', { function: "setupModeButtons" });
        }
      });
      playlistBtn.removeAttribute('onclick');
      this.debugLog.info('Playlist mode button event listener set up', { function: "setupModeButtons" });
    }
  }

  /**
   * Setup file operation buttons
   */
  setupFileOperations() {
    this.migrateOnclick('openHoldingTankFile', 'setupFileOperations');
    this.migrateOnclick('saveHoldingTankFile', 'setupFileOperations');
    this.migrateOnclick('openHotkeyFile', 'setupFileOperations');
    this.migrateOnclick('saveHotkeyFile', 'setupFileOperations');

    this.debugLog.info('File operation event listeners set up', { function: "setupFileOperations" });
  }

  /**
   * Setup holding tank operation buttons
   */
  setupHoldingTankOperations() {
    this.migrateOnclick('renameHoldingTankTab', 'setupHoldingTankOperations');
    this.migrateOnclick('clearHoldingTank', 'setupHoldingTankOperations');

    this.debugLog.info('Holding tank operation event listeners set up', { function: "setupHoldingTankOperations" });
  }

  /**
   * Setup hotkey operation buttons
   */
  setupHotkeyOperations() {
    this.migrateOnclick('renameHotkeyTab', 'setupHotkeyOperations');
    this.migrateOnclick('clearHotkeys', 'setupHotkeyOperations');

    this.debugLog.info('Hotkey operation event listeners set up', { function: "setupHotkeyOperations" });
  }

  /**
   * Setup preferences operation buttons
   */
  setupPreferencesOperations() {
    // Directory picker buttons
    const directoryButtons = document.querySelectorAll('[onclick*="pickDirectory"]');
    directoryButtons.forEach(button => {
      const onclick = button.getAttribute('onclick');
      const match = onclick.match(/pickDirectory\(event,\s*"([^"]+)"\)/);
      
      if (match) {
        const selector = match[1];
        button.addEventListener('click', (event) => {
          if (window.pickDirectory) {
            window.pickDirectory(event, selector);
          } else {
            this.debugLog.warn('pickDirectory function not available', { function: "setupPreferencesOperations" });
          }
        });
        button.removeAttribute('onclick');
      }
    });

    this.debugLog.info('Preferences operation event listeners set up', { function: "setupPreferencesOperations" });
  }

  /**
   * Setup update operation buttons
   */
  setupUpdateOperations() {
    this.migrateOnclick('installUpdate', 'setupUpdateOperations');

    this.debugLog.info('Update operation event listeners set up', { function: "setupUpdateOperations" });
  }

  /**
   * Setup event listeners for dynamically created elements
   */
  setupDynamicElements() {
    // Use MutationObserver to watch for dynamically added elements
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            this.setupDynamicElement(node);
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    this.debugLog.info('Dynamic element observer set up', { function: "setupDynamicElements" });
  }

  /**
   * Setup event listeners for a dynamically added element
   */
  setupDynamicElement(element) {
    // Handle category edit/delete buttons
    const editButtons = element.querySelectorAll('[onclick*="editCategoryUI"]');
    editButtons.forEach(button => {
      const onclick = button.getAttribute('onclick');
      const match = onclick.match(/editCategoryUI\('([^']+)'\)/);
      
      if (match && !button.hasAttribute('data-event-setup')) {
        const categoryCode = match[1];
        button.addEventListener('click', () => {
          if (window.editCategoryUI) {
            window.editCategoryUI(categoryCode);
          } else {
            this.debugLog.warn('editCategoryUI function not available', { function: "setupDynamicElement" });
          }
        });
        button.removeAttribute('onclick');
        button.setAttribute('data-event-setup', 'true');
      }
    });

    // Handle category delete buttons
    const deleteButtons = element.querySelectorAll('[onclick*="deleteCategory"]');
    deleteButtons.forEach(button => {
      const onclick = button.getAttribute('onclick');
      const match = onclick.match(/deleteCategory\(event,\s*'([^']+)',\s*'([^']+)'\)/);
      
      if (match && !button.hasAttribute('data-event-setup')) {
        const categoryCode = match[1];
        const categoryDescription = match[2];
        button.addEventListener('click', (event) => {
          if (window.deleteCategory) {
            window.deleteCategory(event, categoryCode, categoryDescription);
          } else {
            this.debugLog.warn('deleteCategory function not available', { function: "setupDynamicElement" });
          }
        });
        button.removeAttribute('onclick');
        button.setAttribute('data-event-setup', 'true');
      }
    });
  }

  /**
   * Get event manager statistics
   */
  getStats() {
    return {
      initialized: this.initialized,
      eventHandlers: this.eventHandlers.size,
      totalElements: document.querySelectorAll('[data-event-setup]').length
    };
  }
}

export default EventManager; 