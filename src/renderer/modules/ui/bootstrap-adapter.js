// Bootstrap 5 Adapter for UI interactions
// Centralizes Bootstrap JS API usage so code can call simple helpers

let debugLog = null;
// Intentional: debugLog may not exist yet during early module loading
try {
  debugLog = window.debugLog || null;
} catch (_) { /* debugLog may not exist during early module loading */ }

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
    // Use 'hover' only (not 'hover focus') to prevent sticky tooltips on Windows
    // where focus events can keep tooltips visible after the mouse leaves
    const tooltip = new bs.Tooltip(element, {
      delay: { show: delayMs, hide: 0 },
      trigger: 'hover',
      boundary: 'viewport',
      fallbackPlacements: ['top', 'bottom', 'left', 'right']
    });

    // Safety net: force-hide tooltip on mouseleave to prevent sticky tooltips on Windows
    element.addEventListener('mouseleave', () => {
      tooltip.hide();
    });
    
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


