/**
 * Modals Module
 * 
 * Handles modal operations including directory picking and update installation.
 * 
 * @module modals
 */

// Import debug logger
let debugLog = null;
try {
  // Try to get debug logger from global scope
  if (window.debugLog) {
    debugLog = window.debugLog;
  }
} catch (error) {
  // Debug logger not available
}

/**
 * Initialize the Modals module
 * @param {Object} options - Configuration options
 * @param {Object} options.electronAPI - Electron API reference
 * @param {Object} options.db - Database reference
 * @param {Object} options.store - Store reference
 * @returns {Object} Modals interface
 */
function initializeModals(options = {}) {
  const { electronAPI, db, store } = options;
  // DOM utilities (jQuery-free)
  let Dom = null;
  try {
    // Lazy import to avoid cyclic loads during bootstrap
    import('../dom-utils/index.js').then(mod => { Dom = mod.default; }).catch(() => {});
  } catch (_) {}
  
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
      if (window.secureElectronAPI?.app?.showDirectoryPicker) {
        window.secureElectronAPI.app.showDirectoryPicker(defaultPath).then(res => {
          if (res?.success && res.data && !res.data.canceled && Array.isArray(res.data.filePaths)) {
            const dir = res.data.filePaths[0];
            if (dir && el) el.value = dir;
          } else if (Array.isArray(res)) {
            const dir = res[0];
            if (dir && el) el.value = dir;
          }
        });
      } else if (window.electronAPI?.showDirectoryPicker) {
        window.electronAPI.showDirectoryPicker(defaultPath).then(res => {
          if (Array.isArray(res)) {
            const dir = res[0];
            if (dir && el) el.value = dir;
          }
        });
      }
    } catch (error) {
      debugLog?.warn('Directory picker failed', { module: 'ui-modals', function: 'pickDirectory', error: error?.message });
    }
  }
  
  /**
   * Install application update
   */
  function installUpdate() {
    try {
      if (window.secureElectronAPI?.fileOperations?.installUpdate) {
        return window.secureElectronAPI.fileOperations.installUpdate();
      } else if (window.electronAPI?.restartAndInstall) {
        return window.electronAPI.restartAndInstall();
      }
    } catch (error) {
      debugLog?.warn('Install update invoke failed', { module: 'ui-modals', function: 'installUpdate', error: error?.message });
    }
  }
  
  /**
   * Custom confirmation dialog
   * @param {string} message - Confirmation message
   * @param {Function} callback - Callback function to execute on confirmation
   */
  function customConfirm(message, callback) {
    const msgEl = document.getElementById('confirmationMessage');
    if (msgEl) msgEl.textContent = message;
    try { import('./bootstrap-adapter.js').then(({ showModal }) => showModal('#confirmationModal')); } catch {}

    // Store the callback to execute when confirmed
    const oldBtn = document.getElementById('confirmationConfirmBtn');
    if (oldBtn) {
      const newBtn = oldBtn.cloneNode(true);
      oldBtn.replaceWith(newBtn);
      newBtn.addEventListener('click', () => {
        try { import('./bootstrap-adapter.js').then(({ hideModal }) => hideModal('#confirmationModal')); } catch {}
        if (callback) callback();
      });
    }
  }
  
  /**
   * Custom prompt dialog
   * @param {string} title - Dialog title
   * @param {string} message - Dialog message
   * @param {string} defaultValue - Default input value
   * @param {Function} callback - Callback function to execute with the input value
   */
  function customPrompt(title, message, defaultValue, callback) {
    const titleEl = document.getElementById('inputModalTitle');
    const msgEl = document.getElementById('inputModalMessage');
    const inputEl = document.getElementById('inputModalField');
    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;
    if (inputEl) inputEl.value = defaultValue ?? '';
    try { import('./bootstrap-adapter.js').then(({ showModal }) => showModal('#inputModal')); } catch {}
    
    // Focus on the input field and select text
    if (inputEl) {
      inputEl.focus();
      inputEl.select();
    }
    
    // Handle Enter key
    if (inputEl) {
      const keyHandler = (e) => {
        const which = e.which || e.keyCode;
        if (which === 13) {
          const btn = document.getElementById('inputModalConfirmBtn');
          btn?.click();
        }
      };
      inputEl.replaceWith(inputEl.cloneNode(true));
      const freshInput = document.getElementById('inputModalField');
      freshInput?.addEventListener('keypress', keyHandler);
    }
    
    const oldConfirm = document.getElementById('inputModalConfirmBtn');
    if (oldConfirm) {
      const newConfirm = oldConfirm.cloneNode(true);
      oldConfirm.replaceWith(newConfirm);
      newConfirm.addEventListener('click', () => {
        const val = (document.getElementById('inputModalField') || {}).value || '';
        try { import('./bootstrap-adapter.js').then(({ hideModal }) => hideModal('#inputModal')); } catch {}
        if (callback) callback(val);
      });
    }
  }
  
  /**
   * Restore focus to search field after modal dismissal
   */
  function restoreFocusToSearch() {
    // Small delay to ensure modal is fully closed
    setTimeout(function () {
      const omni = document.getElementById('omni_search');
      const title = document.getElementById('title-search');
      const isVisible = (el) => !!el && el.offsetParent !== null;
      if (isVisible(omni)) {
        omni.focus();
      } else if (isVisible(title)) {
        title.focus();
      }
    }, 100);
  }
  
  return {
    pickDirectory,
    installUpdate,
    customConfirm,
    customPrompt,
    restoreFocusToSearch
  };
}

export {
  initializeModals
};

// Default export for module loading
export default initializeModals; 