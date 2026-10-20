/**
 * Modal Utilities
 * 
 * Provides modal dialog utilities for the MxVoice Electron application
 */

import { escapeHtml } from '../dom-utils/escape-html.js';

/**
 * Hide a dynamically created dialog and remove its element from the DOM.
 * Removal happens on 'hidden.bs.modal' rather than a fixed timer so the
 * element is gone as soon as Bootstrap finishes hiding — a timer leaves a
 * window where a newly opened dialog coexists with the old element.
 */
function hideAndRemoveModal(modal) {
  const instance = bootstrap.Modal.getOrCreateInstance(modal);
  const removeModal = () => { modal.remove(); };
  if (modal.classList.contains('show')) {
    modal.addEventListener('hidden.bs.modal', removeModal, { once: true });
    instance.hide();
    // Safety net in case 'hidden.bs.modal' never fires
    setTimeout(removeModal, 1000);
  } else {
    // Already hidden (e.g. dismissed via backdrop or Esc)
    instance.hide();
    removeModal();
  }
}

/**
 * Custom confirmation dialog
 *
 * Esc, a backdrop click and the close button all answer false.
 *
 * @param {string} message - The confirmation message, shown as plain text
 * @param {string} title - The dialog title (default: 'Confirm')
 * @param {Object} [options]
 * @param {string} [options.confirmLabel='Confirm']
 * @param {string} [options.cancelLabel='Cancel']
 * @param {'confirm'|'cancel'} [options.defaultAction='confirm'] - 'cancel' focuses
 *   the cancel button, so Return takes it
 * @returns {Promise<boolean>} - Promise that resolves to true if confirmed, false if cancelled
 */
export function customConfirm(message, title = 'Confirm', {
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  defaultAction = 'confirm'
} = {}) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.setAttribute('tabindex', '-1');
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">${escapeHtml(title)}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <p>${escapeHtml(message)}</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary cancel-btn" data-bs-dismiss="modal">${escapeHtml(cancelLabel)}</button>
            <button type="button" class="btn btn-primary confirm-btn">${escapeHtml(confirmLabel)}</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const confirmBtn = modal.querySelector('.confirm-btn');
    const closeBtn = modal.querySelector('.btn-close');
    const cancelBtn = modal.querySelector('.cancel-btn');

    let hasResolved = false;
    const answer = (value) => {
      if (hasResolved) return;
      hasResolved = true;
      // Use Bootstrap 5 API to hide and remove
      hideAndRemoveModal(modal);
      resolve(value);
    };

    confirmBtn.addEventListener('click', () => answer(true));
    closeBtn.addEventListener('click', () => answer(false));
    cancelBtn.addEventListener('click', () => answer(false));
    // Esc or a backdrop click
    modal.addEventListener('hidden.bs.modal', () => answer(false), { once: true });

    if (defaultAction === 'cancel') {
      modal.addEventListener('shown.bs.modal', () => cancelBtn.focus(), { once: true });
    }

    // Show modal via Bootstrap 5 API
    const instance = new bootstrap.Modal(modal, { backdrop: true, keyboard: true });
    instance.show();
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
    // Create modal structure safely without innerHTML
    const modalDialog = document.createElement('div');
    modalDialog.className = 'modal-dialog';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    
    const modalHeader = document.createElement('div');
    modalHeader.className = 'modal-header';
    
    const modalTitle = document.createElement('h5');
    modalTitle.className = 'modal-title';
    modalTitle.textContent = title;
    
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn-close';
    closeBtn.setAttribute('data-bs-dismiss', 'modal');
    closeBtn.setAttribute('aria-label', 'Close');
    
    modalHeader.appendChild(modalTitle);
    modalHeader.appendChild(closeBtn);
    
    const modalBody = document.createElement('div');
    modalBody.className = 'modal-body';
    
    const messageP = document.createElement('p');
    messageP.textContent = message;
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'form-control prompt-input';
    input.value = defaultValue;
    
    modalBody.appendChild(messageP);
    modalBody.appendChild(input);
    
    const modalFooter = document.createElement('div');
    modalFooter.className = 'modal-footer';
    
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.setAttribute('data-bs-dismiss', 'modal');
    cancelBtn.textContent = 'Cancel';
    
    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'btn btn-primary confirm-btn';
    confirmBtn.textContent = 'OK';
    
    modalFooter.appendChild(cancelBtn);
    modalFooter.appendChild(confirmBtn);
    
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(modalBody);
    modalContent.appendChild(modalFooter);
    modalDialog.appendChild(modalContent);
    modal.appendChild(modalDialog);

    document.body.appendChild(modal);

    // Use the already created element references instead of querying again
    let hasResolved = false;
    const cleanup = () => {
      // Hide and remove using Bootstrap 5 API
      hideAndRemoveModal(modal);
    };
    const safeResolve = (value) => {
      if (hasResolved) return;
      hasResolved = true;
      cleanup();
      resolve(value);
    };

    confirmBtn.addEventListener('click', () => {
      const value = input.value.trim();
      safeResolve(value || null);
    });

    // Support closing via the header X button as a cancel
    closeBtn.addEventListener('click', () => {
      safeResolve(null);
    });
    
    cancelBtn.addEventListener('click', () => {
      safeResolve(null);
    });

    // Keyboard handling inside the input
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        confirmBtn.click();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        cancelBtn.click();
      }
    });

    // If user closes via backdrop click or Esc (Bootstrap keyboard option),
    // ensure the promise resolves to null
    modal.addEventListener('hidden.bs.modal', () => {
      safeResolve(null);
    }, { once: true });

    // Focus input, select text, and show modal
    const instance = new bootstrap.Modal(modal, { backdrop: true, keyboard: true });
    instance.show();
    setTimeout(() => {
      input.focus();
      input.select(); // Select all text so user can type over it
    }, 500);
  });
}

