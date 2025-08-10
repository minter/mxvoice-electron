/**
 * System Operations - Directory Picking and Update Installation
 * 
 * Handles system-level file operations like directory picking and update installation
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
 * Opens a directory picker dialog and updates the specified element with the selected path
 * 
 * @param {Event} event - The triggering event
 * @param {HTMLElement} element - The element to update with the selected path
 */
export function pickDirectory(event, element) {
  event.preventDefault();
  const defaultPath = $(element).val();
  ipcRenderer.invoke("show-directory-picker", defaultPath).then((result) => {
    if (result) $(element).val(result);
  });
}

/**
 * Installs an update using the modern electronAPI with fallback to legacy ipcRenderer
 * Triggers the application restart and update installation process
 */
export function installUpdate() {
  debugLog?.info("Installing update and restarting", { module: 'system-operations', function: 'installUpdate' });
  return secureSystem.restartAndInstall().catch(error => {
    debugLog?.warn('Secure system API failed, falling back to legacy:', { 
      module: 'system-operations',
      function: 'installUpdate',
      error: error.message
    });
    ipcRenderer.send("restart-and-install-new-version");
  });
} 