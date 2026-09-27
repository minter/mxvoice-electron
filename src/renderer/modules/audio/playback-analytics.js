/**
 * Playback Analytics
 *
 * Single source of truth for the `song_played` analytics event. Playback entry
 * points pass a `trigger_method`; selection-based playback (double-click, Enter,
 * Play button, context menu) derives it from where the selected row lives.
 */

import { flushPendingSearch } from '../analytics/search-tracker.js';

/**
 * Work out which part of the UI a selection-based play came from.
 *
 * @param {Object} params
 * @param {Element|null} params.selectedRow - The `#selected_row` element, if any
 * @param {string|undefined} params.holdingTankMode - 'storage' or 'playlist'
 * @returns {'search_result'|'holding_tank'|'playlist'|'hotkey'}
 */
export function resolvePlaybackTrigger({ selectedRow, holdingTankMode }) {
  // No selected row with a song means playback fell back to the active hotkey
  if (!selectedRow?.getAttribute?.('songid')) return 'hotkey';
  if (selectedRow.closest?.('#holding-tank-column')) {
    return holdingTankMode === 'playlist' ? 'playlist' : 'holding_tank';
  }
  if (selectedRow.closest?.('.hotkeys')) return 'hotkey';
  return 'search_result';
}

/**
 * Record that a song started loading for playback.
 *
 * @param {string} [triggerMethod] - Where the play came from
 */
export function trackSongPlayed(triggerMethod) {
  flushPendingSearch();
  window.secureElectronAPI?.analytics?.trackEvent?.('song_played', {
    trigger_method: triggerMethod || 'unknown',
  });
}
