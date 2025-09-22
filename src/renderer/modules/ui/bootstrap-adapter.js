// Bootstrap 5 Adapter for UI interactions
// Centralizes Bootstrap JS API usage so code can call simple helpers

let debugLog = null;
try {
  debugLog = window.debugLog || null;
} catch (_) {}

export function showModal(selector, options = { backdrop: true, keyboard: true }) {
  const element = document.querySelector(selector);
  if (!element) return;
  // Access bootstrap bundle from global; add defensive guard and extra logs
  const bs = (typeof window !== 'undefined' ? window.bootstrap : undefined) || (typeof bootstrap !== 'undefined' ? bootstrap : undefined);
  if (!bs || !bs.Modal) {
    debugLog?.warn('Bootstrap Modal not available on window.bootstrap');
    return;
  }
  const instance = bs.Modal.getOrCreateInstance(element, options);
  instance.show();
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
  
  // Method 1: Hide all tooltip instances
  document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((element) => {
    const tooltip = bs.Tooltip.getInstance(element);
    if (tooltip) {
      tooltip.hide();
    }
  });
  
  // Method 2: Remove any visible tooltip elements from DOM
  document.querySelectorAll('.tooltip').forEach((tooltipEl) => {
    tooltipEl.remove();
  });
  
  // Method 3: Clear any tooltip-related aria-describedby attributes
  document.querySelectorAll('[aria-describedby]').forEach((element) => {
    const describedBy = element.getAttribute('aria-describedby');
    if (describedBy && (describedBy.includes('tooltip') || document.getElementById(describedBy)?.classList.contains('tooltip'))) {
      element.removeAttribute('aria-describedby');
    }
  });
  
  // Method 4: Remove focus from any focused elements to prevent focus-triggered tooltips
  if (document.activeElement && document.activeElement.hasAttribute('data-bs-toggle')) {
    document.activeElement.blur();
  }
  
  debugLog?.debug('All tooltips forcefully hidden and cleaned up');
}

export function forceResetAllTooltips() {
  const bs = (typeof window !== 'undefined' ? window.bootstrap : undefined) || (typeof bootstrap !== 'undefined' ? bootstrap : undefined);
  if (!bs || !bs.Tooltip) {
    debugLog?.warn('Bootstrap Tooltip not available for reset');
    return;
  }
  
  debugLog?.info('Force resetting all tooltips due to persistent issues');
  
  // Step 1: Dispose all existing tooltips completely
  disposeAllTooltips();
  
  // Step 2: Aggressively clean up any remaining tooltip artifacts
  hideAllTooltips();
  
  // Step 3: Re-initialize all tooltips with fresh instances
  setTimeout(() => {
    initTooltip('[data-bs-toggle="tooltip"]');
    debugLog?.info('All tooltips have been force reset and re-initialized');
  }, 200);
}

export default {
  showModal,
  hideModal,
  hideAllModals,
  showTab,
  initTooltip,
  disposeAllTooltips,
  hideAllTooltips,
  forceResetAllTooltips,
};


