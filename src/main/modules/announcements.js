/**
 * Announcements Module
 *
 * Main-process module for fetching and caching announcements from GitHub,
 * and calling Mailgun for email subscribe.
 */
const SUPPORTED_SCHEMA_VERSION = 1;
const MANIFEST_CACHE_KEY = 'announcements_manifest_cache';
const BODY_CACHE_KEY_PREFIX = 'announcements_body_cache__';

export function createAnnouncements({ store, debugLog, manifestUrl, bodyUrlBase, mailgun }) {
  async function fetchManifest() {
    try {
      const res = await fetch(manifestUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const manifest = await res.json();
      if (manifest.schema_version !== SUPPORTED_SCHEMA_VERSION) {
        debugLog.warn('Announcements: unknown schema version, ignoring', {
          module: 'announcements', function: 'fetchManifest',
          received: manifest.schema_version, supported: SUPPORTED_SCHEMA_VERSION,
        });
        return store.get(MANIFEST_CACHE_KEY) || null;
      }
      store.set(MANIFEST_CACHE_KEY, manifest);
      return manifest;
    } catch (err) {
      debugLog.warn('Announcements: manifest fetch failed, using cache', {
        module: 'announcements', function: 'fetchManifest',
        error: err?.message || String(err),
      });
      return store.get(MANIFEST_CACHE_KEY) || null;
    }
  }

  function getCachedManifest() {
    return store.get(MANIFEST_CACHE_KEY) || null;
  }

  return { fetchManifest, getCachedManifest };
}
