const PREF_KEY = 'announcements_seen';

function unwrap(response) {
  if (response && typeof response === 'object' && 'value' in response) return response.value;
  return response;
}

export function createSeenTracking() {
  async function getSeen() {
    const raw = unwrap(await window.secureElectronAPI.profile.getPreference(PREF_KEY));
    return Array.isArray(raw) ? raw : [];
  }
  async function markSeen(id) {
    const seen = await getSeen();
    if (!seen.includes(id)) {
      seen.push(id);
      await window.secureElectronAPI.profile.setPreference(PREF_KEY, seen);
    }
  }
  async function isSeen(id) {
    const seen = await getSeen();
    return seen.includes(id);
  }
  return { getSeen, markSeen, isSeen };
}
