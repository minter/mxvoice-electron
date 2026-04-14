/**
 * Library Transfer Module
 *
 * Handles UI for exporting and importing the entire Mx. Voice library.
 * Uses Bootstrap modals for progress display and import confirmation.
 */

import { info, error } from '../debug-log/index.js';

let electronAPI = null;
let exportProgressCleanup = null;
let importProgressCleanup = null;

/**
 * Initialize the Library Transfer module
 * @param {Object} options - Configuration options
 * @param {Object} options.electronAPI - Electron API reference
 */
function initializeLibraryTransfer(options = {}) {
  electronAPI = options.electronAPI || (typeof window !== 'undefined' && window.secureElectronAPI);

  info('Library Transfer module initialized', {
    module: 'library-transfer',
    function: 'initializeLibraryTransfer',
    hasElectronAPI: !!electronAPI
  });

  setupDomHandlers();
}

/**
 * Setup DOM event handlers
 */
function setupDomHandlers() {
  if (typeof document === 'undefined') return;

  const confirmBtn = document.getElementById('libraryImportConfirmBtn');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', confirmImport);
  }
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Show the transfer progress modal
 */
async function showProgressModal(title) {
  const { showModal } = await import('../ui/bootstrap-adapter.js');
  const titleEl = document.getElementById('libraryTransferTitle');
  const messageEl = document.getElementById('library-transfer-message');
  const barEl = document.getElementById('library-transfer-bar');
  const footerEl = document.getElementById('library-transfer-footer');
  const infoEl = document.getElementById('library-transfer-info');

  const percentEl = document.getElementById('library-transfer-percent');

  if (titleEl) titleEl.textContent = title;
  if (messageEl) messageEl.textContent = 'Preparing...';
  if (barEl) barEl.style.width = '0%';
  if (percentEl) percentEl.textContent = '0%';
  if (footerEl) footerEl.style.display = 'none';
  if (infoEl) infoEl.style.display = 'none';

  showModal('#libraryTransferModal');
}

/**
 * Update the progress bar in the modal
 */
function updateProgress({ percent, message }) {
  const messageEl = document.getElementById('library-transfer-message');
  const barEl = document.getElementById('library-transfer-bar');
  const percentEl = document.getElementById('library-transfer-percent');

  if (messageEl && message) messageEl.textContent = message;
  if (barEl) barEl.style.width = `${percent}%`;
  if (percentEl) percentEl.textContent = `${percent}%`;
}

/**
 * Show completion state in the modal
 */
function showComplete(message) {
  const messageEl = document.getElementById('library-transfer-message');
  const barEl = document.getElementById('library-transfer-bar');
  const footerEl = document.getElementById('library-transfer-footer');

  const percentEl = document.getElementById('library-transfer-percent');

  if (messageEl) messageEl.textContent = message;
  if (barEl) {
    barEl.style.width = '100%';
    barEl.classList.remove('progress-bar-animated', 'progress-bar-striped');
    barEl.classList.add('bg-success');
  }
  if (percentEl) percentEl.textContent = '100%';
  if (footerEl) footerEl.style.display = '';
}

/**
 * Show error state in the modal
 */
function showError(message) {
  const messageEl = document.getElementById('library-transfer-message');
  const barEl = document.getElementById('library-transfer-bar');
  const footerEl = document.getElementById('library-transfer-footer');

  if (messageEl) {
    messageEl.textContent = message;
    messageEl.classList.add('text-danger');
    messageEl.classList.remove('text-muted');
  }
  if (barEl) {
    barEl.classList.add('bg-danger');
  }
  if (footerEl) footerEl.style.display = '';
}

/**
 * Reset the progress modal to initial state
 */
function resetProgressModal() {
  const messageEl = document.getElementById('library-transfer-message');
  const barEl = document.getElementById('library-transfer-bar');

  if (messageEl) {
    messageEl.classList.remove('text-danger');
    messageEl.classList.add('text-muted');
  }
  if (barEl) {
    barEl.classList.remove('bg-success', 'bg-danger');
    barEl.classList.add('progress-bar-animated', 'progress-bar-striped');
  }
}

/**
 * Start the library export process
 */
async function startExport() {
  if (!electronAPI || !electronAPI.library) {
    error('Electron API not available for library transfer', {
      module: 'library-transfer', function: 'startExport'
    });
    return;
  }

  info('Starting library export', { module: 'library-transfer', function: 'startExport' });

  resetProgressModal();
  await showProgressModal('Exporting Library');

  // Listen for progress updates
  if (exportProgressCleanup) exportProgressCleanup();
  exportProgressCleanup = electronAPI.library.onExportProgress(updateProgress);

  try {
    const result = await electronAPI.library.exportLibrary();

    if (exportProgressCleanup) {
      exportProgressCleanup();
      exportProgressCleanup = null;
    }

    if (result.canceled) {
      const { hideModal } = await import('../ui/bootstrap-adapter.js');
      hideModal('#libraryTransferModal');
      return;
    }

    if (result.success) {
      const sizeStr = result.archiveSize ? ` (${formatBytes(result.archiveSize)})` : '';
      showComplete(`Export complete!${sizeStr}`);
      info('Library export complete', {
        module: 'library-transfer', function: 'startExport',
        archiveSize: result.archiveSize
      });
    } else {
      showError(`Export failed: ${result.error}`);
      error('Library export failed', {
        module: 'library-transfer', function: 'startExport',
        error: result.error
      });
    }
  } catch (err) {
    if (exportProgressCleanup) {
      exportProgressCleanup();
      exportProgressCleanup = null;
    }
    showError(`Export failed: ${err.message}`);
    error('Library export error', {
      module: 'library-transfer', function: 'startExport',
      error: err.message
    });
  }
}

