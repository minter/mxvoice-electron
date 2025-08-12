/**
 * Bulk Operations Event Handlers
 * 
 * Handles UI event handlers for bulk operations functionality
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
 * Setup all bulk operations event handlers
 */
export function setupBulkEventHandlers() {
  // Handle bulk add category dropdown change
  const bulkSelect = document.getElementById('bulk-add-category');
  const newCatRow = document.getElementById('bulkSongFormNewCategory');
  const newCatInput = document.getElementById('bulk-song-form-new-category');
  if (bulkSelect) {
    const handler = () => {
      const optionValue = bulkSelect.value;
      if (optionValue === '--NEW--') {
        if (newCatRow) newCatRow.style.display = '';
        if (newCatInput) newCatInput.setAttribute('required', 'required');
      } else {
        if (newCatRow) newCatRow.style.display = 'none';
        if (newCatInput) newCatInput.removeAttribute('required');
      }
    };
    bulkSelect.addEventListener('change', handler);
    handler();
  }

  // Handle bulk add modal hidden event
  const bulkModal = document.getElementById('bulkAddModal');
  if (bulkModal) {
    bulkModal.addEventListener('hidden.bs.modal', function () {
      if (newCatRow) newCatRow.style.display = 'none';
      if (newCatInput) newCatInput.value = '';
    });
  }

  debugLog?.info('Bulk Operations Event Handlers initialized', { 
    module: 'bulk-operations-event-handlers',
    function: 'setupBulkEventHandlers'
  });
} 