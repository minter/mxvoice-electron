/**
 * UI Interaction Events Module
 * 
 * Handles all UI interaction event handlers that were previously in renderer.js.
 * Includes modals, tabs, window resize, and form interactions.
 */

export default class UIInteractionEvents {
  constructor(dependencies = {}) {
    this.electronAPI = dependencies.electronAPI || window.electronAPI;
    this.db = null;
    this.store = null;
    this.debugLog = dependencies.debugLog || window.debugLog;
    this.moduleRegistry = dependencies.moduleRegistry || window.moduleRegistry;
    
    this.eventsAttached = false;
    this.uiHandlers = new Map();
  }

  /**
   * Attach all UI interaction event handlers
   */
  async attachUIInteractionEvents() {
    try {
      if (this.eventsAttached) {
        this.debugLog?.warn('UI interaction events already attached');
        return;
      }

      this.debugLog?.info('Attaching UI interaction event handlers...');

      // Modal events
      this.attachModalEvents();

      // Tab events
      this.attachTabEvents();

      // Window events
      this.attachWindowEvents();

      // Form events
      this.attachFormEvents();

      // Confirmation modal events
      this.attachConfirmationEvents();

      this.eventsAttached = true;
      this.debugLog?.info('UI interaction event handlers attached successfully');

    } catch (error) {
      this.debugLog?.error('Failed to attach UI interaction events:', error);
    }
  }

  /**
   * Modal interaction events (lines 1110-1112 from renderer.js)
   */
  attachModalEvents() {
    const modalShowHandler = (event) => {
      try {
        // Hide other modals when one is shown using adapter
        import('../ui/bootstrap-adapter.js').then(({ hideAllModals }) => hideAllModals());
      } catch (error) {
        this.debugLog?.error('Error in modal show handler:', error);
      }
    };

    // Bind Bootstrap 5 modal event via native listeners
    document.querySelectorAll('.modal').forEach((el) => {
      el.addEventListener('show.bs.modal', modalShowHandler);
    });
    this.uiHandlers.set('modalShow', { element: '.modal', event: 'show.bs.modal', handler: modalShowHandler });
    
    // Listen for preload-dispatched modal show events
    try {
      const showModalListener = (e) => {
        const selector = e?.detail?.selector;
        if (!selector) return;
        import('../ui/bootstrap-adapter.js').then(({ showModal }) => showModal(selector));
      };
      window.addEventListener('mxvoice:show-modal', showModalListener);
      this.uiHandlers.set('mxvoiceShowModal', { element: window, event: 'mxvoice:show-modal', handler: showModalListener });
    } catch {}

    try {
      const updateReleaseNotesListener = (e) => {
        const { name, notes } = e?.detail || {};
        if (!name || !notes) return;
        
        // Update the modal title and content
        const modalTitle = document.querySelector('#newReleaseModal .modal-title');
        const modalBody = document.querySelector('#newReleaseModal .modal-body');
        
        if (modalTitle) modalTitle.textContent = `Update Available: ${name}`;
        if (modalBody) modalBody.innerHTML = notes;
      };
      window.addEventListener('mxvoice:update-release-notes', updateReleaseNotesListener);
      this.uiHandlers.set('mxvoiceUpdateReleaseNotes', { element: window, event: 'mxvoice:update-release-notes', handler: updateReleaseNotesListener });
    } catch {}

    // Auto-update progress events
    try {
      const updateProgressListener = (event) => {
        try {
          const progress = event.detail || {};
          // Import the system operations module to handle progress
          import('../file-operations/system-operations.js').then(systemOps => {
            if (systemOps.handleDownloadProgress) {
              systemOps.handleDownloadProgress(progress);
            }
          }).catch(err => {
            this.debugLog?.error('Failed to import system operations for progress update:', err);
          });
        } catch (error) {
          this.debugLog?.error('Error handling update progress:', error);
        }
      };
      
      const updateReadyListener = (event) => {
        try {
          const version = event.detail || '';
          // Import the system operations module to handle ready state
          import('../file-operations/system-operations.js').then(systemOps => {
            if (systemOps.handleUpdateReady) {
              systemOps.handleUpdateReady(version);
            }
          }).catch(err => {
            this.debugLog?.error('Failed to import system operations for update ready:', err);
          });
        } catch (error) {
          this.debugLog?.error('Error handling update ready:', error);
        }
      };

      window.addEventListener('mxvoice:update-download-progress', updateProgressListener);
      window.addEventListener('mxvoice:update-ready', updateReadyListener);
      this.uiHandlers.set('mxvoiceUpdateProgress', { element: window, event: 'mxvoice:update-download-progress', handler: updateProgressListener });
      this.uiHandlers.set('mxvoiceUpdateReady', { element: window, event: 'mxvoice:update-ready', handler: updateReadyListener });
    } catch (error) {
      this.debugLog?.error('Failed to attach update progress events:', error);
    }
    
    this.debugLog?.debug('Modal events attached');
  }

