/**
 * Modal Utilities
 * 
 * Provides modal dialog utilities for the MxVoice Electron application
 */

/**
 * Custom confirmation dialog
 * 
 * @param {string} message - The confirmation message
 * @param {string} title - The dialog title (default: 'Confirm')
 * @returns {Promise<boolean>} - Promise that resolves to true if confirmed, false if cancelled
 */
export function customConfirm(message, title = 'Confirm') {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">${title}</h5>
            <button type="button" class="close" data-dismiss="modal">
              <span>&times;</span>
            </button>
          </div>
          <div class="modal-body">
            <p>${message}</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary confirm-btn">Confirm</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const confirmBtn = modal.querySelector('.confirm-btn');
    const closeBtn = modal.querySelector('.close');
    const cancelBtn = modal.querySelector('.btn-secondary');

    const cleanup = () => {
      document.body.removeChild(modal);
    };

    confirmBtn.addEventListener('click', () => {
      cleanup();
      resolve(true);
    });

    closeBtn.addEventListener('click', () => {
      cleanup();
      resolve(false);
    });

    cancelBtn.addEventListener('click', () => {
      cleanup();
      resolve(false);
    });

    // Show modal
    $(modal).modal('show');
  });
}

/**
 * Custom prompt dialog
 * 
 * @param {string} message - The prompt message
 * @param {string} defaultValue - The default input value
 * @param {string} title - The dialog title (default: 'Input')
 * @returns {Promise<string|null>} - Promise that resolves to the input value or null if cancelled
 */
export function customPrompt(message, defaultValue = '', title = 'Input') {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">${title}</h5>
            <button type="button" class="close" data-dismiss="modal">
              <span>&times;</span>
            </button>
          </div>
          <div class="modal-body">
            <p>${message}</p>
            <input type="text" class="form-control prompt-input" value="${defaultValue}">
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary confirm-btn">OK</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const confirmBtn = modal.querySelector('.confirm-btn');
    const closeBtn = modal.querySelector('.close');
    const cancelBtn = modal.querySelector('.btn-secondary');
    const input = modal.querySelector('.prompt-input');

    const cleanup = () => {
      document.body.removeChild(modal);
    };

    confirmBtn.addEventListener('click', () => {
      const value = input.value.trim();
      cleanup();
      resolve(value || null);
    });

    closeBtn.addEventListener('click', () => {
      cleanup();
      resolve(null);
    });

    cancelBtn.addEventListener('click', () => {
      cleanup();
      resolve(null);
    });

    // Focus input and show modal
    $(modal).modal('show');
    setTimeout(() => input.focus(), 500);
  });
}

/**
 * Restore focus to search input
 * 
 * @param {string} selector - The search input selector (default: '#search-input')
 */
export function restoreFocusToSearch(selector = '#search-input') {
  const searchInput = document.querySelector(selector);
  if (searchInput) {
    searchInput.focus();
  }
}

// Default export for module loading
export default {
  customConfirm,
  customPrompt,
  restoreFocusToSearch
}; 