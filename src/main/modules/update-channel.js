/**
 * Update Channel
 *
 * Configures electron-updater's prerelease handling.
 *
 * electron-updater derives a channel from the running version's prerelease id
 * and, for any id other than alpha/beta, only offers releases on that same
 * channel. A `4.3.0-pre.3` install therefore never saw 4.3.x stable releases.
 * Pinning prerelease installs to the `beta` channel makes the updater offer
 * the newest stable or beta release instead. Prereleases must be versioned
 * `X.Y.Z-beta.N` from now on; `-pre.N` releases are invisible on this channel.
 *
 * GitHub releases only publish latest*.yml (electron-builder does not derive a
 * channel file from the version for the GitHub provider). On the beta channel
 * the updater requests beta.yml first and falls back to latest.yml.
 *
 * @module update-channel
 */

/**
 * Whether a version updates from GitHub releases. Only 3.x uses the legacy
 * download.mxvoice.app server, which answers "no update" (204) for any other
 * version, so a `startsWith('4.')` check would have silently frozen 5.x.
 *
 * @param {string} version
 * @returns {boolean} True for major version 4 and above
 */
export function usesGitHubUpdates(version) {
  return parseInt(String(version), 10) >= 4;
}

/**
 * @param {string} version
 * @returns {boolean} True for -pre, -beta, and -alpha versions
 */
export function isPrereleaseVersion(version) {
  return /-(pre|beta|alpha)\b/.test(String(version));
}

/**
 * Apply prerelease settings to the updater. Safe to call again when the
 * user's prerelease preference changes.
 *
 * @param {Object} autoUpdater - electron-updater instance
 * @param {Object} options
 * @param {string} options.currentVersion - Running app version
 * @param {boolean} options.userPrefersPrereleases - The prerelease_updates preference
 * @returns {{ allowPrerelease: boolean, isCurrentlyPrerelease: boolean }}
 */
export function configureUpdateChannel(autoUpdater, { currentVersion, userPrefersPrereleases }) {
  const isCurrentlyPrerelease = isPrereleaseVersion(currentVersion);
  const allowPrerelease = !!userPrefersPrereleases || isCurrentlyPrerelease;

  autoUpdater.allowPrerelease = allowPrerelease;
  autoUpdater.channel = allowPrerelease ? 'beta' : 'latest';
  // electron-updater's channel setter silently enables downgrades
  autoUpdater.allowDowngrade = false;

  return { allowPrerelease, isCurrentlyPrerelease };
}