// Store archive path between import steps
let pendingImportPath = null;

/**
 * Start the library import process (file selection + confirmation)
 */
async function startImport() {
  if (!electronAPI || !electronAPI.library) {
    error('Electron API not available for library transfer', {
      module: 'library-transfer', function: 'startImport'
    });
    return;
  }

  info('Starting library import', { module: 'library-transfer', function: 'startImport' });

  // Listen for progress events so we can show the validation modal
  // once the user selects a file (before the IPC call returns)
  let validationModalShown = false;
  if (importProgressCleanup) importProgressCleanup();
  importProgressCleanup = electronAPI.library.onImportProgress(({ percent, message }) => {
    if (!validationModalShown) {
      validationModalShown = true;
      resetProgressModal();
      showProgressModal('Validating Library');
    }
    updateProgress({ percent, message });
  });

  try {
    const result = await electronAPI.library.importLibrary();

    // Clean up validation progress listener
    if (importProgressCleanup) {
      importProgressCleanup();
      importProgressCleanup = null;
    }

    if (result.canceled) {
      // Hide modal in case it was shown before cancel
      if (validationModalShown) {
        const { hideModal } = await import('../ui/bootstrap-adapter.js');
        hideModal('#libraryTransferModal');
      }
      return;
    }

    // Hide validation modal before showing error or confirmation
    if (validationModalShown) {
      const { hideModal } = await import('../ui/bootstrap-adapter.js');
      hideModal('#libraryTransferModal');
    }

    if (!result.success) {
      // Show error in the progress modal
      resetProgressModal();
      await showProgressModal('Import Error');
      showError(result.error || 'Failed to validate the library file.');
      return;
    }

    // Store path and show confirmation modal with manifest details
    pendingImportPath = result.archivePath;
    const manifest = result.manifest;

    const manifestInfo = document.getElementById('library-import-manifest-info');
    if (manifestInfo) {
      // Build info display using DOM methods to prevent XSS
      manifestInfo.innerHTML = '';

      const table = document.createElement('table');
      table.className = 'table table-sm table-borderless mb-0';
      const tbody = document.createElement('tbody');

      const rows = [
        ['Created', new Date(manifest.createdAt).toLocaleString()],
        ['App Version', manifest.appVersion || 'Unknown'],
        ['Source Platform', manifest.platform || 'Unknown'],
        ['Songs in Database', manifest.contents?.hasDatabase ? 'Yes' : 'No'],
        ['Music Files', String(manifest.contents?.mp3Count || 0)],
        ['Profiles', String(manifest.contents?.profileCount || 0)],
        ['Hotkey Files', String(manifest.contents?.hotkeyCount || 0)]
      ];

      if (manifest.archiveSize) {
        rows.push(['Archive Size', formatBytes(manifest.archiveSize)]);
      }

      for (const [label, value] of rows) {
        const tr = document.createElement('tr');
        const th = document.createElement('th');
        th.className = 'text-muted';
        th.style.width = '40%';
        th.textContent = label;
        const td = document.createElement('td');
        td.textContent = value;
        tr.appendChild(th);
        tr.appendChild(td);
        tbody.appendChild(tr);
      }

      table.appendChild(tbody);
      manifestInfo.appendChild(table);
    }

    const { showModal } = await import('../ui/bootstrap-adapter.js');
    showModal('#libraryImportConfirmModal');
  } catch (err) {
    error('Library import error', {
      module: 'library-transfer', function: 'startImport',
      error: err.message
    });
  }
}

/**
 * Confirm and execute the import
 */
async function confirmImport() {
  if (!pendingImportPath) {
    error('No pending import path', { module: 'library-transfer', function: 'confirmImport' });
    return;
  }

  const archivePath = pendingImportPath;
  pendingImportPath = null;

  // Close confirmation modal, show progress modal
  const { hideModal } = await import('../ui/bootstrap-adapter.js');
  hideModal('#libraryImportConfirmModal');

  resetProgressModal();
  await showProgressModal('Importing Library');

  // Listen for progress updates
  if (importProgressCleanup) importProgressCleanup();
  importProgressCleanup = electronAPI.library.onImportProgress(updateProgress);

  try {
    const result = await electronAPI.library.confirmImport(archivePath);

    if (importProgressCleanup) {
      importProgressCleanup();
      importProgressCleanup = null;
    }

    if (result.success) {
      showComplete('Import complete! The application will restart to apply changes.');
      info('Library import complete, restarting', {
        module: 'library-transfer', function: 'confirmImport'
      });
      window.secureElectronAPI?.analytics?.trackEvent?.('library_imported', { song_count: result.songCount || 0 });

      // Prevent stale state from being saved
      if (typeof window !== 'undefined') {
        window.isRestoringProfileState = true;
      }

      // Restart after a brief delay to let the user see the message
      setTimeout(async () => {
        try {
          await electronAPI.app.restart();
        } catch {
          // Fallback: reload the window
          window.location.reload();
        }
      }, 2000);
    } else {
      showError(`Import failed: ${result.error}`);
      error('Library import failed', {
        module: 'library-transfer', function: 'confirmImport',
        error: result.error
      });
    }
  } catch (err) {
    if (importProgressCleanup) {
      importProgressCleanup();
      importProgressCleanup = null;
    }
    showError(`Import failed: ${err.message}`);
    error('Library import error', {
      module: 'library-transfer', function: 'confirmImport',
      error: err.message
    });
  }
}

export {
  initializeLibraryTransfer,
  startExport,
  startImport
};

export default {
  initializeLibraryTransfer,
  startExport,
  startImport
};
