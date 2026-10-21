/**
 * Played Pills
 *
 * The small "▶ n" pill on every row that shows a song played tonight: a
 * hotkey slot (after the song name), a holding tank row (after the title)
 * and a search result (at the end of the Title cell). Shown only for a count
 * of 1 or more. The count is drawn from `data-count` by CSS, so the pill adds
 * no text to the row and never carries a `songid` itself.
 *
 * Pills follow the counts (`played-counts-changed`, re-rendering only the
 * rows of the songs that changed) and the rows: hotkey and holding tank rows
 * are filled, swapped and cleared in many places, so a MutationObserver
 * re-syncs any row whose songid or content changes. Search rows get their
 * pill when they are rendered (appendPlayedPill).
 *
 * Styles: src/stylesheets/played-counts.css, colors in colors.css.
 */

import { PLAYED_COUNTS_CHANGED, count } from './played-counts.js';

const PILL = 'played-pill';
const SEARCH_HOST = 'played-host';
const ROW_SELECTOR = '.hotkeys li, .holding_tank li';

let installed = false;

function setCount(pill, n) {
  pill.dataset.count = String(n);
  pill.setAttribute('aria-label', `Played ${n} ${n === 1 ? 'time' : 'times'} tonight`);
}

function createPill(n) {
  const pill = document.createElement('small');
  pill.className = PILL;
  const icon = document.createElement('i');
  icon.className = 'fas fa-play';
  icon.setAttribute('aria-hidden', 'true');
  pill.append(icon);
  setCount(pill, n);
  return pill;
}

/**
 * Bring one host's pill in line with its song's count. The pill goes at the
 * end of the host, right after its text.
 */
function syncHost(host, songId) {
  const n = songId ? count(songId) : 0;
  const pill = host.querySelector(`:scope > .${PILL}`);
  if (n < 1) {
    pill?.remove();
    return;
  }
  if (pill) {
    if (pill.dataset.count !== String(n)) setCount(pill, n);
    return;
  }
  host.append(createPill(n));
}

function syncRow(li) {
  syncHost(li, li.getAttribute('songid'));
}

function syncSearchCell(td) {
  syncHost(td, td.closest('tr')?.getAttribute('songid'));
}

/**
 * Give a search result's Title cell its pill, as the row is rendered.
 * @param {HTMLElement} td - the Title cell
 * @param {string|number} songId
 */
export function appendPlayedPill(td, songId) {
  td.classList.add(SEARCH_HOST);
  const n = count(songId);
  if (n > 0) td.append(createPill(n));
}

function syncSongs(songIds) {
  if (songIds === null) {
    document.querySelectorAll(ROW_SELECTOR).forEach(syncRow);
    document.querySelectorAll(`#search_results td.${SEARCH_HOST}`).forEach(syncSearchCell);
    return;
  }
  for (const id of songIds) {
    // Song ids are digit strings, safe in a selector
    document.querySelectorAll(`.hotkeys li[songid="${id}"], .holding_tank li[songid="${id}"]`).forEach(syncRow);
    document.querySelectorAll(`#search_results tr[songid="${id}"] > td.${SEARCH_HOST}`).forEach(syncSearchCell);
  }
}

/** The hotkey or holding tank rows a batch of DOM changes touched. */
function touchedRows(records) {
  const rows = new Set();
  const consider = (node) => {
    if (node?.nodeType !== 1) return;
    if (node.matches(ROW_SELECTOR)) rows.add(node);
    else node.querySelectorAll?.(ROW_SELECTOR).forEach((li) => rows.add(li));
  };
  for (const record of records) {
    if (record.type === 'attributes') {
      consider(record.target);
    } else {
      // A row whose text was replaced, or rows added to a list
      const row = record.target.nodeType === 1 ? record.target.closest(ROW_SELECTOR) : null;
      if (row) rows.add(row);
      record.addedNodes.forEach(consider);
    }
  }
  return rows;
}

/** Start following the counts and the rows. Safe to call more than once. */
export function installPlayedPills() {
  if (installed || typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
  installed = true;
  window.addEventListener(PLAYED_COUNTS_CHANGED, (event) => syncSongs(event.detail?.songIds ?? null));
  // A pill this adds or updates is itself a change, which the next pass finds already in line
  const observer = new MutationObserver((records) => touchedRows(records).forEach(syncRow));
  for (const id of ['hotkey-tab-content', 'holding-tank-tab-content']) {
    const root = document.getElementById(id);
    if (root) observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['songid'] });
  }
  syncSongs(null);
}

export default { appendPlayedPill, installPlayedPills };
