/**
 * Show color
 *
 * Marks <html> with the active show's accent color as `data-show-color`,
 * which src/stylesheets/show-colors.css keys every rule on. Without the
 * attribute (no color, or a key this build doesn't know) the window looks as
 * it does without the feature. The header refresh calls this, so it follows
 * startup, switch, color change, import and revert.
 */

// Same keys, in the same order, as SHOW_COLORS in src/main/modules/show-document.js
export const SHOW_COLORS = Object.freeze(['teal', 'blue', 'purple', 'pink', 'coral', 'amber', 'green']);

/**
 * @param {string|null} color - a palette key, or null for no color
 * @param {Document} [doc]
 */
export function applyShowColor(color, doc = document) {
  const root = doc?.documentElement;
  if (!root?.dataset) return;
  if (typeof color === 'string' && SHOW_COLORS.includes(color)) {
    root.dataset.showColor = color;
  } else {
    delete root.dataset.showColor;
  }
}

export default { SHOW_COLORS, applyShowColor };
