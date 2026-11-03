/**
 * Tab label
 *
 * Every place that writes a hotkey or holding tank tab's text goes through
 * here, so the full name is also the link's tooltip: long names are cut off
 * with an ellipsis in the (single-line) tab row.
 */

/**
 * Show a tab's name on its .nav-link. An unnamed tab shows its number and has
 * no tooltip.
 * @param {Element|null} link - the tab's .nav-link
 * @param {string|null|undefined} name - the user's name for the tab, if any
 * @param {number|string} [tabNumber] - shown when the tab has no name
 */
export function setTabLabel(link, name, tabNumber) {
  if (!link) return;
  const named = name !== null && name !== undefined && String(name) !== '';
  link.textContent = named ? String(name) : String(tabNumber ?? '');
  if (named) link.setAttribute('title', String(name));
  else link.removeAttribute('title');
}

export default { setTabLabel };
