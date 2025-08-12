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
  const defaultPath = (element && element instanceof Element) ? (element.value || '') : '';
  try {
    if (window.secureElectronAPI?.app?.showDirectoryPicker) {
      window.secureElectronAPI.app.showDirectoryPicker(defaultPath).then((res) => {
        if (res && res.success && res.data && !res.data.canceled && Array.isArray(res.data.filePaths)) {
          const dir = res.data.filePaths[0];
          if (dir && element && element instanceof Element) element.value = dir;
        } else if (Array.isArray(res)) {
          const dir = res[0];
          if (dir && element && element instanceof Element) element.value = dir;
        }
      });
    } else if (window.electronAPI?.showDirectoryPicker) {
      window.electronAPI.showDirectoryPicker(defaultPath).then((res) => {
        if (Array.isArray(res)) {
          const dir = res[0];
          if (dir && element && element instanceof Element) element.value = dir;
        }
      });
    }
  } catch (err) {
    debugLog?.warn('Directory picker failed', { module: 'system-operations', function: 'pickDirectory', error: err?.message });
  }
}

/**
 * Installs an update using the modern electronAPI with fallback to legacy ipcRenderer
 * Triggers the application restart and update installation process
 */
export function installUpdate() {
  debugLog?.info("Installing update and restarting", { module: 'system-operations', function: 'installUpdate' });
  try {
    if (window.secureElectronAPI?.fileOperations?.installUpdate) {
      return window.secureElectronAPI.fileOperations.installUpdate();
    } else if (window.electronAPI?.restartAndInstall) {
      return window.electronAPI.restartAndInstall();
    }
  } catch (error) {
    debugLog?.warn('Update install failed to invoke', { module: 'system-operations', function: 'installUpdate', error: error?.message });
  }
} 