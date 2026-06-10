/**
 * Announcements Module
 *
 * Main-process module for fetching and caching announcements from GitHub,
 * and calling Mailgun for email subscribe.
 */
const SUPPORTED_SCHEMA_VERSION = 1;
const MANIFEST_CACHE_KEY = 'announcements_manifest_cache';
const BODY_CACHE_KEY_PREFIX = 'announcements_body_cache__';

function getManifestGeneration(store) {
  return store.get(MANIFEST_CACHE_KEY)?.generated_at || null;
}

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

  async function fetchBody(relativePath) {
    const cacheKey = BODY_CACHE_KEY_PREFIX + relativePath;
    const cached = store.get(cacheKey);
    const manifestGeneratedAt = getManifestGeneration(store);
    if (cached && typeof cached === 'object' && cached.body && cached.manifestGeneratedAt === manifestGeneratedAt) {
      return cached.body;
    }
    try {
      const url = (bodyUrlBase || '') + relativePath;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      store.set(cacheKey, { body: text, manifestGeneratedAt });
      return text;
    } catch (err) {
      debugLog.warn('Announcements: body fetch failed', {
        module: 'announcements', function: 'fetchBody', path: relativePath,
        error: err?.message || String(err),
      });
      return null;
    }
  }

  async function subscribeEmail(email, vars = {}) {
    if (!mailgun || !mailgun.apiKey || !mailgun.domain || !mailgun.listAddress) {
      return { ok: false, code: 'not_configured', message: 'Email subscription is not configured in this build.' };
    }
    const url = `https://api.mailgun.net/v3/lists/${encodeURIComponent(mailgun.listAddress)}/members`;
    const auth = Buffer.from(`api:${mailgun.apiKey}`).toString('base64');
    const form = new URLSearchParams();
    form.append('address', email);
    form.append('subscribed', 'yes');
    form.append('upsert', 'no');
    if (vars && Object.keys(vars).length > 0) form.append('vars', JSON.stringify(vars));
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });
      const body = await res.text();
      if (res.ok) return { ok: true, code: 'subscribed', message: 'Subscribed successfully.' };
      if (res.status === 400 && /already exists/i.test(body)) {
        return { ok: true, code: 'already_subscribed', message: 'You are already subscribed.' };
      }
      debugLog.warn('Announcements: subscribe failed', { module: 'announcements', function: 'subscribeEmail', status: res.status });
      return { ok: false, code: 'api_error', message: `Mailgun returned ${res.status}.` };
    } catch (err) {
      debugLog.warn('Announcements: subscribe network error', { module: 'announcements', function: 'subscribeEmail', error: err?.message || String(err) });
      return { ok: false, code: 'network_error', message: 'Could not reach the subscription server.' };
    }
  }

  return { fetchManifest, getCachedManifest, fetchBody, subscribeEmail };
}
