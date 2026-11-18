/**
 * Profile Delete
 *
 * Deletes a profile together with its crash-recovery record (which lives
 * outside the profile directory, so deleting the directory leaves it behind).
 * Shared by the main window's and the launcher's delete handlers.
 *
 * @module profile-delete
 */

/**
 * @param {string} profileName
 * @param {Object} deps
 * @param {Object} deps.profileManager - { deleteProfile, getDeleteProfileBlocker }
 * @param {Object} [deps.showSession] - from createShowSession
 * @param {Object} [deps.recoveryStore] - from createRecoveryStore
 * @param {() => string|null} [deps.getCurrentProfile]
 * @param {Object} [deps.debugLog]
 * @returns {Promise<{ success: boolean, error?: string, sessionEnded?: boolean }>}
 *   deleteProfile's result; `sessionEnded` when it failed after the current
 *   profile's session was ended
 */
export async function deleteProfileWithRecovery(profileName, {
  profileManager,
  showSession,
  recoveryStore,
  getCurrentProfile,
  debugLog
}) {
  const logCtx = { module: 'profile-delete', function: 'deleteProfileWithRecovery', profileName };

  // Deleting the profile in use: fence its session first so no late recovery
  // write lands after the delete. Only for a delete that will happen; a
  // refused one must leave the session running.
  let sessionEnded = false;
  if (profileName === getCurrentProfile?.() && !profileManager.getDeleteProfileBlocker(profileName)) {
    sessionEnded = Boolean(showSession);
    try {
      await showSession?.end('profile-deleted');
    } catch (error) {
      debugLog?.warn('Could not end the show session before deleting its profile', { ...logCtx, error: error.message });
    }
  }

  let result;
  try {
    result = await profileManager.deleteProfile(profileName);
  } catch (error) {
    if (!sessionEnded) throw error;
    result = { success: false, error: error.message };
  }

  // A delete that failed after the session ended (a Windows file lock, say)
  // leaves the profile in place: the page reloads to reopen its session
  if (!result?.success && sessionEnded) {
    debugLog?.warn('Profile delete failed after its show session ended', { ...logCtx, error: result?.error });
    return { ...result, success: false, sessionEnded: true };
  }

  if (result?.success) {
    try {
      await recoveryStore?.retire(profileName);
    } catch (error) {
      debugLog?.warn('Could not remove the deleted profile\'s crash-recovery record', { ...logCtx, error: error.message });
    }
    // Its own try: a failed record retire must not leave the played counts behind
    try {
      await recoveryStore?.retirePlayed?.(profileName);
    } catch (error) {
      debugLog?.warn('Could not remove the deleted profile\'s played counts', { ...logCtx, error: error.message });
    }
  }
  return result;
}

export default { deleteProfileWithRecovery };
