/**
 * Profile Picker Model
 *
 * Pure rules shared by both picker hosts: the startup launcher window and
 * the Switch Profile dialog in the main window. No DOM access here.
 *
 * @module profile-picker/picker-model
 */

export const DEFAULT_PROFILE = 'Default User';

const VALID_NAME = /^[a-zA-Z0-9\s\-_]+$/;

/**
 * Default User first, then alphabetical (case-insensitive)
 * @param {Array<{name: string}>} profiles
 * @returns {Array<{name: string}>}
 */
export function sortProfiles(profiles) {
  return [...profiles].sort((a, b) => {
    if (a.name === DEFAULT_PROFILE) return -1;
    if (b.name === DEFAULT_PROFILE) return 1;
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });
}

/**
 * Match on name or description
 * @param {Array<{name: string, description?: string}>} profiles
 * @param {string} term
 */
export function filterProfiles(profiles, term = '') {
  const needle = term.trim().toLowerCase();
  if (!needle) return [...profiles];
  return profiles.filter((profile) =>
    profile.name.toLowerCase().includes(needle)
    || (profile.description || '').toLowerCase().includes(needle)
  );
}

/**
 * Which profile starts selected. At startup Enter opens the profile used
 * most recently. While switching, the running profile is marked instead,
 * so nothing is preselected.
 * @param {{ profiles: Array, mode: 'startup'|'switch' }} options
 * @returns {string|null}
 */
export function initialSelection({ profiles, mode }) {
  if (!profiles.length) return null;
  if (profiles.length === 1) return profiles[0].name;
  if (mode === 'switch') return null;
  return profiles.reduce((latest, profile) => (
    (profile.last_used || 0) > (latest.last_used || 0) ? profile : latest
  )).name;
}

/**
 * The primary button names what it will do
 * @param {{ mode: 'startup'|'switch', selected: string|null, currentProfile: string|null }} options
 */
export function primaryLabel({ mode, selected, currentProfile }) {
  const isSwitch = mode === 'switch';
  if (!selected) return isSwitch ? 'Switch' : 'Open';
  if (isSwitch && selected === currentProfile) return `Stay on ${selected}`;
  return isSwitch ? `Switch to ${selected}` : `Open ${selected}`;
}

/**
 * Choosing the running profile while switching just closes the picker
 */
export function isNoopChoice({ mode, selected, currentProfile }) {
  return mode === 'switch' && !!selected && selected === currentProfile;
}

/**
 * @param {string} name - Trimmed name
 * @param {Array<{name: string}>} profiles
 * @returns {string|null} Error message, or null when valid
 */
export function validateNewProfileName(name, profiles) {
  if (!name) return 'Profile name is required';
  if (!VALID_NAME.test(name)) {
    return 'Profile name can only contain letters, numbers, spaces, hyphens, and underscores';
  }
  if (profiles.some((profile) => profile.name === name)) {
    return 'A profile with this name already exists';
  }
  return null;
}
