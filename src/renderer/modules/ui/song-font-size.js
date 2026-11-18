/**
 * Song font size (View > Increase / Decrease Font Size)
 *
 * One size for every song row, kept as the CSS variable --song-font-size on
 * <html> (index.css): search rows use it as is, hotkey slots and holding tank
 * rows 2px larger. Because the rows read the variable, rows drawn later
 * (a new search, a show switch, a drop) get the size too. The size is the
 * profile's font_size preference, applied when the app starts.
 */

import sharedState from '../shared-state.js';

export const DEFAULT_SONG_FONT_SIZE = 11;
export const MIN_SONG_FONT_SIZE = 8;
export const MAX_SONG_FONT_SIZE = 25;

let current = DEFAULT_SONG_FONT_SIZE;

function clamp(size) {
  const n = Math.round(Number(size));
  if (!Number.isFinite(n)) return DEFAULT_SONG_FONT_SIZE;
  return Math.min(MAX_SONG_FONT_SIZE, Math.max(MIN_SONG_FONT_SIZE, n));
}

/** The size in px that search rows use */
export function getSongFontSize() {
  return current;
}

/**
 * Show every song row at this size (not saved).
 * @returns {number} the size applied, after clamping
 */
export function applySongFontSize(size, doc = globalThis.document) {
  current = clamp(size);
  doc?.documentElement?.style?.setProperty('--song-font-size', `${current}px`);
  sharedState.set('fontSize', current);
  return current;
}

/** Apply a size and save it to the profile */
export async function setSongFontSize(size, electronAPI = window.secureElectronAPI) {
  const applied = applySongFontSize(size);
  try {
    if (electronAPI?.profile?.setPreference) await electronAPI.profile.setPreference('font_size', applied);
  } catch (error) {
    window.debugLog?.warn('Could not save the font size', { module: 'song-font-size', function: 'setSongFontSize', error: error?.message });
  }
  return applied;
}

/** One step bigger (+1) or smaller (-1) */
export function stepSongFontSize(delta, electronAPI) {
  return setSongFontSize(current + delta, electronAPI);
}

/** Apply the profile's saved size, if it has one */
export async function loadSongFontSize(electronAPI = window.secureElectronAPI) {
  try {
    const result = await electronAPI?.profile?.getPreference?.('font_size');
    const value = result?.success ? result.value : undefined;
    if (value !== undefined && value !== null && value !== '') return applySongFontSize(value);
  } catch (error) {
    window.debugLog?.warn('Could not read the font size', { module: 'song-font-size', function: 'loadSongFontSize', error: error?.message });
  }
  return applySongFontSize(DEFAULT_SONG_FONT_SIZE);
}

export default {
  DEFAULT_SONG_FONT_SIZE,
  getSongFontSize,
  applySongFontSize,
  setSongFontSize,
  stepSongFontSize,
  loadSongFontSize
};
