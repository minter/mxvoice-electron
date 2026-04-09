/**
 * Client-side audience filter for announcements.
 * Compares the running app version + platform against the announcement's
 * audience constraints. Uses a minimal inline version comparator instead
 * of importing semver, because the renderer has no bundler and semver has
 * no browser build.
 */

/**
 * Parse a semver-ish version string into { major, minor, patch }.
 * Pre-release suffixes (-pre.1, -beta, etc.) are stripped.
 * Missing parts default to 0.
 */
function parseVersion(v) {
  const base = String(v || '').split('-')[0];
  const [maj, min, pat] = base.split('.').map(n => parseInt(n, 10) || 0);
  return { major: maj, minor: min, patch: pat };
}

/** Return -1, 0, or 1 for a cmp b. */
function compareVersions(a, b) {
  const x = parseVersion(a);
  const y = parseVersion(b);
  if (x.major !== y.major) return x.major < y.major ? -1 : 1;
  if (x.minor !== y.minor) return x.minor < y.minor ? -1 : 1;
  if (x.patch !== y.patch) return x.patch < y.patch ? -1 : 1;
  return 0;
}

/**
 * @param {Object} announcement - manifest entry with optional `audience`
 * @param {{ version: string, platform: string }} ctx
 * @returns {boolean}
 */
export function passesAudienceFilter(announcement, ctx) {
  const a = announcement.audience;
  if (!a) return true;
  if (a.min_version && compareVersions(ctx.version, a.min_version) < 0) return false;
  if (a.max_version && compareVersions(ctx.version, a.max_version) > 0) return false;
  if (Array.isArray(a.platforms) && a.platforms.length > 0 && !a.platforms.includes(ctx.platform)) return false;
  return true;
}

/**
 * @param {Object} announcement
 * @param {Date} now - current time, injected for testability
 * @returns {boolean}
 */
export function isExpired(announcement, now = new Date()) {
  if (!announcement.expires) return false;
  return new Date(announcement.expires).getTime() <= now.getTime();
}
