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
    // Holding tank file operations
    const openHoldingTankBtn = document.querySelector('[onclick="openHoldingTankFile()"]');
    if (openHoldingTankBtn) {
      openHoldingTankBtn.addEventListener('click', () => {
        if (window.openHoldingTankFile) {
          window.openHoldingTankFile();
        } else {
          this.debugLog.warn('openHoldingTankFile function not available', { function: "setupFileOperations" });
        }
      });
      openHoldingTankBtn.removeAttribute('onclick');
    }

    const saveHoldingTankBtn = document.querySelector('[onclick="saveHoldingTankFile()"]');
    if (saveHoldingTankBtn) {
      saveHoldingTankBtn.addEventListener('click', () => {
        if (window.saveHoldingTankFile) {
          window.saveHoldingTankFile();
        } else {
          this.debugLog.warn('saveHoldingTankFile function not available', { function: "setupFileOperations" });
        }
      });
      saveHoldingTankBtn.removeAttribute('onclick');
    }

    // Hotkey file operations
    const openHotkeyBtn = document.querySelector('[onclick="openHotkeyFile()"]');
    if (openHotkeyBtn) {
      openHotkeyBtn.addEventListener('click', () => {
        if (window.openHotkeyFile) {
          window.openHotkeyFile();
        } else {
          this.debugLog.warn('openHotkeyFile function not available', { function: "setupFileOperations" });
        }
      });
      openHotkeyBtn.removeAttribute('onclick');
    }

    const saveHotkeyBtn = document.querySelector('[onclick="saveHotkeyFile()"]');
    if (saveHotkeyBtn) {
      saveHotkeyBtn.addEventListener('click', () => {
        if (window.saveHotkeyFile) {
          window.saveHotkeyFile();
        } else {
          this.debugLog.warn('saveHotkeyFile function not available', { function: "setupFileOperations" });
        }
      });
      saveHotkeyBtn.removeAttribute('onclick');
    }

    this.debugLog.info('File operation event listeners set up', { function: "setupFileOperations" });
  }

  /**
   * Setup holding tank operation buttons
   */
  setupHoldingTankOperations() {
    const renameHoldingTankBtn = document.querySelector('[onclick="renameHoldingTankTab()"]');
    if (renameHoldingTankBtn) {
      renameHoldingTankBtn.addEventListener('click', () => {
        if (window.renameHoldingTankTab) {
          window.renameHoldingTankTab();
        } else {
          this.debugLog.warn('renameHoldingTankTab function not available', { function: "setupHoldingTankOperations" });
        }
      });
      renameHoldingTankBtn.removeAttribute('onclick');
    }

    const clearHoldingTankBtn = document.querySelector('[onclick="clearHoldingTank()"]');
    if (clearHoldingTankBtn) {
      clearHoldingTankBtn.addEventListener('click', () => {
        if (window.clearHoldingTank) {
          window.clearHoldingTank();
        } else {
          this.debugLog.warn('clearHoldingTank function not available', { function: "setupHoldingTankOperations" });
        }
      });
      clearHoldingTankBtn.removeAttribute('onclick');
    }

    this.debugLog.info('Holding tank operation event listeners set up', { function: "setupHoldingTankOperations" });
  }

  /**
   * Setup hotkey operation buttons
   */
  setupHotkeyOperations() {
    const renameHotkeyBtn = document.querySelector('[onclick="renameHotkeyTab()"]');
    if (renameHotkeyBtn) {
      renameHotkeyBtn.addEventListener('click', () => {
        if (window.renameHotkeyTab) {
          window.renameHotkeyTab();
        } else {
          this.debugLog.warn('renameHotkeyTab function not available', { function: "setupHotkeyOperations" });
        }
      });
      renameHotkeyBtn.removeAttribute('onclick');
    }

    const clearHotkeysBtn = document.querySelector('[onclick="clearHotkeys()"]');
    if (clearHotkeysBtn) {
      clearHotkeysBtn.addEventListener('click', () => {
        if (window.clearHotkeys) {
          window.clearHotkeys();
        } else {
          this.debugLog.warn('clearHotkeys function not available', { function: "setupHotkeyOperations" });
        }
      });
      clearHotkeysBtn.removeAttribute('onclick');
    }

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
    const installUpdateBtn = document.querySelector('[onclick="installUpdate()"]');
    if (installUpdateBtn) {
      installUpdateBtn.addEventListener('click', () => {
        if (window.installUpdate) {
          window.installUpdate();
        } else {
          this.debugLog.warn('installUpdate function not available', { function: "setupUpdateOperations" });
        }
      });
      installUpdateBtn.removeAttribute('onclick');
    }

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