// Bootstrap 5 Adapter for UI interactions
// Centralizes Bootstrap JS API usage so code can call simple helpers

let debugLog = null;
try {
  debugLog = window.debugLog || null;
} catch {
  // Debug logger not available in this context
}

// Initialize modal close button handlers as a fallback
// This ensures modals can close even if Bootstrap's data-bs-dismiss doesn't work
let modalCloseHandlersInitialized = false;
function ensureModalCloseHandlers() {
  if (modalCloseHandlersInitialized) return;
  modalCloseHandlersInitialized = true;
  
  // Use event delegation to handle all data-bs-dismiss="modal" clicks
  // Ensure modals close reliably even if Bootstrap's dismiss doesn't work
  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-bs-dismiss="modal"]');
    if (!target) return;
    
    // Find the modal this button belongs to
    const modal = target.closest('.modal');
    if (!modal || !modal.classList.contains('show')) return;
    
    // Immediately hide the modal
    const modalId = modal.id;
    if (modalId) {
      hideModal(`#${modalId}`);
    } else {
      // Direct hide without selector
      const bs = (typeof window !== 'undefined' ? window.bootstrap : undefined) || 
                 (typeof bootstrap !== 'undefined' ? bootstrap : undefined);
      if (bs && bs.Modal) {
        try {
          const instance = bs.Modal.getInstance(modal);
          if (instance) {
            instance.hide();
          }
        } catch {
          // Fallback to manual hide
        }
      }
      // Always ensure it's hidden manually as well
      modal.classList.remove('show');
      modal.setAttribute('aria-hidden', 'true');
      const backdrop = document.querySelector('.modal-backdrop');
      if (backdrop) {
        backdrop.classList.remove('show');
        setTimeout(() => backdrop.remove(), 150);
      }
      document.body.classList.remove('modal-open');
      setTimeout(() => {
        modal.style.display = 'none';
      }, 150);
    }
  }, true); // Use capture phase to handle before Bootstrap
}

export function showModal(selector, options = { backdrop: true, keyboard: true }) {
  const element = document.querySelector(selector);
  if (!element) {
    debugLog?.warn('Modal element not found', { selector });
    return;
  }
  
  // Ensure close button handlers are set up
  ensureModalCloseHandlers();
  
  // Helper to manually show modal (fallback)
  const manuallyShowModal = () => {
    element.classList.add('show');
    element.style.display = 'block';
    element.setAttribute('aria-hidden', 'false');
    element.setAttribute('aria-modal', 'true');
    // Remove fade class temporarily to prevent transition delays
    element.classList.remove('fade');
    // Re-add fade after a microtask to allow display to settle
    setTimeout(() => {
      element.classList.add('fade');
      element.classList.add('show');
    }, 10);
    
    // Add backdrop if needed
    if (options.backdrop !== false) {
      // Remove existing backdrop if present
      const existingBackdrop = document.querySelector('.modal-backdrop');
      if (existingBackdrop) {
        existingBackdrop.remove();
      }
      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop fade show';
      backdrop.id = `${selector.replace('#', '')}-backdrop`;
      document.body.appendChild(backdrop);
      document.body.classList.add('modal-open');
    }
  };
  
  // Access bootstrap bundle from global; add defensive guard and extra logs
  const bs = (typeof window !== 'undefined' ? window.bootstrap : undefined) || (typeof bootstrap !== 'undefined' ? bootstrap : undefined);
  if (!bs || !bs.Modal) {
    debugLog?.warn('Bootstrap Modal not available on window.bootstrap');
    manuallyShowModal();
    return;
  }
  
  try {
    const instance = bs.Modal.getOrCreateInstance(element, options);
    
    // Set up close button handlers for this specific modal
    const closeButtons = element.querySelectorAll('[data-bs-dismiss="modal"]');
    const closeHandler = () => {
      hideModal(selector);
    };
    closeButtons.forEach(btn => {
      btn.addEventListener('click', closeHandler);
    });
    
    // Call Bootstrap's show first to let it initialize properly
    instance.show();
    
    // On Mac CI, Bootstrap sometimes delays adding the show class due to CSS transitions
    // Wait one frame to see if Bootstrap adds it, then add it if still missing
    // This ensures it appears without interfering with Bootstrap's hide mechanism
    requestAnimationFrame(() => {
      // Only add if Bootstrap hasn't added it yet and modal isn't being hidden
      if (!element.classList.contains('show') && element.getAttribute('aria-hidden') !== 'true') {
        element.classList.add('show');
        element.setAttribute('aria-hidden', 'false');
        element.setAttribute('aria-modal', 'true');
      }
    });
    
  } catch (error) {
    debugLog?.error('Failed to show modal', { selector, error: error.message });
    manuallyShowModal();
  }
}

