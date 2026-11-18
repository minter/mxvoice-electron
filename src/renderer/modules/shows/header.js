/**
 * Shows header
 *
 * The search-column header reads "<profile> · <show>", with a "•" after the
 * show while the layout on screen differs from the saved show. It is a label
 * only. Names are user text, so they are only ever set with textContent.
 *
 * The dot follows the session's `dirty` flag: from `state()` on each refresh,
 * and from the `show-dirty-changed` event after each recovery save.
 */

import { applyShowColor } from './show-color.js';

const LOG_CONTEXT = { module: 'shows', function: 'refreshHeader' };

/**
 * Set the profile and show names in the header.
 * A missing `profile` leaves the profile as it is; a missing `show` hides the
 * separator, icon and show name.
 *
 * @param {{ profile?: string, show?: string|null }} labels
 * @param {Document} [doc]
 */
export function setHeaderLabels({ profile, show } = {}, doc = document) {
  if (typeof profile === 'string') {
    const profileEl = doc.getElementById('profile-name');
    if (profileEl) profileEl.textContent = profile;
  }

  const showEl = doc.getElementById('show-name');
  const parts = [doc.querySelector('.show-separator'), doc.getElementById('show-icon'), showEl];
  const hasShow = Boolean(show);
  for (const part of parts) {
    if (part) part.hidden = !hasShow;
  }
  if (!hasShow) setDirty(false, doc);
  if (showEl) {
    showEl.textContent = hasShow ? show : '';
    if (hasShow) showEl.title = show;
    else showEl.removeAttribute('title');
  }
}

/**
 * Show or hide the unsaved-changes dot. It never shows without a show name.
 *
 * @param {boolean} dirty
 * @param {Document} [doc]
 */
export function setDirty(dirty, doc = document) {
  const dot = doc.getElementById('show-dirty');
  if (!dot) return;
  const showEl = doc.getElementById('show-name');
  dot.hidden = !(dirty === true && showEl && !showEl.hidden);
}

/**
 * Show the session's active show in the header. Never throws.
 *
 * @param {Object} [options]
 * @param {{ getState: Function }} [options.api] - secureElectronAPI.shows
 * @param {Document} [options.doc]
 */
export async function refreshHeader({ api = window.secureElectronAPI?.shows, doc } = {}) {
  try {
    const result = await api.getState();
    if (!result?.success) throw new Error(result?.error || 'Reading the show session failed');
    const { profile, status, doc: showDoc, dirty } = result.data ?? {};
    const active = showDoc?.shows?.find((b) => b.id === showDoc.activeShowId);
    setHeaderLabels({ profile, show: active?.name ?? null }, doc);
    applyShowColor(active?.color ?? null, doc);
    // The session already reads clean outside 'ready'; checked here too
    setDirty(status === 'ready' && dirty === true, doc);
  } catch (error) {
    window.debugLog?.warn('Could not refresh the show header', { ...LOG_CONTEXT, error: error.message });
  }
}

let listenersInstalled = false;

/**
 * Follow the `show-dirty-changed` event profile-state sends after each
 * recovery save, so profile-state never imports the header. Safe to call
 * more than once.
 *
 * @param {Object} [options]
 * @param {Window} [options.target]
 * @param {Document} [options.doc]
 */
export function installHeaderListeners({ target = window, doc } = {}) {
  if (listenersInstalled || typeof target?.addEventListener !== 'function') return;
  listenersInstalled = true;
  target.addEventListener('show-dirty-changed', (event) => {
    setDirty(event?.detail?.dirty === true, doc ?? document);
  });
}

export default { setHeaderLabels, setDirty, refreshHeader, installHeaderListeners };
