/**
 * The row a song action (Play, Edit, Delete, Mark as Unplayed) acts on.
 *
 * Search and holding-tank rows are selected by giving them the id
 * `selected_row`. Hotkey slots can't be renamed that way: the F-keys and a
 * show switch find a slot by its `fK_hotkey` id. So while the song context
 * menu is open on a hotkey slot, the slot is marked with
 * `data-context-target="true"` instead, and that mark wins.
 */

const ATTR = 'data-context-target';

/**
 * Window event that closes the song context menu through its own dismiss
 * path. Sent by a show switch, which makes no click to close the menu.
 */
export const CONTEXT_MENU_DISMISS_EVENT = 'mxv-context-menu-dismiss';

/** Mark `element` as the context menu's target, replacing any earlier mark. */
export function markContextTarget(element) {
  clearContextTarget();
  element?.setAttribute(ATTR, 'true');
}

/** Remove the context-menu mark, wherever it is. */
export function clearContextTarget() {
  document.querySelectorAll(`[${ATTR}]`).forEach((el) => el.removeAttribute(ATTR));
}

/** The context menu's hotkey target if there is one, else `#selected_row`. */
export function getSongActionTarget() {
  return (
    document.querySelector(`[${ATTR}="true"]`) ||
    document.getElementById('selected_row')
  );
}
