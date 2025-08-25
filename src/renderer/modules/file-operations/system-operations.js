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
 * Auto-Update Functions - Single-modal process for better UX
 */

// Global state to coordinate between startUpdateProcess and handleUpdateReady
let updateProcessState = {
  isActive: false,
  isDownloading: false,
  isReady: false
};

/**
 * Single-flow update process: Download → Install → Restart
 * Handles the entire update flow in one function with progress updates
 */
export async function startUpdateProcess() {
  debugLog?.info("🚀 Starting complete update process...", { module: 'system-operations', function: 'startUpdateProcess' });
  
  try {
    // Set coordination state
    updateProcessState.isActive = true;
    updateProcessState.isDownloading = true;
    updateProcessState.isReady = false;
    
    const installBtn = document.getElementById('installNowBtn');
    
    // Step 1: Start download
    if (installBtn) {
      installBtn.disabled = true;
      installBtn.textContent = 'Starting download...';
    }
    
    if (!window.secureElectronAPI?.fileOperations?.downloadUpdate) {
      throw new Error('Download update not available');
    }
    
    // Start download
    const downloadResult = await window.secureElectronAPI.fileOperations.downloadUpdate();
    debugLog?.info("Download initiated:", { 
      module: 'system-operations', 
      function: 'startUpdateProcess',
      result: downloadResult 
    });
    
    if (!downloadResult?.success) {
      throw new Error(downloadResult?.error || 'Download failed');
    }
    
    // Only update button if we haven't already moved to the ready state
    if (installBtn && updateProcessState.isDownloading && !updateProcessState.isReady) {
      installBtn.textContent = 'Downloading...';
    }
    
    // handleUpdateReady will take over when download completes
    
    return { success: true };
    
  } catch (error) {
    // Reset coordination state on error
    updateProcessState.isActive = false;
    updateProcessState.isDownloading = false;
    updateProcessState.isReady = false;
    
    debugLog?.error('Update process failed:', { 
      module: 'system-operations', 
      function: 'startUpdateProcess', 
      error: error?.message 
    });
    
    const installBtn = document.getElementById('installNowBtn');
    if (installBtn) {
      installBtn.disabled = false;
      installBtn.textContent = 'Try Again';
    }
    
    // Show error in modal body
    const modalBody = document.querySelector('#newReleaseModal .modal-body');
    if (modalBody) {
      modalBody.innerHTML += `<div class="alert alert-danger mt-2">Update failed: ${error?.message}</div>`;
    }
    
    return { success: false, error: error?.message };
  }
}

/**
 * Auto-Update Functions - Individual stages (kept for compatibility)
 */

/**
 * Stage 1: Check for available updates
 * Shows user if updates are available without downloading
 */
export async function checkForUpdate() {
  debugLog?.info("🔍 RENDERER: checkForUpdate function called", { module: 'system-operations', function: 'checkForUpdate' });
  
  try {
    // Update UI to show checking state
    updateUIState('checking', 'Checking for updates...');
    
    debugLog?.info("🔍 RENDERER: Checking API availability", { 
      module: 'system-operations', 
      function: 'checkForUpdate',
      secureElectronAPIAvailable: !!window.secureElectronAPI,
      fileOperationsAvailable: !!window.secureElectronAPI?.fileOperations,
      checkForUpdateAvailable: !!window.secureElectronAPI?.fileOperations?.checkForUpdate
    });
    
    if (!window.secureElectronAPI?.fileOperations?.checkForUpdate) {
      throw new Error('Check for update not available');
    }
    
    debugLog?.info("🔍 RENDERER: About to call IPC checkForUpdate", { module: 'system-operations', function: 'checkForUpdate' });
    const result = await window.secureElectronAPI.fileOperations.checkForUpdate();
    debugLog?.info("🔍 RENDERER: IPC checkForUpdate returned", { module: 'system-operations', function: 'checkForUpdate', result });
    debugLog?.info("Check for update result:", { 
      module: 'system-operations', 
      function: 'checkForUpdate',
      result: result 
    });
    
    if (result?.success && result?.updateAvailable) {
      const version = result?.updateInfo?.version || 'unknown';
      updateUIState('update-available', `Update available: ${version}`, result?.updateInfo);
      return { success: true, updateAvailable: true, updateInfo: result?.updateInfo };
    } else if (result?.success) {
      updateUIState('up-to-date', 'You are up to date!');
      return { success: true, updateAvailable: false };
    } else {
      throw new Error(result?.error || 'Check failed');
    }
  } catch (error) {
    debugLog?.error('Check for update failed:', { 
      module: 'system-operations', 
      function: 'checkForUpdate', 
      error: error?.message 
    });
    updateUIState('error', `Check failed: ${error?.message}`);
    return { success: false, error: error?.message };
  }
}

