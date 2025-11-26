// Bootstrap 5 Adapter for UI interactions
// Centralizes Bootstrap JS API usage so code can call simple helpers

let debugLog = null;
try {
  debugLog = window.debugLog || null;
} catch {
  // Debug logger not available in this context
}

export function showModal(selector, options = { backdrop: true, keyboard: true }) {
  const element = document.querySelector(selector);
  if (!element) {
    debugLog?.warn('Modal element not found', { selector });
    return;
  }
  // Access bootstrap bundle from global; add defensive guard and extra logs
  const bs = (typeof window !== 'undefined' ? window.bootstrap : undefined) || (typeof bootstrap !== 'undefined' ? bootstrap : undefined);
  if (!bs || !bs.Modal) {
    debugLog?.warn('Bootstrap Modal not available on window.bootstrap');
    // Fallback: manually add show class and make visible if Bootstrap isn't ready
    element.classList.add('show');
    element.style.display = 'block';
    element.setAttribute('aria-hidden', 'false');
    element.setAttribute('aria-modal', 'true');
    // Add backdrop if needed
    if (options.backdrop !== false) {
      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop fade show';
      backdrop.id = `${selector.replace('#', '')}-backdrop`;
      document.body.appendChild(backdrop);
      document.body.classList.add('modal-open');
    }
    return;
  }
  try {
    const instance = bs.Modal.getOrCreateInstance(element, options);
    instance.show();
  } catch (error) {
    debugLog?.error('Failed to show modal', { selector, error: error.message });
    // Fallback: manually show the modal
    element.classList.add('show');
    element.style.display = 'block';
    element.setAttribute('aria-hidden', 'false');
    element.setAttribute('aria-modal', 'true');
    if (options.backdrop !== false) {
      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop fade show';
      backdrop.id = `${selector.replace('#', '')}-backdrop`;
      document.body.appendChild(backdrop);
      document.body.classList.add('modal-open');
    }
  }
}

export function hideModal(selector) {
  const element = document.querySelector(selector);
  if (!element) return;
  const bs = (typeof window !== 'undefined' ? window.bootstrap : undefined) || (typeof bootstrap !== 'undefined' ? bootstrap : undefined);
  if (!bs || !bs.Modal) {
    debugLog?.warn('Bootstrap Modal not available on window.bootstrap');
    return;
  }
  const instance = bs.Modal.getOrCreateInstance(element);
  instance.hide();
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


