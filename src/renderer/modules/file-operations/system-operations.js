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
 * @param {HTMLElement|string} element - The element or CSS selector to update with the selected path
 */
export function pickDirectory(event, element) {
  event.preventDefault();
  
  // Handle both selector strings and element objects
  const el = typeof element === 'string' ? document.querySelector(element) : element;
  const defaultPath = (el && el instanceof Element) ? (el.value || '') : '';
  
  try {
    if (window.secureElectronAPI?.app?.showDirectoryPicker) {
      window.secureElectronAPI.app.showDirectoryPicker(defaultPath).then((res) => {
        if (res && res.success && res.data && !res.data.canceled && Array.isArray(res.data.filePaths)) {
          const dir = res.data.filePaths[0];
          if (dir && el && el instanceof Element) {
            el.value = dir;
          }
        } else if (Array.isArray(res)) {
          const dir = res[0];
          if (dir && el && el instanceof Element) {
            el.value = dir;
          }
        }
      });
    } else if (window.electronAPI?.showDirectoryPicker) {
      window.electronAPI.showDirectoryPicker(defaultPath).then((res) => {
        if (Array.isArray(res)) {
          const dir = res[0];
          if (dir && el && el instanceof Element) {
            el.value = dir;
          }
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