/**
 * Custom alert dialog (single OK button)
 * 
 * @param {string} message - The alert message
 * @param {string} title - The dialog title (default: 'Alert')
 * @returns {Promise<void>} - Promise that resolves when the alert is dismissed
 */
export function customAlert(message, title = 'Alert') {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    
    const modalDialog = document.createElement('div');
    modalDialog.className = 'modal-dialog';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    
    const modalHeader = document.createElement('div');
    modalHeader.className = 'modal-header';
    
    const modalTitle = document.createElement('h5');
    modalTitle.className = 'modal-title';
    modalTitle.textContent = title;
    
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn-close';
    closeBtn.setAttribute('data-bs-dismiss', 'modal');
    closeBtn.setAttribute('aria-label', 'Close');
    
    modalHeader.appendChild(modalTitle);
    modalHeader.appendChild(closeBtn);
    
    const modalBody = document.createElement('div');
    modalBody.className = 'modal-body';
    
    const messageP = document.createElement('p');
    messageP.textContent = message;
    
    modalBody.appendChild(messageP);
    
    const modalFooter = document.createElement('div');
    modalFooter.className = 'modal-footer';
    
    const okBtn = document.createElement('button');
    okBtn.type = 'button';
    okBtn.className = 'btn btn-primary';
    okBtn.setAttribute('data-bs-dismiss', 'modal');
    okBtn.textContent = 'OK';
    
    modalFooter.appendChild(okBtn);
    
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(modalBody);
    modalContent.appendChild(modalFooter);
    modalDialog.appendChild(modalContent);
    modal.appendChild(modalDialog);

    document.body.appendChild(modal);

    let hasResolved = false;
    const cleanup = () => {
      hideAndRemoveModal(modal);
    };
    
    const safeResolve = () => {
      if (hasResolved) return;
      hasResolved = true;
      cleanup();
      resolve();
    };

    okBtn.addEventListener('click', safeResolve);
    closeBtn.addEventListener('click', safeResolve);
    
    // Handle backdrop click and Esc key
    modal.addEventListener('hidden.bs.modal', safeResolve, { once: true });

    const instance = new bootstrap.Modal(modal, { backdrop: true, keyboard: true });
    instance.show();
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
  customAlert,
  restoreFocusToSearch
}; 