/**
 * Profile preference files
 *
 * Reads a profile's preferences.json from somewhere the app did not just write
 * it (an imported archive, a backup) and makes its backup policy safe.
 *
 * Out-of-range backup settings are corrected, never refused: older versions
 * saved whatever the count field held (a cleared field is saved as null), and
 * refusing such a file would make the profile's backups impossible to restore.
 * Every place that uses the settings revalidates them as well, so a corrected
 * file is the tidy outcome, not the only defence.
 *
 * Only a file that cannot be read, is not JSON, or is not an object is
 * refused: nothing sensible can be made of it.
 *
 * @module profile-preference-files
 */

import fs from 'fs';
import { validateProfilePreferences } from './profile-preference-validator.js';

/**
 * @param {string} preferencesPath
 * @param {{ write?: boolean }} [options] - write: false only checks
 * @returns {Promise<{ success: true, changed: boolean, warning?: string } | { success: false, error: string }>}
 *   error is a fragment such as "are not valid JSON", to follow a subject
 */
async function normalizePreferencesFile(preferencesPath, { write = true } = {}) {
  let text;
  try {
    text = await fs.promises.readFile(preferencesPath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return { success: true, changed: false };
    return { success: false, error: 'cannot be read' };
  }

  let preferences;
  try {
    preferences = JSON.parse(text);
  } catch {
    return { success: false, error: 'are not valid JSON' };
  }

  const validation = validateProfilePreferences(preferences);
  if (!validation.value) return { success: false, error: 'are not a JSON object' };
  if (validation.valid) return { success: true, changed: false };

  if (write) {
    await fs.promises.writeFile(preferencesPath, JSON.stringify(validation.value, null, 2));
  }
  return { success: true, changed: true, warning: validation.error };
}

export { normalizePreferencesFile };
