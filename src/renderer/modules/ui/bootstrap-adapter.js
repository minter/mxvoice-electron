// Bootstrap 5 Adapter for UI interactions
// Centralizes Bootstrap JS API usage so code can call simple helpers

export function showModal(selector, options = { backdrop: true, keyboard: true }) {
  const element = document.querySelector(selector);
  if (!element) return;
  // Access bootstrap bundle from global; add defensive guard and extra logs
  const bs = (typeof window !== 'undefined' ? window.bootstrap : undefined) || (typeof bootstrap !== 'undefined' ? bootstrap : undefined);
  if (!bs || !bs.Modal) {
    try { 
      window.logWarn && window.logWarn('Bootstrap Modal not available on window.bootstrap'); 
    } catch (error) {
      // Fallback logging when logWarn is not available
      console.warn('Bootstrap Modal not available on window.bootstrap');
    }
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
    try { 
      window.logWarn && window.logWarn('Bootstrap Modal not available on window.bootstrap'); 
    } catch (error) {
      // Fallback logging when logWarn is not available
      console.warn('Bootstrap Modal not available on window.bootstrap');
    }
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
    try { 
      window.logWarn && window.logWarn('Bootstrap Tab not available on window.bootstrap'); 
    } catch (error) {
      // Fallback logging when logWarn is not available
      console.warn('Bootstrap Tab not available on window.bootstrap');
    }
    return;
  }
  bs.Tab.getOrCreateInstance(element).show();
}

export function initTooltip(selector = '[data-bs-toggle="tooltip"]') {
  const bs = (typeof window !== 'undefined' ? window.bootstrap : undefined) || (typeof bootstrap !== 'undefined' ? bootstrap : undefined);
  if (!bs || !bs.Tooltip) {
    try { 
      window.logWarn && window.logWarn('Bootstrap Tooltip not available on window.bootstrap'); 
    } catch (error) {
      // Fallback logging when logWarn is not available
      console.warn('Bootstrap Tooltip not available on window.bootstrap');
    }
    return;
  }
  
  // Get tooltip delay from CSS custom property, default to 1000ms if not set
  const tooltipDelay = getComputedStyle(document.documentElement)
    .getPropertyValue('--tooltip-delay')
    .trim() || '1000ms';
  
  // Convert CSS time value to milliseconds for Bootstrap
  const delayMs = parseInt(tooltipDelay) || 1000;
  
  document.querySelectorAll(selector).forEach((element) => { 
    new bs.Tooltip(element, {
      delay: { show: delayMs, hide: 0 }
    });
  });
}

export default {
  showModal,
  hideModal,
  hideAllModals,
  showTab,
  initTooltip,
};


