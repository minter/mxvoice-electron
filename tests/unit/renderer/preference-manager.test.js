import { beforeEach, describe, expect, it, vi } from 'vitest';

const showModal = vi.fn();
vi.mock('../../../src/renderer/modules/ui/bootstrap-adapter.js', () => ({ showModal }));

const fields = new Map();
globalThis.window = { bootstrap: { Modal: function Modal() {} }, debugLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } };
globalThis.document = {
  getElementById(id) {
    if (!fields.has(id)) fields.set(id, { value: '', checked: false });
    return fields.get(id);
  }
};

const { initializePreferenceManager } = await import('../../../src/renderer/modules/preferences/preference-manager.js');

function api(values = {}) {
  return {
    store: { get: vi.fn(async (key) => values[key] ?? { success: true, value: null }) },
    profile: { getPreference: vi.fn(async (key) => values[key] ?? { success: true, value: null }) },
    analytics: { getOptOutStatus: vi.fn(async () => ({ success: true, value: true })) }
  };
}

describe('preference manager UI loading', () => {
  beforeEach(() => { fields.clear(); vi.clearAllMocks(); });

  it('routes preferences, applies defaults, and inverts analytics opt-out', async () => {
    const manager = initializePreferenceManager({ electronAPI: api({
      database_directory: { success: true, value: '/db' },
      music_directory: { success: true, value: '/music' },
      fade_out_seconds: { success: true, value: 0 },
      screen_mode: { success: true, value: 'dark' }
    }) });
    await manager.loadPreferences();
    expect(fields.get('preferences-database-directory').value).toBe('/db');
    expect(fields.get('preferences-song-directory').value).toBe('/music');
    expect(fields.get('preferences-fadeout-seconds').value).toBe('3');
    expect(fields.get('preferences-screen-mode').value).toBe('dark');
    expect(fields.get('preferences-analytics-enabled').checked).toBe(false);
  });

  it('returns fallbacks for failed and rejected preference reads', async () => {
    const electronAPI = api({ prerelease_updates: { success: false, error: 'bad value' } });
    electronAPI.profile.getPreference.mockRejectedValueOnce(new Error('offline'));
    const manager = initializePreferenceManager({ electronAPI });
    await expect(manager.getScreenMode()).resolves.toBe('auto');
    await expect(manager.getPrereleaseUpdates()).resolves.toBe(false);
  });

  it('loads preferences before opening the modal', async () => {
    const manager = initializePreferenceManager({ electronAPI: api() });
    await manager.openPreferencesModal();
    expect(showModal).toHaveBeenCalledWith('#preferencesModal');
  });
});
