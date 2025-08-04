/**
 * Modals Module
 * 
 * Handles modal operations including directory picking and update installation.
 * 
 * @module modals
 */

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
    
    if (electronAPI && electronAPI.dialog) {
      electronAPI.dialog.showOpenDialog({
        properties: ['openDirectory'],
        defaultPath: defaultPath
      }).then(result => {
        if (!result.canceled && result.filePaths.length > 0) {
          $(element).val(result.filePaths[0]);
        }
      }).catch(error => {
        console.warn('❌ Directory picker failed:', error);
        // Fallback to legacy IPC
        if (typeof ipcRenderer !== 'undefined') {
          ipcRenderer.invoke("show-directory-picker", defaultPath).then((result) => {
            if (result) $(element).val(result);
          });
        }
      });
    } else if (typeof ipcRenderer !== 'undefined') {
      // Fallback to legacy IPC
      ipcRenderer.invoke("show-directory-picker", defaultPath).then((result) => {
        if (result) $(element).val(result);
      });
    }
  }
  
  /**
   * Install application update
   */
  function installUpdate() {
    if (electronAPI && electronAPI.app) {
      electronAPI.app.restartAndInstall().catch(error => {
        console.warn('❌ Modern API failed, falling back to legacy:', error);
        if (typeof ipcRenderer !== 'undefined') {
          ipcRenderer.send("restart-and-install-new-version");
        }
      });
    } else if (typeof ipcRenderer !== 'undefined') {
      ipcRenderer.send("restart-and-install-new-version");
    }
  }
  
  /**
   * Custom confirmation dialog
   * @param {string} message - Confirmation message
   * @param {Function} callback - Callback function to execute on confirmation
   */
  function customConfirm(message, callback) {
    $("#confirmationMessage").text(message);
    $("#confirmationModal").modal("show");

    // Store the callback to execute when confirmed
    $("#confirmationConfirmBtn")
      .off("click")
      .on("click", function () {
        $("#confirmationModal").modal("hide");
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
    $("#inputModal").modal("show");
    
    // Focus on the input field
    $("#inputModalField").focus();
    
    // Handle Enter key
    $("#inputModalField").off("keypress").on("keypress", function(e) {
      if (e.which === 13) { // Enter key
        $("#inputModalConfirmBtn").click();
      }
    });
    
    $("#inputModalConfirmBtn").off("click").on("click", function () {
      const value = $("#inputModalField").val();
      $("#inputModal").modal("hide");
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
  showModal,
  hideModal,
  setupModals,
  validateModals
};

// Default export for module loading
export default {
  showModal,
  hideModal,
  setupModals,
  validateModals
}; 