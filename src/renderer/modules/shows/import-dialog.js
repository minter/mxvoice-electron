/**
 * Import Show dialog (#importShowModal)
 *
 * Lists other profiles' saved shows, grouped by profile, and resolves with
 * the one chosen. Profile and show names are set as text only.
 */

import { safeShowModal, safeHideModal } from '../ui/bootstrap-helpers.js';

const MODAL = '#importShowModal';
const LOG_CONTEXT = { module: 'shows', function: 'chooseImportShow' };
const EMPTY_MESSAGE = 'No other profiles have saved shows.';

function buildList(doc, list, groups, select, choose) {
  const rows = [];
  for (const group of groups) {
    if (!group?.shows?.length) continue;
    const header = doc.createElement('div');
    header.className = 'list-group-item list-group-item-secondary small fw-semibold';
    header.setAttribute('role', 'presentation');
    header.textContent = group.profile;
    rows.push(header);
    for (const show of group.shows) {
      const row = doc.createElement('button');
      row.type = 'button';
      row.className = 'list-group-item list-group-item-action';
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', 'false');
      row.textContent = show.name;
      const choice = { profile: group.profile, showId: show.id };
      row.addEventListener('click', () => select(row, choice));
      row.addEventListener('dblclick', () => { select(row, choice); choose(); });
      rows.push(row);
    }
  }
  list.replaceChildren(...rows);
  return rows.filter((row) => row.getAttribute('role') === 'option').length;
}

/**
 * Show the dialog and wait for a choice.
 *
 * @param {Array<{ profile: string, shows: Array<{ id: string, name: string }> }>} groups
 *   from shows.listImportable()
 * @param {Object} [options] - test doubles for document, show and hide
 * @returns {Promise<{ profile: string, showId: string }|null>} null when closed
 */
export function chooseImportShow(groups, {
  document: doc = globalThis.document,
  show = safeShowModal,
  hide = safeHideModal
} = {}) {
  const modal = doc.getElementById('importShowModal');
  const list = doc.getElementById('importShowList');
  const empty = doc.getElementById('importShowEmpty');
  const importButton = doc.getElementById('importShowBtn');
  if (!modal || !list || !empty || !importButton) {
    window.debugLog?.error('Import Show dialog markup is missing', LOG_CONTEXT);
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    // Listeners on the dialog's fixed elements last for this open only
    const listeners = new AbortController();
    let selectedRow = null;
    let selected = null;
    let settled = false;

    const finish = (value) => {
      if (settled) return;
      settled = true;
      listeners.abort();
      resolve(value);
    };
    const choose = () => {
      if (!selected) return;
      const choice = selected;
      finish(choice);
      void hide(MODAL, LOG_CONTEXT);
    };
    const select = (row, choice) => {
      selectedRow?.classList.remove('active');
      selectedRow?.setAttribute('aria-selected', 'false');
      selectedRow = row;
      selected = choice;
      row.classList.add('active');
      row.setAttribute('aria-selected', 'true');
      importButton.disabled = false;
    };

    const count = buildList(doc, list, Array.isArray(groups) ? groups : [], select, choose);
    empty.textContent = EMPTY_MESSAGE;
    empty.classList.toggle('d-none', count > 0);
    importButton.disabled = true;

    importButton.addEventListener('click', choose, { signal: listeners.signal });
    // Esc, the backdrop, Cancel and the close button
    modal.addEventListener('hidden.bs.modal', () => finish(null), { signal: listeners.signal });

    void show(MODAL, LOG_CONTEXT, { backdrop: true, keyboard: true });
  });
}

export default { chooseImportShow };
