/**
 * Boards header
 *
 * The search-column header reads "<profile> · <board>". It is a label only.
 * Names are user text, so they are only ever set with textContent.
 */

const LOG_CONTEXT = { module: 'boards', function: 'refreshHeader' };

/**
 * Set the profile and board names in the header.
 * A missing `profile` leaves the profile as it is; a missing `board` hides the
 * separator, icon and board name.
 *
 * @param {{ profile?: string, board?: string|null }} labels
 * @param {Document} [doc]
 */
export function setHeaderLabels({ profile, board } = {}, doc = document) {
  if (typeof profile === 'string') {
    const profileEl = doc.getElementById('profile-name');
    if (profileEl) profileEl.textContent = profile;
  }

  const boardEl = doc.getElementById('board-name');
  const parts = [doc.querySelector('.board-separator'), doc.getElementById('board-icon'), boardEl];
  const hasBoard = Boolean(board);
  for (const part of parts) {
    if (part) part.hidden = !hasBoard;
  }
  if (boardEl) {
    boardEl.textContent = hasBoard ? board : '';
    if (hasBoard) boardEl.title = board;
    else boardEl.removeAttribute('title');
  }
}

/**
 * Show the session's active board in the header. Never throws.
 *
 * @param {Object} [options]
 * @param {{ getState: Function }} [options.api] - secureElectronAPI.boards
 * @param {Document} [options.doc]
 */
export async function refreshHeader({ api = window.secureElectronAPI?.boards, doc } = {}) {
  try {
    const result = await api.getState();
    if (!result?.success) throw new Error(result?.error || 'Reading the board session failed');
    const { profile, doc: boardDoc } = result.data ?? {};
    const active = boardDoc?.boards?.find((b) => b.id === boardDoc.activeBoardId);
    setHeaderLabels({ profile, board: active?.name ?? null }, doc);
  } catch (error) {
    window.debugLog?.warn('Could not refresh the board header', { ...LOG_CONTEXT, error: error.message });
  }
}

export default { setHeaderLabels, refreshHeader };