/**
 * Stage 2: Download the available update
 * Shows progress and enables install when complete
 */
export async function downloadUpdate() {
  debugLog?.info("Starting update download...", { module: 'system-operations', function: 'downloadUpdate' });
  
  try {
    // Update UI to show download starting
    updateUIState('downloading', 'Starting download...');
    
    if (!window.secureElectronAPI?.fileOperations?.downloadUpdate) {
      throw new Error('Download update not available');
    }
    
    const result = await window.secureElectronAPI.fileOperations.downloadUpdate();
    debugLog?.info("Download update result:", { 
      module: 'system-operations', 
      function: 'downloadUpdate',
      result: result 
    });
    
    if (result?.success) {
      // Check if the update is already ready (instant download from cache)
      // If so, don't override the 'ready' state
      const installBtn = document.getElementById('installUpdateBtn');
      const isAlreadyReady = installBtn && !installBtn.disabled && installBtn.style.display !== 'none';
      
      if (!isAlreadyReady) {
        updateUIState('downloading', 'Download started...');
      }
      return { success: true };
    } else {
      throw new Error(result?.error || 'Download failed');
    }
  } catch (error) {
    debugLog?.error('Download update failed:', { 
      module: 'system-operations', 
      function: 'downloadUpdate', 
      error: error?.message 
    });
    updateUIState('error', `Download failed: ${error?.message}`);
    return { success: false, error: error?.message };
  }
}

/**
 * Stage 3: Install the downloaded update
 * Restarts the app to complete installation
 */
