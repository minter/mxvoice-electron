/**
 * Import Show dialog (#importShowModal)
 *
 * Lists other profiles' saved shows, grouped under each profile's name, and
 * resolves with the one chosen. A profile is a heading, not a choice; each
 * show row carries its color and what it holds, so two shows with the same
 * name can be told apart. Profile and show names are set as text only.
 */

import { safeShowModal, safeHideModal } from '../ui/bootstrap-helpers.js';
import { SHOW_COLORS } from './show-color.js';

const MODAL = '#importShowModal';
const LOG_CONTEXT = { module: 'shows', function: 'chooseImportShow' };
const EMPTY_MESSAGE = 'No other profiles have saved shows.';
const NO_MATCH_MESSAGE = 'No profile or show matches.';
// The filter appears once the list is long enough to need it
const FILTER_MIN_PROFILES = 6;

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** "5 hotkeys and 12 holding tank songs", or "Empty" */
export function describeContents({ hotkeyCount = 0, tankCount = 0 } = {}) {
  const parts = [];
  if (hotkeyCount) parts.push(plural(hotkeyCount, 'hotkey', 'hotkeys'));
  if (tankCount) parts.push(plural(tankCount, 'holding tank song', 'holding tank songs'));
  return parts.length ? parts.join(' and ') : 'Empty';
}

