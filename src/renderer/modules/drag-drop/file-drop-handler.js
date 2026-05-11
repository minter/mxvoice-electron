/**
 * File Drop Handler
 *
 * Handles external file drops from the OS (Finder / Explorer) onto the app
 * window. Filters for supported audio extensions and routes to the appropriate
 * add-song flow (single or bulk).
 */

import { SUPPORTED_AUDIO_EXTS } from '../bulk-operations/bulk-operations.js';

// Import debug logger
let debugLog = null;
try {
  if (window.debugLog) {
    debugLog = window.debugLog;
  }
} catch (_error) {
  // Debug logger not available
}

// AbortController for cleanup on re-initialization
let fileDropAbortController = null;

// Debounce counter for dragleave (avoids flicker when moving between child elements)
let dragEnterCount = 0;

/**
 * Show the full-window drop overlay
 */
function showOverlay() {
  const overlay = document.getElementById('file-drop-overlay');
  if (overlay) overlay.classList.add('active');
}

/**
 * Hide the full-window drop overlay
 */
function hideOverlay() {
  const overlay = document.getElementById('file-drop-overlay');
  if (overlay) overlay.classList.remove('active');
}

/**
 * Show a brief auto-dismissing toast message near the top of the window
 * @param {string} message
 * @param {number} [duration=3000] - ms before auto-dismiss
 */
function showDropToast(message, duration = 3000) {
  // Remove any existing toast
  const existing = document.getElementById('file-drop-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'file-drop-toast';
  toast.textContent = message;
  Object.assign(toast.style, {
    position: 'fixed',
    top: '1rem',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: '10001',
    padding: '0.5rem 1.25rem',
    borderRadius: '0.375rem',
    background: 'rgba(0, 0, 0, 0.85)',
    color: 'white',
    fontSize: '0.9rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    opacity: '0',
    transition: 'opacity 0.2s ease'
  });
  document.body.appendChild(toast);

  // Fade in
  requestAnimationFrame(() => { toast.style.opacity = '1'; });

  // Auto-dismiss
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 200);
  }, duration);
}

/**
 * Check whether a modal is currently open (Bootstrap 5)
 * @returns {boolean}
 */
function isModalOpen() {
  return document.querySelector('.modal.show') !== null;
}

/**
 * Extract valid audio file paths from a DataTransfer object.
 * Uses Electron's webUtils.getPathForFile() via the preload bridge because
 * File.path is empty when sandbox is enabled.
 *
 * @param {DataTransfer} dataTransfer
 * @returns {string[]} Array of valid file paths
 */
function extractAudioFiles(dataTransfer) {
  if (!dataTransfer?.files?.length) return [];

  const getPath = window.secureElectronAPI?.utils?.getPathForFile;

  return [...dataTransfer.files]
    .filter(f => {
      const dot = f.name.lastIndexOf('.');
      if (dot === -1) return false;
      return SUPPORTED_AUDIO_EXTS.has(f.name.substring(dot).toLowerCase());
    })
    .map(f => {
      // Prefer webUtils.getPathForFile (works with sandbox), fall back to .path
      if (getPath) {
        try { return getPath(f); } catch (_e) { /* fall through */ }
      }
      return f.path;
    })
    .filter(Boolean);
}

/**
 * Route validated file paths to the correct add-song flow.
 * Delegates to showBulkAddFromFiles which handles threshold-based routing
 * (1 song = single add, 2-20 songs = multi-import, >20 songs = bulk add).
 *
 * @param {string[]} filePaths - Array of valid audio file paths
 */
async function routeFiles(filePaths) {
  if (!filePaths.length) {
    debugLog?.info('File drop: no supported audio files found', {
      module: 'file-drop-handler',
      function: 'routeFiles'
    });
    showDropToast('No supported audio files found');
    return;
  }

  debugLog?.info(`File drop: routing ${filePaths.length} file(s) to bulk-operations`, {
    module: 'file-drop-handler',
    function: 'routeFiles'
  });

  if (window.moduleRegistry?.bulkOperations?.showBulkAddFromFiles) {
    window.moduleRegistry.bulkOperations.showBulkAddFromFiles(filePaths);
  } else if (typeof window.showBulkAddFromFiles === 'function') {
    window.showBulkAddFromFiles(filePaths);
  } else {
    debugLog?.warn('showBulkAddFromFiles not available for file drop', {
      module: 'file-drop-handler',
      function: 'routeFiles'
    });
  }
}

/**
 * Handle files dropped from an external source (e.g. dock icon IPC)
 * @param {string[]} filePaths - Array of file paths
 */
export function handleExternalFileDrop(filePaths) {
  if (!Array.isArray(filePaths) || !filePaths.length) return;

  // Filter to supported audio extensions
  const valid = filePaths.filter(f => {
    const dot = f.lastIndexOf('.');
    if (dot === -1) return false;
    return SUPPORTED_AUDIO_EXTS.has(f.substring(dot).toLowerCase());
  });

  routeFiles(valid);
}

/**
 * Initialize document-level event listeners for OS file drops
 */
export function setupFileDropHandlers() {
  // Abort previous listeners before re-attaching
  cleanupFileDropHandlers();
  fileDropAbortController = new AbortController();
  const { signal } = fileDropAbortController;

  dragEnterCount = 0;

  // Prevent default on dragover (required to allow drop)
  document.addEventListener('dragover', (e) => {
    // Only intercept OS file drags (not internal song drags)
    if (!e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, { signal });

  // Show overlay on dragenter
  document.addEventListener('dragenter', (e) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault();
    dragEnterCount++;
    if (dragEnterCount === 1) {
      showOverlay();
    }
  }, { signal });

  // Hide overlay on dragleave (with counter to avoid child-element flicker)
  document.addEventListener('dragleave', (e) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    dragEnterCount--;
    if (dragEnterCount <= 0) {
      dragEnterCount = 0;
      hideOverlay();
    }
  }, { signal });

  // Handle the drop
  document.addEventListener('drop', (e) => {
    // Only intercept OS file drops
    if (!e.dataTransfer?.types?.includes('Files') || !e.dataTransfer.files.length) return;

    e.preventDefault();
    e.stopPropagation();
    dragEnterCount = 0;
    hideOverlay();

    // Don't process if a modal is open
    if (isModalOpen()) {
      debugLog?.info('File drop ignored — modal is open', {
        module: 'file-drop-handler',
        function: 'drop'
      });
      return;
    }

    const validFiles = extractAudioFiles(e.dataTransfer);
    routeFiles(validFiles);
  }, { signal, capture: true });

  debugLog?.info('File drop handlers initialized', {
    module: 'file-drop-handler',
    function: 'setupFileDropHandlers'
  });
}

/**
 * Clean up file drop event listeners
 */
export function cleanupFileDropHandlers() {
  fileDropAbortController?.abort();
  fileDropAbortController = null;
  dragEnterCount = 0;
  hideOverlay();
}