export function hideModal(selector) {
  const element = document.querySelector(selector);
  if (!element) return;
  
  // Helper to manually hide modal (fallback)
  const manuallyHideModal = () => {
    element.classList.remove('show');
    element.setAttribute('aria-hidden', 'true');
    element.removeAttribute('aria-modal');
    // Hide after a brief delay to allow fade transition
    setTimeout(() => {
      element.style.display = 'none';
    }, 150);
    
    // Remove backdrop
    const backdrop = document.querySelector('.modal-backdrop');
    if (backdrop) {
      backdrop.classList.remove('show');
      setTimeout(() => {
        if (backdrop.parentNode) {
          backdrop.parentNode.removeChild(backdrop);
        }
      }, 150);
    }
    document.body.classList.remove('modal-open');
  };
  
  const bs = (typeof window !== 'undefined' ? window.bootstrap : undefined) || (typeof bootstrap !== 'undefined' ? bootstrap : undefined);
  if (!bs || !bs.Modal) {
    debugLog?.warn('Bootstrap Modal not available on window.bootstrap');
    manuallyHideModal();
    return;
  }
  
  try {
    const instance = bs.Modal.getOrCreateInstance(element);
    
    // Call Bootstrap's hide
    instance.hide();
    
    // Immediately remove show class to ensure modal hides
    // Bootstrap's hide() uses CSS transitions which can be delayed
    element.classList.remove('show');
    element.setAttribute('aria-hidden', 'true');
    
    // Ensure it stays hidden after transitions complete
    setTimeout(() => {
      if (element.classList.contains('show')) {
        debugLog?.warn('Show class was re-added after Bootstrap hide(), removing manually', { selector });
        manuallyHideModal();
      }
    }, 300);
    
  } catch (error) {
    debugLog?.error('Failed to hide modal', { selector, error: error.message });
    manuallyHideModal();
  }
}

export function hideAllModals() {
  document.querySelectorAll('.modal.show').forEach((element) => {
    const bs = (typeof window !== 'undefined' ? window.bootstrap : undefined) || (typeof bootstrap !== 'undefined' ? bootstrap : undefined);
    if (!bs || !bs.Modal) return;
    bs.Modal.getOrCreateInstance(element).hide();
  });
}

export function showTab(selector) {
  const element = document.querySelector(selector);
  if (!element) return;
  const bs = (typeof window !== 'undefined' ? window.bootstrap : undefined) || (typeof bootstrap !== 'undefined' ? bootstrap : undefined);
  if (!bs || !bs.Tab) {
    debugLog?.warn('Bootstrap Tab not available on window.bootstrap');
    return;
  }
  bs.Tab.getOrCreateInstance(element).show();
}

