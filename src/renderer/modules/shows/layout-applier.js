/**
 * Show Layout Applier
 *
 * Swaps the whole hotkey and holding-tank layout in place without touching
 * playback. The playing sound, #song_now_playing and autoplay are left alone;
 * only the marks that point into the old layout are cleared, and the show
 * generation is bumped so Playlist mode never reattaches a song that started
 * before the swap.
 */

import { safeShowTab } from '../ui/bootstrap-helpers.js';

const LOG_CONTEXT = { module: 'shows', function: 'applyLayout' };

function tabNumber(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 5 ? number : 1;
}

/**
 * Look up every song id with one batch query.
 * @param {string[]} ids - distinct song ids
 * @param {(ids: string[]) => Promise<{ success: boolean, data?: Array }>} getSongsByIds
 * @returns {Promise<Map<string, Object>>} library rows keyed by string id
 */
export async function fetchSongsById(ids, getSongsByIds) {
  const songsById = new Map();
  if (ids.length === 0) return songsById;
  if (typeof getSongsByIds !== 'function') throw new Error('Batch song lookup is unavailable');
  const result = await getSongsByIds(ids);
  if (result?.success === false) throw new Error(result.error || 'Failed to load song metadata');
  const rows = result?.data || result || [];
  if (!Array.isArray(rows)) throw new Error('Failed to load song metadata');
  rows.forEach(row => songsById.set(String(row.id), row));
  return songsById;
}

function clearLayoutMarks(doc, win) {
  doc.querySelectorAll('.now_playing').forEach(element => element.classList.remove('now_playing'));
  doc.getElementById('selected_row')?.removeAttribute('id');
  doc.querySelectorAll('.active-hotkey')
    .forEach(element => element.classList.remove('active-hotkey', 'selected-row'));
  if (win) win.currentSelectedHotkey = null;
}

/**
 * Apply a show layout in place.
 *
 * Fetches every song once, then, synchronously, clears the old layout's marks,
 * applies both collections, selects the saved tabs and bumps showGeneration.
 * A failed fetch throws before anything is changed.
 *
 * @param {{ hotkeys: Array, holdingTank: Array, selected?: { hotkeyTab: number, holdingTankTab: number } }} layout
 * @param {Object} deps
 * @param {{ collectSongIds: Function, applyHotkeySnapshot: Function }} deps.hotkeys
 * @param {{ collectSongIds: Function, applyHoldingTankSnapshot: Function }} deps.holdingTank
 * @param {(ids: string[]) => Promise<{ success: boolean, data?: Array }>} deps.getSongsByIds
 * @param {{ get: Function, set: Function }} deps.sharedState
 * @param {Function} [deps.showTab] - defaults to safeShowTab
 * @param {Document} [deps.document]
 * @param {Window} [deps.window]
 * @returns {Promise<{ dropped: number, droppedIds: string[] }>} the distinct song
 *   ids missing from the library, and how many
 */
export async function applyLayout(layout, deps) {
  const {
    hotkeys,
    holdingTank,
    getSongsByIds,
    sharedState,
    showTab = safeShowTab,
    document: doc = globalThis.document,
    window: win = globalThis.window
  } = deps;
  const hotkeySnapshot = layout?.hotkeys || [];
  const holdingTankSnapshot = layout?.holdingTank || [];

  const songIds = [...new Set([
    ...hotkeys.collectSongIds(hotkeySnapshot),
    ...holdingTank.collectSongIds(holdingTankSnapshot)
  ])];
  const songsById = await fetchSongsById(songIds, getSongsByIds);

  // Everything below runs in one synchronous step, so no playback callback
  // can observe a half-applied layout.
  clearLayoutMarks(doc, win);
  hotkeys.applyHotkeySnapshot(hotkeySnapshot, songsById);
  holdingTank.applyHoldingTankSnapshot(holdingTankSnapshot, songsById);
  showTab(`#hotkey_tabs li:nth-child(${tabNumber(layout?.selected?.hotkeyTab)}) a`, LOG_CONTEXT);
  showTab(`#holding_tank_tabs li:nth-child(${tabNumber(layout?.selected?.holdingTankTab)}) a`, LOG_CONTEXT);
  sharedState.set('showGeneration', (Number(sharedState.get('showGeneration')) || 0) + 1);

  const droppedIds = songIds.filter(songId => !songsById.has(songId));
  const dropped = droppedIds.length;
  win?.debugLog?.info('Show layout applied', { ...LOG_CONTEXT, songCount: songIds.length, dropped });
  return { dropped, droppedIds };
}
