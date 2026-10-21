/**
 * Played Counts
 *
 * How many times each song has been played tonight, by song id. A play is
 * counted the moment its playback starts (audio-manager). The counts belong
 * to the profile's session, not to a show: they start empty when the profile
 * opens and carry across show changes. Main keeps a copy for crash restore
 * (show:record-play, show:clear-played); `load` takes the counts a restore
 * hands back, and nothing is counted before it (the session isn't settled).
 *
 * Every change dispatches `played-counts-changed` on window with
 * `{ songIds }`, the songs whose count changed, or null when any may have.
 */

export const PLAYED_COUNTS_CHANGED = 'played-counts-changed';

const SONG_ID = /^\d+$/;
const LOG_CONTEXT = { module: 'played-counts' };

const counts = new Map();
// Nothing counts until the session's counts are loaded: until then main
// refuses them too (a crash prompt open, or an open that failed)
let settled = false;

/** The song id as a digit string, or null for anything else. */
function songIdOf(id) {
  const value = typeof id === 'number' && Number.isInteger(id) && id >= 0 ? String(id) : id;
  return typeof value === 'string' && SONG_ID.test(value) ? value : null;
}

function changed(songIds) {
  try {
    window.dispatchEvent(new CustomEvent(PLAYED_COUNTS_CHANGED, { detail: { songIds } }));
  } catch (error) {
    // A listener's failure must never stop the play that was counted
    window.debugLog?.warn('Could not announce played counts', { ...LOG_CONTEXT, function: 'changed', error: error.message });
  }
}

// Main's copy is only for crash restore; a failure there never stops counting
function tellMain(fn, method, arg) {
  try {
    const result = window.secureElectronAPI?.shows?.[method]?.(arg);
    Promise.resolve(result)
      .then((r) => {
        if (r && r.success === false) window.debugLog?.warn('Played counts not saved', { ...LOG_CONTEXT, function: fn, error: r.error });
      })
      .catch((error) => window.debugLog?.warn('Played counts not saved', { ...LOG_CONTEXT, function: fn, error: error.message }));
  } catch (error) {
    window.debugLog?.warn('Played counts not saved', { ...LOG_CONTEXT, function: fn, error: error.message });
  }
}

/** Times the song has been played tonight; 0 when never. */
export function count(id) {
  return counts.get(songIdOf(id)) ?? 0;
}

export function hasAny() {
  return counts.size > 0;
}

/** Count one play of a song whose playback just started. */
export function recordPlay(id) {
  const songId = songIdOf(id);
  if (!songId || !settled) return;
  counts.set(songId, (counts.get(songId) ?? 0) + 1);
  changed([songId]);
  tellMain('recordPlay', 'recordPlay', songId);
}

/** Mark one song as unplayed. */
export function clear(id) {
  const songId = songIdOf(id);
  if (!songId || !counts.has(songId)) return;
  counts.delete(songId);
  changed([songId]);
  tellMain('clear', 'clearPlayed', songId);
}

/** Shows → Reset Played: clear every count. */
export function clearAll() {
  if (counts.size === 0) return;
  const songIds = [...counts.keys()];
  counts.clear();
  changed(songIds);
  tellMain('clearAll', 'clearPlayed', null);
}

/** Replace the counts with ones main restored; main already has them. */
export function load(map) {
  settled = true;
  counts.clear();
  for (const [id, n] of Object.entries(map ?? {})) {
    const songId = songIdOf(id);
    if (songId && Number.isInteger(n) && n > 0) counts.set(songId, n);
  }
  changed(null);
}

export default { PLAYED_COUNTS_CHANGED, count, hasAny, recordPlay, clear, clearAll, load };
