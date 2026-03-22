/**
 * Safe Bootstrap UI helpers
 *
 * Wraps dynamic imports of bootstrap-adapter.js with error logging.
 * Use these instead of manually writing try/catch import blocks.
 */

let debugLog = null;
try { debugLog = window.debugLog || null; } catch (_) {}

/**
 * Safely show a Bootstrap modal.
 * @param {string} selector - CSS selector for the modal element
 * @param {Object} [context] - Logging context (module, function)
 */
export function safeShowModal(selector, context = {}) {
  return import('./bootstrap-adapter.js')
    .then(({ showModal }) => showModal(selector))
    .catch(err => {
      debugLog?.warn(`Failed to show modal ${selector}`, { ...context, error: err?.message });
    });
}

/**
 * Safely hide a Bootstrap modal.
 * @param {string} selector - CSS selector for the modal element
 * @param {Object} [context] - Logging context (module, function)
 */
export function safeHideModal(selector, context = {}) {
  return import('./bootstrap-adapter.js')
    .then(({ hideModal }) => hideModal(selector))
    .catch(err => {
      debugLog?.warn(`Failed to hide modal ${selector}`, { ...context, error: err?.message });
    });
}

/**
 * Safely show a Bootstrap tab.
 * @param {string} selector - CSS selector for the tab element
 * @param {Object} [context] - Logging context (module, function)
 */
export function safeShowTab(selector, context = {}) {
  return import('./bootstrap-adapter.js')
    .then(({ showTab }) => showTab(selector))
    .catch(err => {
      debugLog?.warn(`Failed to show tab ${selector}`, { ...context, error: err?.message });
    });
}
