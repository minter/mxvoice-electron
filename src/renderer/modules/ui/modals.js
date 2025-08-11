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
  
  /**
   * Pick a directory using the system file dialog
   * @param {Event} event - The triggering event
   * @param {HTMLElement} element - The element to update with the selected path
   */
  function pickDirectory(event, element) {
    event.preventDefault();
    const defaultPath = $(element).val();
    try {
      if (window.secureElectronAPI?.app?.showDirectoryPicker) {
        window.secureElectronAPI.app.showDirectoryPicker(defaultPath).then(res => {
          if (res?.success && res.data && !res.data.canceled && Array.isArray(res.data.filePaths)) {
            const dir = res.data.filePaths[0];
            if (dir) $(element).val(dir);
          } else if (Array.isArray(res)) {
            const dir = res[0];
            if (dir) $(element).val(dir);
          }
        });
      } else if (window.electronAPI?.showDirectoryPicker) {
        window.electronAPI.showDirectoryPicker(defaultPath).then(res => {
          if (Array.isArray(res)) {
            const dir = res[0];
            if (dir) $(element).val(dir);
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
    $("#confirmationMessage").text(message);
    try { import('./bootstrap-adapter.js').then(({ showModal }) => showModal('#confirmationModal')); } catch {}

    // Store the callback to execute when confirmed
    $("#confirmationConfirmBtn")
      .off("click")
      .on("click", function () {
        try { import('./bootstrap-adapter.js').then(({ hideModal }) => hideModal('#confirmationModal')); } catch {}
        if (callback) {
          callback();
        }
      });
  }
  
  /**
   * Custom prompt dialog
   * @param {string} title - Dialog title
   * @param {string} message - Dialog message
   * @param {string} defaultValue - Default input value
   * @param {Function} callback - Callback function to execute with the input value
   */
  function customPrompt(title, message, defaultValue, callback) {
    $("#inputModalTitle").text(title);
    $("#inputModalMessage").text(message);
    $("#inputModalField").val(defaultValue);
    try { import('./bootstrap-adapter.js').then(({ showModal }) => showModal('#inputModal')); } catch {}
    
    // Focus on the input field and select text
    $("#inputModalField").focus();
    $("#inputModalField").select(); // Select all text so user can type over it
    
    // Handle Enter key
    $("#inputModalField").off("keypress").on("keypress", function(e) {
      if (e.which === 13) { // Enter key
        $("#inputModalConfirmBtn").click();
      }
    });
    
    $("#inputModalConfirmBtn").off("click").on("click", function () {
      const value = $("#inputModalField").val();
      try { import('./bootstrap-adapter.js').then(({ hideModal }) => hideModal('#inputModal')); } catch {}
      if (callback) {
        callback(value);
      }
    });
  }
  
  /**
   * Restore focus to search field after modal dismissal
   */
  function restoreFocusToSearch() {
    // Small delay to ensure modal is fully closed
    setTimeout(function () {
      if ($("#omni_search").is(":visible")) {
        $("#omni_search").focus();
      } else if ($("#title-search").is(":visible")) {
        $("#title-search").focus();
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