function el(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function buildList(doc, list, groups, select, choose) {
  const rows = [];
  for (const group of groups) {
    if (!group?.shows?.length) continue;
    const header = el(doc, 'div', 'import-show-profile');
    header.setAttribute('role', 'presentation');
    header.dataset.profile = group.profile;
    const icon = el(doc, 'i', 'fas fa-user');
    icon.setAttribute('aria-hidden', 'true');
    header.append(icon, el(doc, 'span', 'import-show-profile-name', group.profile));
    rows.push(header);
    for (const show of group.shows) {
      const row = el(doc, 'button', 'import-show-row');
      row.type = 'button';
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', 'false');
      row.tabIndex = -1;
      row.dataset.profile = group.profile;
      row.dataset.show = show.name;
      // A show without a color gets the neutral bar
      row.dataset.color = SHOW_COLORS.includes(show.color) ? show.color : 'none';
      // Named by the show alone; what it holds is its description
      const id = `importShowRow${rows.length}`;
      const name = el(doc, 'span', 'import-show-name', show.name);
      name.id = `${id}Name`;
      const contents = el(doc, 'span', 'import-show-contents', describeContents(show));
      contents.id = `${id}Contents`;
      row.setAttribute('aria-labelledby', name.id);
      row.setAttribute('aria-describedby', contents.id);
      const text = el(doc, 'span', 'import-show-text');
      text.append(name, contents);
      const check = el(doc, 'i', 'fas fa-check import-show-check');
      check.setAttribute('aria-hidden', 'true');
      row.append(text, check);
      const choice = { profile: group.profile, showId: show.id };
      row.addEventListener('click', () => select(row, choice));
      row.addEventListener('dblclick', () => { select(row, choice); choose(); });
      row.choice = choice;
      rows.push(row);
    }
  }
  list.replaceChildren(...rows);
  return rows;
}

/** Show only the profiles and shows whose names contain the text */
function applyFilter(rows, text) {
  const needle = text.trim().toLocaleLowerCase();
  let shown = 0;
  let header = null;
  let headerMatches = false;
  let headerHasRows = false;
  const finishHeader = () => { if (header) header.hidden = !headerHasRows; };
  for (const row of rows) {
    if (row.getAttribute('role') !== 'option') {
      finishHeader();
      header = row;
      headerMatches = !needle || row.dataset.profile.toLocaleLowerCase().includes(needle);
      headerHasRows = false;
      continue;
    }
    const visible = headerMatches || row.dataset.show.toLocaleLowerCase().includes(needle);
    row.hidden = !visible;
    if (visible) { headerHasRows = true; shown += 1; }
  }
  finishHeader();
  return shown;
}

/**
 * Show the dialog and wait for a choice.
 *
 * @param {Array<{ profile: string, shows: Array<{ id: string, name: string, color?: string|null, hotkeyCount?: number, tankCount?: number }> }>} groups
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
  const filter = doc.getElementById('importShowFilter');
  if (!modal || !list || !empty || !importButton) {
    window.debugLog?.error('Import Show dialog markup is missing', LOG_CONTEXT);
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    // Listeners on the dialog's fixed elements last for this open only
    const listeners = new AbortController();
    const { signal } = listeners;
    let selectedRow = null;
    let selected = null;
    let chosen = null;
    let shown = false;
    let settled = false;

    const finish = (value) => {
      if (settled) return;
      settled = true;
      listeners.abort();
      resolve(value);
    };
    // Resolved once the dialog is hidden, not on the click: the caller may
    // open another dialog next (Save changes?), and dialogs don't stack.
    // Bootstrap ignores hide() while the dialog is still opening, so a choice
    // made then hides it once it has opened.
    const choose = () => {
      if (!selected || chosen) return;
      chosen = selected;
      if (shown) void hide(MODAL, LOG_CONTEXT);
    };
    const select = (row, choice) => {
      if (selectedRow) {
        selectedRow.classList.remove('active');
        selectedRow.setAttribute('aria-selected', 'false');
        selectedRow.tabIndex = -1;
      }
      selectedRow = row;
      selected = choice;
      row.classList.add('active');
      row.setAttribute('aria-selected', 'true');
      row.tabIndex = 0;
      importButton.disabled = false;
    };

    const rows = buildList(doc, list, Array.isArray(groups) ? groups : [], select, choose);
    const options = rows.filter((row) => row.getAttribute('role') === 'option');
    const profileCount = rows.length - options.length;
    // One tab stop for the list: the first show until one is chosen
    if (options[0]) options[0].tabIndex = 0;

    empty.textContent = EMPTY_MESSAGE;
    empty.classList.toggle('d-none', options.length > 0);
    importButton.disabled = true;

    if (filter) {
      filter.value = '';
      filter.closest?.('.import-show-filter')?.classList.toggle('d-none', profileCount < FILTER_MIN_PROFILES);
      filter.addEventListener('input', () => {
        const shown = applyFilter(rows, filter.value);
        empty.textContent = options.length ? NO_MATCH_MESSAGE : EMPTY_MESSAGE;
        empty.classList.toggle('d-none', shown > 0);
        if (selectedRow?.hidden) {
          selectedRow.classList.remove('active');
          selectedRow.setAttribute('aria-selected', 'false');
          selectedRow = null;
          selected = null;
          importButton.disabled = true;
        }
      }, { signal });
    }

    // Up/Down move the choice through the visible shows; Return imports it
    list.addEventListener('keydown', (event) => {
      const visible = options.filter((row) => !row.hidden);
      if (!visible.length) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const at = visible.indexOf(selectedRow);
        const next = event.key === 'ArrowDown'
          ? visible[Math.min(at + 1, visible.length - 1)]
          : visible[Math.max(at - 1, 0)];
        select(next, next.choice);
        next.focus?.();
      } else if (event.key === 'Enter' && selected) {
        event.preventDefault();
        choose();
      }
    }, { signal });

    importButton.addEventListener('click', choose, { signal });
    modal.addEventListener('shown.bs.modal', () => {
      shown = true;
      if (chosen) void hide(MODAL, LOG_CONTEXT);
    }, { signal });
    // Import, or Esc, the backdrop, Cancel and the close button
    modal.addEventListener('hidden.bs.modal', () => finish(chosen), { signal });

    void show(MODAL, LOG_CONTEXT, { backdrop: true, keyboard: true });
  });
}

export default { chooseImportShow, describeContents };
