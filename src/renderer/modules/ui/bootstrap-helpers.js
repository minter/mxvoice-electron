/**
 * Safe Bootstrap UI helpers
 *
 * Wraps dynamic imports of bootstrap-adapter.js with error logging.
 * Use these instead of manually writing try/catch import blocks.
 */

// Intentional: debugLog may not exist yet during early module loading
let debugLog = null;
try { debugLog = window.debugLog || null; } catch (_) { /* debugLog may not exist during early module loading */ }

/**
 * Safely show a Bootstrap modal.
 * @param {string} selector - CSS selector for the modal element
 * @param {Object} [context] - Logging context (module, function)
 * @param {Object} [options] - Bootstrap Modal options (e.g. { keyboard: false })
 */
export function safeShowModal(selector, context = {}, options) {
  return import('./bootstrap-adapter.js')
    .then(({ showModal }) => (options ? showModal(selector, options) : showModal(selector)))
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

/**
 * The Bootstrap dialog showing now, other than `exceptId`, or null.
 * Bootstrap dialogs don't stack: one opened over another stays invisible
 * while still capturing Enter and Esc for the whole page.
 * @param {string} [exceptId] - id of a dialog to ignore (the caller's own)
 * @returns {Element|null}
 */
export function findOpenModal(exceptId) {
  return [...document.querySelectorAll('.modal.show')].find((el) => el.id !== exceptId) ?? null;
}

/**
 * Whether a Bootstrap dialog other than `exceptId` is showing.
 * @param {string} [exceptId]
 * @returns {boolean}
 */
export function isAnyModalOpen(exceptId) {
  return findOpenModal(exceptId) !== null;
}
