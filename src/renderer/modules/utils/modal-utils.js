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
      // Hide the modal properly using Bootstrap
      $(modal).modal('hide');
      
      // Remove the modal backdrop
      const backdrop = document.querySelector('.modal-backdrop');
      if (backdrop) {
        backdrop.remove();
      }
      
      // Remove modal-open class from body
      document.body.classList.remove('modal-open');
      
      // Remove the modal element
      setTimeout(() => {
        if (document.body.contains(modal)) {
          document.body.removeChild(modal);
        }
      }, 150); // Small delay to ensure Bootstrap animations complete
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
    closeBtn.className = 'close';
    closeBtn.setAttribute('data-dismiss', 'modal');
    
    const closeSpan = document.createElement('span');
    closeSpan.textContent = '×';
    closeBtn.appendChild(closeSpan);
    
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
    cancelBtn.setAttribute('data-dismiss', 'modal');
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
    const cleanup = () => {
      // Hide the modal properly using Bootstrap
      $(modal).modal('hide');
      
      // Remove the modal backdrop
      const backdrop = document.querySelector('.modal-backdrop');
      if (backdrop) {
        backdrop.remove();
      }
      
      // Remove modal-open class from body
      document.body.classList.remove('modal-open');
      
      // Remove the modal element
      setTimeout(() => {
        if (document.body.contains(modal)) {
          document.body.removeChild(modal);
        }
      }, 150); // Small delay to ensure Bootstrap animations complete
    };

    confirmBtn.addEventListener('click', () => {
      const value = input.value.trim();
      cleanup();
      resolve(value || null);
    });

    // Note: closeBtn is not created in this function, so we'll handle it differently
    // The modal will be closed via Bootstrap's data-dismiss attribute
    
    cancelBtn.addEventListener('click', () => {
      cleanup();
      resolve(null);
    });

    // Focus input, select text, and show modal
    $(modal).modal('show');
    setTimeout(() => {
      input.focus();
      input.select(); // Select all text so user can type over it
    }, 500);
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