  /**
   * Tab interaction events (lines 1114-1120 from renderer.js)
   */
  attachTabEvents() {
    // Hotkey tab double-click for renaming
    const hotkeyTabDoubleClickHandler = (event) => {
      try {
        if (window.renameHotkeyTab) {
          window.renameHotkeyTab();
        } else {
          this.debugLog?.warn('renameHotkeyTab function not available');
        }
      } catch (error) {
        this.debugLog?.error('Error in hotkey tab double-click handler:', error);
      }
    };

    // Holding tank tab double-click for renaming
    const holdingTankTabDoubleClickHandler = (event) => {
      try {
        if (window.renameHoldingTankTab) {
          window.renameHoldingTankTab();
        } else {
          this.debugLog?.warn('renameHoldingTankTab function not available');
        }
      } catch (error) {
        this.debugLog?.error('Error in holding tank tab double-click handler:', error);
      }
    };

    const hotkeyTabs = document.getElementById('hotkey_tabs');
    if (hotkeyTabs) {
      const handler = (e) => {
        if (e.target && e.target.closest('.nav-link')) hotkeyTabDoubleClickHandler(e);
      };
      hotkeyTabs.addEventListener('dblclick', handler);
      this.uiHandlers.set('hotkeyTabDoubleClick', { element: hotkeyTabs, event: 'dblclick', handler });
    }
    const holdingTabs = document.getElementById('holding_tank_tabs');
    if (holdingTabs) {
      const handler2 = (e) => {
        if (e.target && e.target.closest('.nav-link')) holdingTankTabDoubleClickHandler(e);
      };
      holdingTabs.addEventListener('dblclick', handler2);
      this.uiHandlers.set('holdingTankTabDoubleClick', { element: holdingTabs, event: 'dblclick', handler: handler2 });
    }

    this.debugLog?.debug('Tab events attached');
  }

  /**
   * Window events (lines 1168-1172 from renderer.js)
   */
  attachWindowEvents() {
    const windowResizeHandler = (event) => {
      try {
        if (window.scaleScrollable) {
          window.scaleScrollable();
        } else {
          this.debugLog?.warn('scaleScrollable function not available');
        }
      } catch (error) {
        this.debugLog?.error('Error in window resize handler:', error);
      }
    };

    window.addEventListener('resize', windowResizeHandler);
    this.uiHandlers.set('windowResize', { element: window, event: 'resize', handler: windowResizeHandler });
    
    this.debugLog?.debug('Window events attached');
  }

