/**
 * Pending Update
 *
 * Single source of truth for the newest update the app knows about, so the
 * quiet toolbar indicator, background-check dedupe, and renderer reloads all
 * agree on which version is on offer.
 *
 * @module pending-update
 */

// A download that never settles must not disable background checks forever
export const DOWNLOAD_GUARD_MS = 30 * 60 * 1000;

/**
 * Remember an update found by any check (modal or quiet path).
 *
 * @param {Object} updateState
 * @param {Object} update
 * @param {string} update.version
 * @param {string} update.name - Release name shown on the indicator
 * @param {string} update.notes - Release notes HTML (sanitized in the renderer)
 * @param {boolean} update.quiet - Whether the quiet indicator announced it
 */
export function recordAvailableUpdate(updateState, { version, name, notes, quiet }) {
  const previous = updateState.pendingUpdate;
  const shownQuietly = quiet || (previous?.version === version && previous.shownQuietly);
  updateState.pendingUpdate = { version, name, notes, shownQuietly };
}

/**
 * Version already announced by the quiet indicator, for background-check dedupe.
 *
 * @returns {string|null}
 */
export function quietlyAnnouncedVersion(updateState) {
  const pending = updateState.pendingUpdate;
  return pending?.shownQuietly ? pending.version : null;
}

/**
 * Record a finished download. Tracked by version because a manual
 * Check for Updates resets the `downloaded` flag.
 */
export function recordDownloadedUpdate(updateState, version) {
  updateState.downloaded = true;
  updateState.downloadedVersion = version;
}

/**
 * The update the indicator should offer, or null.
 *
 * @returns {{ name: string, notes: string }|null}
 */
export function getPendingUpdateNotice(updateState) {
  const pending = updateState.pendingUpdate;
  if (!pending || pending.version === updateState.downloadedVersion) return null;
  return { name: pending.name, notes: pending.notes };
}

/**
 * Whether an in-progress download should block background checks.
 */
export function isDownloadGuardActive(updateState, now = Date.now()) {
  if (!updateState.downloading) return false;
  return now - (updateState.downloadStartedAt ?? now) < DOWNLOAD_GUARD_MS;
}
