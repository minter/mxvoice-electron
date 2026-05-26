/**
 * Preferences Self-Heal
 *
 * Restores blank directory preferences to sane defaults on startup so that
 * users hit by the pre-4.3.1 preferences-save bug (which wiped global
 * directory settings when the Preferences modal was opened without first
 * populating the inputs — notably during the What's New tour) recover
 * automatically on next launch.
 *
 * Strict no-op when stored values are valid. Only writes when a stored
 * value is an empty/whitespace-only string. Defaults match the ones
 * declared in src/main/index-modular.js.
 *
 * @module preferences-self-heal
 */

import fs from 'fs';
import path from 'path';

const DB_FILENAMES = ['mrvoice.db', 'mxvoice.db'];

/**
 * Probe known locations for an existing database file.
 * Returns the containing directory if found, else null.
 */
function findExistingDatabaseDir(userData) {
  // Order matters: userData root is where modern installs land. The
  // userData/data subdirectory is a very-old fallback that database-setup.js
  // uses when no directory is configured (see initializeMainDatabase).
  const candidates = [userData, path.join(userData, 'data')];
  for (const dir of candidates) {
    for (const file of DB_FILENAMES) {
      try {
        if (fs.existsSync(path.join(dir, file))) return dir;
      } catch {
        // Unreadable path — skip and continue probing.
      }
    }
  }
  return null;
}

function isBlank(value) {
  return typeof value !== 'string' || value.trim() === '';
}

/**
 * Restore any blank directory preferences. Pure function over its
 * dependencies; nothing is read from module-level state.
 *
 * @param {Object} deps
 * @param {Object} deps.store - electron-store instance (or compatible)
 * @param {Object} deps.app - electron app (or compatible with getPath)
 * @param {Object} [deps.debugLog] - logger with warn/error methods
 */
export function selfHealDirectoryPreferences({ store, app, debugLog } = {}) {
  if (!store || !app) return;

  let userData;
  try {
    userData = app.getPath('userData');
  } catch (err) {
    debugLog?.error('Self-heal: could not resolve userData path', {
      module: 'preferences-self-heal',
      function: 'selfHealDirectoryPreferences',
      error: err?.message,
    });
    return;
  }

  const defaults = {
    database_directory: userData,
    music_directory: path.join(userData, 'mp3'),
    hotkey_directory: path.join(userData, 'hotkeys'),
  };

  try {
    if (isBlank(store.get('database_directory'))) {
      const discovered = findExistingDatabaseDir(userData);
      const recovered = discovered || defaults.database_directory;
      debugLog?.warn('Self-heal: database_directory was empty, restoring', {
        module: 'preferences-self-heal',
        function: 'selfHealDirectoryPreferences',
        discoveredExistingDb: !!discovered,
        recovered,
      });
      store.set('database_directory', recovered);
    }

    for (const key of ['music_directory', 'hotkey_directory']) {
      if (isBlank(store.get(key))) {
        debugLog?.warn(`Self-heal: ${key} was empty, restoring to default`, {
          module: 'preferences-self-heal',
          function: 'selfHealDirectoryPreferences',
          recovered: defaults[key],
        });
        store.set(key, defaults[key]);
      }
    }
  } catch (err) {
    debugLog?.error('Self-heal: unexpected failure (continuing startup)', {
      module: 'preferences-self-heal',
      function: 'selfHealDirectoryPreferences',
      error: err?.message,
    });
  }
}

export default { selfHealDirectoryPreferences };
