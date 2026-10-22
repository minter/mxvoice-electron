/**
 * One-time copy of the app-wide fade length into every profile.
 *
 * 4.3.2 faded using the global store's fade_out_seconds and ignored each
 * profile's value; 4.4.0 uses the profile value. Without this copy every
 * profile would jump to its own (usually default) value after the update.
 */

const MIGRATED_FLAG = 'fade_out_migrated_to_profiles';
// The 4.3.2 default for the global fade_out_seconds.
const LEGACY_FADE_OUT_SECONDS = 2;

function legacyFadeSeconds(store) {
  // Read the raw stored value: the store's own default is 3, which would
  // hide that nothing was ever stored.
  const raw = store.has('fade_out_seconds') ? Number(store.get('fade_out_seconds')) : NaN;
  return Number.isFinite(raw) && raw > 0 ? raw : LEGACY_FADE_OUT_SECONDS;
}

async function migrateFadeToProfiles({ store, listProfiles, loadProfilePreferences, saveProfilePreferences, debugLog }) {
  const migrated = [];
  if (store.get(MIGRATED_FLAG) === true) return { migrated };

  const seconds = legacyFadeSeconds(store);
  let names = [];
  try {
    names = listProfiles() || [];
  } catch (error) {
    debugLog?.error?.('Could not list profiles for the fade migration', { module: 'fade-migration', function: 'migrateFadeToProfiles', error: error.message });
  }

  for (const name of names) {
    try {
      const preferences = await loadProfilePreferences(name);
      if (!preferences) throw new Error('Preferences could not be read');
      preferences.fade_out_seconds = seconds;
      if (await saveProfilePreferences(name, preferences) === false) throw new Error('Preferences could not be saved');
      migrated.push(name);
    } catch (error) {
      debugLog?.warn?.('Skipped a profile in the fade migration', { module: 'fade-migration', function: 'migrateFadeToProfiles', profile: name, error: error.message });
    }
  }

  // Set even after skips so this never loops
  store.set(MIGRATED_FLAG, true);
  return { migrated };
}

export { migrateFadeToProfiles, MIGRATED_FLAG, LEGACY_FADE_OUT_SECONDS };