  /**
   * Form modal events (lines 1124-1166 from renderer.js)
   */
  attachFormEvents() {
    // Song form modal hidden event
    const songFormModalHiddenHandler = (event) => {
      try {
        const ids = [
          'song-form-category', 'song-form-title', 'song-form-new-category',
          'song-form-artist', 'song-form-info', 'song-form-duration'
        ];
        ids.forEach((id) => { const el = document.getElementById(id); if (el) el.value = ''; });
        const newCat = document.getElementById('SongFormNewCategory');
        if (newCat) newCat.style.display = 'none';
      } catch (error) {
        this.debugLog?.error('Error in song form modal hidden handler:', error);
      }
    };

    // Song form modal shown event
    const songFormModalShownHandler = (event) => {
      try {
        const title = document.getElementById('song-form-title');
        const info = document.getElementById('song-form-info');
        const len = (title?.value || '').length;
        this.debugLog?.debug('Song form title length:', len);
        if (!len) title?.focus(); else info?.focus();
      } catch (error) {
        this.debugLog?.error('Error in song form modal shown handler:', error);
      }
    };

    // Preferences modal shown event
    const preferencesModalShownHandler = (event) => {
      try {
        // Use the new preference system instead of duplicating logic
        if (window.loadPreferences) {
          window.loadPreferences();
        } else {
          this.debugLog?.warn('loadPreferences function not available, preferences may not load correctly');
        }
      } catch (error) {
        this.debugLog?.error('Error in preferences modal shown handler:', error);
      }
    };

    // Song form category change event
    const songFormCategoryChangeHandler = (event) => {
      try {
        const select = event.target;
        const optionValue = select && select.value;
        const newCategoryRow = document.getElementById('SongFormNewCategory');
        const newCategoryInput = document.getElementById('song-form-new-category');
        if (optionValue === '--NEW--') {
          if (newCategoryRow) newCategoryRow.style.display = '';
          if (newCategoryInput) newCategoryInput.setAttribute('required', 'required');
        } else {
          if (newCategoryRow) newCategoryRow.style.display = 'none';
          if (newCategoryInput) newCategoryInput.removeAttribute('required');
        }
      } catch (error) {
        this.debugLog?.error('Error in song form category change handler:', error);
      }
    };

    const songFormModal = document.getElementById('songFormModal');
    if (songFormModal) {
      songFormModal.addEventListener('hidden.bs.modal', songFormModalHiddenHandler);
      songFormModal.addEventListener('shown.bs.modal', songFormModalShownHandler);
      this.uiHandlers.set('songFormModalHidden', { element: songFormModal, event: 'hidden.bs.modal', handler: songFormModalHiddenHandler });
      this.uiHandlers.set('songFormModalShown', { element: songFormModal, event: 'shown.bs.modal', handler: songFormModalShownHandler });
    }
    const preferencesModal = document.getElementById('preferencesModal');
    if (preferencesModal) {
      preferencesModal.addEventListener('shown.bs.modal', preferencesModalShownHandler);
      this.uiHandlers.set('preferencesModalShown', { element: preferencesModal, event: 'shown.bs.modal', handler: preferencesModalShownHandler });
    }
    const songFormCategory = document.getElementById('song-form-category');
    if (songFormCategory) {
      songFormCategory.addEventListener('change', songFormCategoryChangeHandler);
      this.uiHandlers.set('songFormCategoryChange', { element: songFormCategory, event: 'change', handler: songFormCategoryChangeHandler });
    }
    
    // Trigger change event on page load
    const cat = document.getElementById('song-form-category');
    if (cat) cat.dispatchEvent(new Event('change'));
    
    this.debugLog?.debug('Form events attached');
  }

  /**
   * Confirmation modal events (lines 1236-1238 from renderer.js)
   */
  attachConfirmationEvents() {
    const confirmationModalHiddenHandler = (event) => {
      try {
        if (window.restoreFocusToSearch) {
          window.restoreFocusToSearch();
        } else {
          this.debugLog?.warn('restoreFocusToSearch function not available');
        }
      } catch (error) {
        this.debugLog?.error('Error in confirmation modal hidden handler:', error);
      }
    };

    const confirmationModal = document.getElementById('confirmationModal');
    if (confirmationModal) {
      confirmationModal.addEventListener('hidden.bs.modal', confirmationModalHiddenHandler);
      this.uiHandlers.set('confirmationModalHidden', { element: confirmationModal, event: 'hidden.bs.modal', handler: confirmationModalHiddenHandler });
    }
    
    this.debugLog?.debug('Confirmation events attached');
  }

  /**
   * Detach all UI interaction events
   */
  detachEvents() {
    try {
      this.debugLog?.info('Detaching UI interaction events...');

      for (const [name, handler] of this.uiHandlers) {
        const target = handler.element;
        if (!target) continue;
        if (target === window) {
          window.removeEventListener(handler.event, handler.handler);
        } else if (typeof target === 'string') {
          document.querySelectorAll(target).forEach((el) => el.removeEventListener(handler.event, handler.handler));
        } else if (target instanceof Element || target === document) {
          target.removeEventListener(handler.event, handler.handler);
        }
        this.debugLog?.debug(`Removed UI handler: ${name}`);
      }

      this.uiHandlers.clear();
      this.eventsAttached = false;
      
      this.debugLog?.info('UI interaction events detached successfully');

    } catch (error) {
      this.debugLog?.error('Failed to detach UI interaction events:', error);
    }
  }

  /**
   * Get UI interaction events status
   */
  getStatus() {
    return {
      eventsAttached: this.eventsAttached,
      handlerCount: this.uiHandlers.size,
      handlers: Array.from(this.uiHandlers.keys())
    };
  }
}
