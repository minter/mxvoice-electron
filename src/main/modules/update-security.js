/**
 * Security boundary for packaged application updates.
 *
 * Windows and macOS have a publisher-authentication path. Linux artifacts do
 * not currently have an independent publisher signature, so the application
 * must leave in-app updates unavailable there.
 */

const SUPPORTED_UPDATE_PLATFORMS = new Set(['darwin', 'win32']);

/**
 * Disable updater automation before exposing the updater to application code.
 * Unsupported platforms receive no updater at all.
 *
 * @param {Object|null} updater
 * @param {string} [platform]
 * @returns {Object|null}
 */
export function configureUpdateSecurity(updater, platform = process.platform) {
  if (!updater) return null;
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = false;
  return SUPPORTED_UPDATE_PLATFORMS.has(platform) ? updater : null;
}

/**
 * Squirrel.Mac needs this enabled before its user-approved download so it can
 * stage the verified update. Windows installs only through quitAndInstall().
 *
 * @param {Object|null} updater
 * @param {string} [platform]
 * @returns {boolean} Whether automatic installation was armed
 */
export function allowInstallAfterUserApproval(updater, platform = process.platform) {
  if (!updater || platform !== 'darwin') return false;
  updater.autoInstallOnAppQuit = true;
  return true;
}

/**
 * Remove the macOS installation permission when its approved download fails.
 *
 * @param {Object|null} updater
 */
export function disableAutomaticUpdateInstall(updater) {
  if (updater) updater.autoInstallOnAppQuit = false;
}

