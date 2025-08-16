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
export async function installUpdate() {
  debugLog?.info("Installing update and restarting", { module: 'system-operations', function: 'installUpdate' });
  
  // Add more detailed logging
  debugLog?.info("installUpdate function called - checking available APIs", { 
    module: 'system-operations', 
    function: 'installUpdate',
    secureElectronAPIAvailable: !!window.secureElectronAPI,
    fileOperationsAvailable: !!window.secureElectronAPI?.fileOperations,
    installUpdateAvailable: !!window.secureElectronAPI?.fileOperations?.installUpdate,
    electronAPIAvailable: !!window.electronAPI,
    restartAndInstallAvailable: !!window.electronAPI?.restartAndInstall
  });
  
  try {
    // Show the updating modal immediately on user action and keep it until restart
    try {
      const statusEl = document.getElementById('updateStatusText');
      const progressEl = document.getElementById('updateProgressText');
      if (statusEl) statusEl.textContent = 'Preparing download…';
      if (progressEl) progressEl.textContent = '';
      const adapter = await import('../ui/bootstrap-adapter.js');
      adapter.showModal('#updateInProgressModal', { backdrop: 'static', keyboard: false });
    } catch (error) {
      debugLog?.warn('Failed to show update progress modal', { 
        module: 'system-operations', 
        function: 'installUpdate',
        error: error?.message || 'Unknown error' 
      });
    }

    if (window.secureElectronAPI?.fileOperations?.installUpdate) {
      debugLog?.info("Calling secureElectronAPI.fileOperations.installUpdate", { module: 'system-operations', function: 'installUpdate' });
      const result = await window.secureElectronAPI.fileOperations.installUpdate();
      debugLog?.info("secureElectronAPI.fileOperations.installUpdate returned:", { 
        module: 'system-operations', 
        function: 'installUpdate',
        result: result,
        resultType: typeof result
      });
      return result;
    } else if (window.electronAPI?.restartAndInstall) {
      debugLog?.info("Calling electronAPI.restartAndInstall", { module: 'system-operations', function: 'installUpdate' });
      return await window.electronAPI.restartAndInstall();
    } else {
      debugLog?.error("No update installation method available", { 
        module: 'system-operations', 
        function: 'installUpdate',
        availableAPIs: {
          secureElectronAPI: !!window.secureElectronAPI,
          fileOperations: !!window.secureElectronAPI?.fileOperations,
          installUpdate: !!window.secureElectronAPI?.fileOperations?.installUpdate,
          electronAPI: !!window.electronAPI,
          restartAndInstall: !!window.electronAPI?.restartAndInstall
        }
      });
    }
  } catch (error) {
    debugLog?.error('Update install failed to invoke', { 
      module: 'system-operations', 
      function: 'installUpdate', 
      error: error?.message,
      errorStack: error?.stack,
      errorType: typeof error
    });
  }
} 