export async function installUpdate() {
  debugLog?.info("Installing update and restarting...", { module: 'system-operations', function: 'installUpdate' });
  
  try {
    if (!window.secureElectronAPI?.fileOperations?.installUpdate) {
      throw new Error('Install update not available');
    }
    
    // Show countdown before restart
    const countdownSeconds = 3;
    for (let i = countdownSeconds; i > 0; i--) {
      updateUIState('installing', `Restarting in ${i} second${i > 1 ? 's' : ''}...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Final message before restart
    updateUIState('installing', 'Restarting now...');
    
    const result = await window.secureElectronAPI.fileOperations.installUpdate();
    debugLog?.info("Install update result:", { 
    module: 'system-operations', 
    function: 'installUpdate',
      result: result 
    });
    
    // App should quit and restart at this point
    return result;
  } catch (error) {
    debugLog?.error('Install update failed:', { 
      module: 'system-operations', 
      function: 'installUpdate', 
      error: error?.message 
    });
    updateUIState('error', `Install failed: ${error?.message}`);
    return { success: false, error: error?.message };
  }
}

/**
 * Update the UI to reflect current update state
 * @param {string} state - Current state: 'checking', 'up-to-date', 'update-available', 'downloading', 'ready', 'installing', 'error'
 * @param {string} message - Status message to display
 * @param {object} updateInfo - Optional update information
 */
function updateUIState(state, message, updateInfo = null) {
  try {
    // Find the update UI elements
      const statusEl = document.getElementById('updateStatusText');
      const progressEl = document.getElementById('updateProgressText');
    const checkBtn = document.getElementById('checkUpdateBtn');
    const downloadBtn = document.getElementById('downloadUpdateBtn');
    const installBtn = document.getElementById('installUpdateBtn');
    
    // Update status text
    if (statusEl) statusEl.textContent = message;
    
    // Update button states based on current state
    const buttons = { checkBtn, downloadBtn, installBtn };
    Object.values(buttons).forEach(btn => {
      if (btn) {
        btn.disabled = true;
        btn.style.display = 'none';
      }
    });
    
    switch (state) {
      case 'checking':
        if (checkBtn) {
          checkBtn.disabled = true;
          checkBtn.style.display = 'inline-block';
          checkBtn.textContent = 'Checking...';
        }
        break;
        
      case 'up-to-date':
        if (checkBtn) {
          checkBtn.disabled = false;
          checkBtn.style.display = 'inline-block';
          checkBtn.textContent = 'Check Again';
        }
        break;
        
      case 'update-available':
        if (downloadBtn) {
          downloadBtn.disabled = false;
          downloadBtn.style.display = 'inline-block';
          downloadBtn.textContent = `Install Update`;
        }
        if (checkBtn) {
          checkBtn.disabled = false;
          checkBtn.style.display = 'inline-block';
          checkBtn.textContent = 'Check Again';
        }
        break;
        
      case 'downloading':
        if (downloadBtn) {
          downloadBtn.disabled = true;
          downloadBtn.style.display = 'inline-block';
          downloadBtn.textContent = 'Installing...';
        }
        break;
        
      case 'ready':
        if (installBtn) {
          installBtn.disabled = false;
          installBtn.style.display = 'inline-block';
          installBtn.textContent = 'Restart Now';
        }
        break;
        
      case 'installing':
        if (installBtn) {
          installBtn.disabled = true;
          installBtn.style.display = 'inline-block';
          installBtn.textContent = 'Restarting...';
        }
        break;
        
      case 'error':
        if (checkBtn) {
          checkBtn.disabled = false;
          checkBtn.style.display = 'inline-block';
          checkBtn.textContent = 'Try Again';
        }
        // Auto-hide error after 5 seconds
        setTimeout(() => {
          updateUIState('checking', 'View update details');
        }, 5000);
        break;
    }
    
    debugLog?.info('UI state updated', { 
      module: 'system-operations', 
      function: 'updateUIState',
      state: state,
      message: message 
    });
  } catch (error) {
    debugLog?.warn('Failed to update UI state', { 
      module: 'system-operations', 
      function: 'updateUIState',
      error: error?.message 
    });
  }
}

/**
 * Handle download progress updates from the main process
 * @param {object} progress - Progress information with percent, transferred, total
 */
export function handleDownloadProgress(progress) {
  try {
    // Only update progress if we're actively downloading and not ready yet
    if (!updateProcessState.isActive || !updateProcessState.isDownloading || updateProcessState.isReady) {
      return;
    }
    
    const { percent, transferred, total } = progress;
    const installBtn = document.getElementById('installNowBtn');
    
    if (!installBtn) return;
    
    let progressText = `Downloading... ${Math.round(percent || 0)}%`;
    
    if (transferred && total) {
      const transferredMB = (transferred / 1024 / 1024).toFixed(1);
      const totalMB = (total / 1024 / 1024).toFixed(1);
      progressText = `Downloading... ${Math.round(percent || 0)}% (${transferredMB}/${totalMB} MB)`;
    }
    
    installBtn.textContent = progressText;
    
    } catch (error) {
    debugLog?.warn('Failed to handle download progress', { 
      module: 'system-operations', 
      function: 'handleDownloadProgress',
      error: error?.message 
    });
  }
}

/**
 * Handle update ready notification from the main process
 */
export async function handleUpdateReady(version) {
  try {
    // Only proceed if we're in an active update process
    if (!updateProcessState.isActive) {
      return;
    }
    
    // Mark as ready and stop downloading state
    updateProcessState.isReady = true;
    updateProcessState.isDownloading = false;
    
    const installBtn = document.getElementById('installNowBtn');
    
    if (!installBtn) return;
    
    // Update is downloaded and ready to install
    debugLog?.info("Update ready, starting install countdown...", { 
        module: 'system-operations', 
      function: 'handleUpdateReady',
      version: version 
    });
    
    // Start the install countdown (increased to 5 seconds)
    const countdownSeconds = 5;
    for (let i = countdownSeconds; i > 0; i--) {
      // Double-check we're still in ready state (prevent race conditions)
      if (!updateProcessState.isReady) return;
      
      installBtn.textContent = `Restarting in ${i} second${i > 1 ? 's' : ''}...`;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Final message and install
    if (updateProcessState.isReady) {
      installBtn.textContent = 'Restarting now...';
      
      if (!window.secureElectronAPI?.fileOperations?.installUpdate) {
        throw new Error('Install update not available');
      }
      
      const result = await window.secureElectronAPI.fileOperations.installUpdate();
      debugLog?.info("Install update result:", { 
        module: 'system-operations', 
        function: 'handleUpdateReady',
        result: result 
      });
    }
    
    // App should quit and restart at this point
    
  } catch (error) {
    // Reset coordination state on error
    updateProcessState.isActive = false;
    updateProcessState.isDownloading = false;
    updateProcessState.isReady = false;
    
    debugLog?.warn('Failed to handle update ready', { 
      module: 'system-operations', 
      function: 'handleUpdateReady',
      error: error?.message 
    });
    
    const installBtn = document.getElementById('installNowBtn');
    if (installBtn) {
      installBtn.disabled = false;
      installBtn.textContent = 'Try Again';
    }
  }
} 