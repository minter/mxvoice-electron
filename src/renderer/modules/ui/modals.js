/**
 * Modals Module
 * 
 * Handles modal operations including directory picking and update installation.
 * 
 * @module modals
 */

import { customConfirm, customPrompt } from '../utils/index.js';

// Import debug logger
let debugLog = null;
try {
  // Try to get debug logger from global scope
  if (window.debugLog) {
    debugLog = window.debugLog;
  }
} catch (_error) {
  // Debug logger not available
}

/**
 * Initialize the Modals module
 * @param {Object} options - Configuration options
 * @param {Object} options.electronAPI - Electron API reference
 * @returns {Object} Modals interface
 */
function initializeModals(options = {}) {
  const { electronAPI } = options;
  
  // DOM utilities (jQuery-free)
  let _Dom = null;
  try {
    // Lazy import to avoid cyclic loads during bootstrap
    import('../dom-utils/index.js').then(mod => { _Dom = mod.default; }).catch(err => { debugLog?.warn('Failed to import DOM utilities for modals', { module: 'ui-modals', error: err?.message }); });
  } catch (error) {
    debugLog?.warn('Failed to import DOM utilities during modal initialization', { 
      module: 'ui-modals', 
      function: 'modal-init',
      error: error?.message || 'Unknown error' 
    });
  }
  
  /**
   * Pick a directory using the system file dialog
   * @param {Event} event - The triggering event
   * @param {HTMLElement} element - The element to update with the selected path
   */
  function pickDirectory(event, element) {
    event.preventDefault();
    const el = typeof element === 'string' ? document.querySelector(element) : element;
    const defaultPath = el?.value || '';
    
    try {
      if (electronAPI?.app?.showDirectoryPicker) {
        electronAPI.app.showDirectoryPicker(defaultPath).then(res => {
          if (res?.success && res.data && !res.data.canceled && Array.isArray(res.data.filePaths)) {
            const dir = res.data.filePaths[0];
            if (dir && el) el.value = dir;
          }
        });
      }
    } catch (error) {
      debugLog?.warn('Directory picker failed', { 
        module: 'ui-modals', 
        function: 'pickDirectory', 
        error: error?.message 
      });
    }
  }
  
  /**
   * Install application update
   */
  function installUpdate() {
    try {
      // Show updating modal immediately
      try { 
        import('./bootstrap-adapter.js').then(({ showModal }) => 
          showModal('#updateInProgressModal', { backdrop: 'static', keyboard: false })
        ); 
      } catch (error) {
        debugLog?.warn('Failed to show update progress modal', { 
          module: 'ui-modals', 
          function: 'installUpdate',
          error: error?.message || 'Unknown error' 
        });
      }
      
      const statusEl = document.getElementById('updateStatusText');
      if (statusEl) statusEl.textContent = 'Preparing installation…';
      
      if (electronAPI?.fileOperations?.installUpdate) {
        return electronAPI.fileOperations.installUpdate();
      }
    } catch (error) {
      debugLog?.error('Install update failed', { 
        module: 'ui-modals', 
        function: 'installUpdate', 
        error: error?.message 
      });
    }
  }
  
  return {
    pickDirectory,
    installUpdate,
    customConfirm,
    customPrompt
  };
}

export {
  initializeModals
};

// Default export for module loading
export default initializeModals;
