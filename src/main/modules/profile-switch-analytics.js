/**
 * Profile Switch Analytics
 *
 * Records `profile_switched` only when a different profile is actually chosen.
 * Tracking in the renderer counted attempts: the launcher can be closed without
 * choosing, which relaunches on the same profile.
 *
 * @module profile-switch-analytics
 */

/**
 * @param {Object} params
 * @param {Object|null} params.analytics - Analytics instance
 * @param {string|undefined} params.fromProfile - Profile in use before the switch
 * @param {string} params.toProfile - Profile being launched
 * @param {'launcher'|'direct'} params.method - How the profile was chosen
 */
export function trackProfileSwitch({ analytics, fromProfile, toProfile, method }) {
  if (!fromProfile || !toProfile || fromProfile === toProfile) return;
  analytics?.trackEvent('profile_switched', { method });
}
