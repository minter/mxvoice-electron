/**
 * Overlay shortcut guard
 *
 * Mousetrap's stopCallback only skips text fields. While a dialog, the tab
 * actions menu or a What's New tour is open, Return, Space and Esc belong to
 * it: Return takes the focused button, and Esc closes the dialog without
 * stopping playback. Hotkeys F1-F12 keep working under them on purpose.
 *
 * The song context menu is left out: it never takes the focus, so Esc there
 * must still stop playback (and it closes the menu too).
 */

const FUNCTION_KEY_COMBO = /(^|\+)f([1-9]|1[0-2])$/;
const OPEN_DIALOG = '.modal.show, .modal[aria-modal="true"]';
// Shown with style.display 'block', hidden with 'none'
const MENU_IDS = ['mxv-tab-actions-menu'];
// driver.js sets this on <body> while a tour runs
const TOUR_ACTIVE_CLASS = 'driver-active';

/** @param {string} combo - a Mousetrap combo such as 'f1' or 'shift+esc' */
export function isFunctionKeyCombo(combo) {
  return typeof combo === 'string' && FUNCTION_KEY_COMBO.test(combo);
}

/**
 * Whether a dialog (showing or still closing), the tab actions menu or a
 * tour is open.
 * @param {Document} doc
 */
export function isOverlayOpen(doc) {
  if (!doc) return false;
  if (doc.querySelector(OPEN_DIALOG)) return true;
  if (doc.body?.classList?.contains(TOUR_ACTIVE_CLASS)) return true;
  return MENU_IDS.some((id) => {
    const display = doc.getElementById(id)?.style?.display;
    return Boolean(display) && display !== 'none';
  });
}

/**
 * @param {Object} options
 * @param {string} options.combo
 * @param {Document} options.doc
 * @param {() => boolean} options.baseStop - Mousetrap's own rule
 * @returns {boolean} true to skip the shortcut
 */
export function shouldStopShortcut({ combo, doc, baseStop }) {
  if (!isFunctionKeyCombo(combo) && isOverlayOpen(doc)) return true;
  return baseStop();
}

/**
 * Wrap Mousetrap.prototype.stopCallback once. The global Mousetrap and
 * Mousetrap(element) instances look it up on the prototype at call time.
 * @param {Function} [MousetrapCtor] - window.Mousetrap
 * @param {() => Document} [getDoc]
 * @returns {boolean} whether the guard is in place
 */
export function installOverlayShortcutGuard(MousetrapCtor = globalThis.Mousetrap, getDoc = () => globalThis.document) {
  const proto = MousetrapCtor?.prototype;
  if (!proto || typeof proto.stopCallback !== 'function') return false;
  if (proto.stopCallback.overlayGuard) return true;

  const base = proto.stopCallback;
  const guarded = function stopCallback(e, element, combo, sequence) {
    return shouldStopShortcut({ combo, doc: getDoc(), baseStop: () => base.call(this, e, element, combo, sequence) });
  };
  guarded.overlayGuard = true;
  proto.stopCallback = guarded;
  return true;
}
