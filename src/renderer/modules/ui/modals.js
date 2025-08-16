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
      
      if (window.secureElectronAPI?.fileOperations?.installUpdate) {
        return window.secureElectronAPI.fileOperations.installUpdate();
      } else if (window.electronAPI?.restartAndInstall) {
        return window.electronAPI.restartAndInstall();
      }
    } catch (error) {
      debugLog?.warn('Install update invoke failed', { module: 'ui-modals', function: 'installUpdate', error: error?.message });
    }
  }

  // Listen for update events to show progress
  try {
    window.addEventListener('mxvoice:update-download-progress', (e) => {
      // Only update UI if the update modal is already visible (user initiated)
      const modalEl = document.getElementById('updateInProgressModal');
      if (!modalEl || !modalEl.classList.contains('show')) return;
      const p = e?.detail || {};
      const text = document.getElementById('updateProgressText');
      const status = document.getElementById('updateStatusText');
      if (status) status.textContent = 'Downloading update…';
      if (text) {
        const pct = (typeof p.percent === 'number') ? Math.max(0, Math.min(100, p.percent)).toFixed(0) : '';
        const speed = (typeof p.bytesPerSecond === 'number') ? `${Math.round(p.bytesPerSecond / 1024 / 1024)} MB/s` : '';
        const transferred = (typeof p.transferred === 'number') ? `${Math.round(p.transferred / 1024 / 1024)} MB` : '';
        const total = (typeof p.total === 'number') ? `${Math.round(p.total / 1024 / 1024)} MB` : '';
        text.textContent = pct ? `${pct}% • ${transferred}/${total} • ${speed}` : '';
      }
    });
  } catch (error) {
    debugLog?.warn('Failed to add update download progress event listener', { 
      module: 'ui-modals', 
      function: 'event-listener-setup',
      error: error?.message || 'Unknown error' 
    });
  }

  try {
    window.addEventListener('mxvoice:update-ready', () => {
      // Only update UI if modal already visible
      const modalEl = document.getElementById('updateInProgressModal');
      if (!modalEl || !modalEl.classList.contains('show')) return;
      const status = document.getElementById('updateStatusText');
      const text = document.getElementById('updateProgressText');
      if (status) status.textContent = 'Installing update…';
      if (text) text.textContent = '';
    });
  } catch (error) {
    debugLog?.warn('Failed to add update ready event listener', { 
      module: 'ui-modals', 
      function: 'event-listener-setup',
      error: error?.message || 'Unknown error' 
    });
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