export function initTooltip(selector = '[data-bs-toggle="tooltip"]') {
  const bs = (typeof window !== 'undefined' ? window.bootstrap : undefined) || (typeof bootstrap !== 'undefined' ? bootstrap : undefined);
  if (!bs || !bs.Tooltip) {
    debugLog?.warn('Bootstrap Tooltip not available on window.bootstrap');
    return;
  }
  
  // Get tooltip delay from CSS custom property, default to 1000ms if not set
  const tooltipDelay = getComputedStyle(document.documentElement)
    .getPropertyValue('--tooltip-delay')
    .trim() || '1000ms';
  
  // Convert CSS time value to milliseconds for Bootstrap
  const delayMs = parseInt(tooltipDelay) || 1000;
  
  document.querySelectorAll(selector).forEach((element) => { 
    // Dispose of any existing tooltip instance to prevent duplicates
    const existingTooltip = bs.Tooltip.getInstance(element);
    if (existingTooltip) {
      existingTooltip.dispose();
    }
    
    // Create new tooltip instance with proper configuration
    const tooltip = new bs.Tooltip(element, {
      delay: { show: delayMs, hide: 0 },
      trigger: 'hover focus',
      boundary: 'viewport',
      fallbackPlacements: ['top', 'bottom', 'left', 'right']
    });
    
    // Add special handling for file operation buttons to prevent tooltip after dialog
    if (element.id === 'hotkey-load-btn' || element.id === 'holding-tank-load-btn' || 
        element.id === 'hotkey-save-btn' || element.id === 'holding-tank-save-btn') {
      
      // Track when this button was clicked to prevent immediate tooltip on focus
      element.addEventListener('click', () => {
        element.dataset.tooltipSuppressUntil = Date.now() + 2000; // Suppress for 2 seconds
      });
      
      // Override the show method to check suppression more robustly
      const originalShow = tooltip.show;
      tooltip.show = function() {
        const suppressUntil = parseInt(element.dataset.tooltipSuppressUntil || '0');
        const now = Date.now();
        if (now < suppressUntil) {
          debugLog?.debug(`Tooltip suppressed for ${element.id} until ${new Date(suppressUntil).toLocaleTimeString()}`);
          return; // Suppress tooltip
        }
        // Clear the suppression timestamp if it's expired
        if (suppressUntil > 0 && now >= suppressUntil) {
          element.dataset.tooltipSuppressUntil = '0';
        }
        return originalShow.call(this);
      };
      
      // Also override the _getConfig method to prevent tooltip from being created
      // if suppression is active
      const originalGetConfig = tooltip._getConfig;
      if (originalGetConfig) {
        tooltip._getConfig = function(config) {
          const suppressUntil = parseInt(element.dataset.tooltipSuppressUntil || '0');
          if (Date.now() < suppressUntil) {
            return { ...config, trigger: 'manual' }; // Disable automatic triggers
          }
          return originalGetConfig.call(this, config);
        };
      }
    }
  });
}

export function disposeAllTooltips() {
  const bs = (typeof window !== 'undefined' ? window.bootstrap : undefined) || (typeof bootstrap !== 'undefined' ? bootstrap : undefined);
  if (!bs || !bs.Tooltip) {
    debugLog?.warn('Bootstrap Tooltip not available on window.bootstrap');
    return;
  }
  
  // Dispose of all existing tooltip instances
  document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((element) => {
    const tooltip = bs.Tooltip.getInstance(element);
    if (tooltip) {
      tooltip.dispose();
    }
  });
}

export function hideAllTooltips() {
  const bs = (typeof window !== 'undefined' ? window.bootstrap : undefined) || (typeof bootstrap !== 'undefined' ? bootstrap : undefined);
  if (!bs || !bs.Tooltip) {
    debugLog?.warn('Bootstrap Tooltip not available on window.bootstrap');
    return;
  }
  
  // Hide all visible tooltips
  document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((element) => {
    const tooltip = bs.Tooltip.getInstance(element);
    if (tooltip) {
      tooltip.hide();
    }
  });
}

export default {
  showModal,
  hideModal,
  hideAllModals,
  showTab,
  initTooltip,
  disposeAllTooltips,
  hideAllTooltips,
};


