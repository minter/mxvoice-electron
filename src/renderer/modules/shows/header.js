/**
 * Shows header
 *
 * The search-column header reads "<profile> · <show>". It is a label only.
 * Names are user text, so they are only ever set with textContent.
 */

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
  if (showEl) {
    showEl.textContent = hasShow ? show : '';
    if (hasShow) showEl.title = show;
    else showEl.removeAttribute('title');
  }
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
    const { profile, doc: showDoc } = result.data ?? {};
    const active = showDoc?.shows?.find((b) => b.id === showDoc.activeShowId);
    setHeaderLabels({ profile, show: active?.name ?? null }, doc);
  } catch (error) {
    window.debugLog?.warn('Could not refresh the show header', { ...LOG_CONTEXT, error: error.message });
  }
}

export default { setHeaderLabels, refreshHeader };
