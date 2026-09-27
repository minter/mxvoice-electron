/**
 * Preference Changes
 *
 * Works out which preferences a save actually changed, for the
 * `preferences_changed` analytics event. Only setting names are reported,
 * never values (directory paths can contain user names).
 */

// analytics_enabled is excluded so opting out never produces an event
export const TRACKED_PREFERENCE_KEYS = [
  'database_directory',
  'music_directory',
  'hotkey_directory',
  'fade_out_seconds',
  'crossfade_seconds',
  'debug_log_enabled',
  'prerelease_updates',
  'screen_mode',
];

function normalize(value) {
  return value === undefined || value === null ? '' : String(value);
}

/**
 * @param {Object} previous - Stored values before the save
 * @param {Object} next - Values being saved
 * @returns {string[]} Names of tracked preferences whose value changed
 */
export function changedPreferenceKeys(previous, next) {
  return TRACKED_PREFERENCE_KEYS.filter(
    (key) => key in next && normalize(previous[key]) !== normalize(next[key])
  );
}
