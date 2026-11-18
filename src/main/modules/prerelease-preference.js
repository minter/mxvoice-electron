/**
 * Prerelease Preference
 *
 * "Include prerelease updates" is saved per profile, but the auto-updater
 * reads the global store's copy: it is set up at startup, before any profile
 * opens. Whenever a profile opens (at launch, and on a switch) its own
 * preference is copied there, so updates follow the profile in use rather
 * than whichever profile last saved Preferences.
 *
 * @module prerelease-preference
 */

/**
 * Copy a profile's prerelease_updates preference to the global store. The
 * store's change listener reconfigures the auto-updater's channel.
 *
 * @param {Object} deps
 * @param {string} deps.profileName
 * @param {{ loadProfilePreferences: (name: string) => Promise<Object|null> }} deps.profileManager
 * @param {{ set: (key: string, value: *) => void }} deps.store - the global electron-store
 * @returns {Promise<boolean|null>} the value copied, or null when the profile has none
 */
export async function syncPrereleasePreference({ profileName, profileManager, store }) {
  const preferences = await profileManager.loadProfilePreferences(profileName);
  if (!preferences || !('prerelease_updates' in preferences)) return null;
  store.set('prerelease_updates', preferences.prerelease_updates);
  return preferences.prerelease_updates;
}

export default { syncPrereleasePreference };
