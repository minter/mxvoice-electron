import { beforeEach, describe, expect, it, vi } from 'vitest';

const safeHideModal = vi.fn();
vi.mock('../../../src/renderer/modules/ui/bootstrap-helpers.js', () => ({ safeHideModal }));

const fields = new Map();
globalThis.window = { debugLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } };
globalThis.document = { getElementById: (id) => fields.get(id) || null };

const { initializeSettingsController } = await import('../../../src/renderer/modules/preferences/settings-controller.js');

function setFields(overrides = {}) {
  const defaults = {
    'preferences-database-directory': { value: '' }, 'preferences-song-directory': { value: '/new-music' },
    'preferences-hotkey-directory': { value: '' }, 'preferences-fadeout-seconds': { value: '5' },
    'preferences-crossfade-seconds': { value: '2' }, 'preferences-debug-log-enabled': { checked: true },
    'preferences-prerelease-updates': { checked: false }, 'preferences-screen-mode': { value: 'dark' },
    'preferences-analytics-enabled': { checked: true }
  };
  fields.clear(); Object.entries({ ...defaults, ...overrides }).forEach(([key, value]) => fields.set(key, value));
}

function createAPI() {
  const stored = { database_directory: '/db', music_directory: '/old', hotkey_directory: '/hotkeys', debug_log_enabled: true };
  const profileStored = { fade_out_seconds: 5, crossfade_seconds: 0, prerelease_updates: false, screen_mode: 'auto' };
  return {
    store: {
      get: vi.fn(async (key) => ({ success: true, value: stored[key] })),
      set: vi.fn(async () => ({ success: true }))
    },
    profile: {
      getPreference: vi.fn(async (key) => ({ success: true, value: profileStored[key] })),
      setPreferences: vi.fn(async () => ({ success: true }))
    },
    analytics: { trackEvent: vi.fn(), setOptOut: vi.fn(async () => ({ success: true })) }
  };
}

describe('settings controller', () => {
  beforeEach(() => { setFields(); vi.clearAllMocks(); });

  it('preserves blank directories and atomically saves profile preferences', async () => {
    const electronAPI = createAPI();
    const moduleRegistry = {
      audio: { updateMusicDirectoryCache: vi.fn() },
      themeManagement: { setUserTheme: vi.fn(async () => {}) }
    };
    const controller = initializeSettingsController({ electronAPI, moduleRegistry });
    const event = { preventDefault: vi.fn() };
    await controller.savePreferences(event);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(electronAPI.store.set).toHaveBeenCalledWith('database_directory', '/db');
    expect(electronAPI.store.set).toHaveBeenCalledWith('music_directory', '/new-music');
    expect(electronAPI.profile.setPreferences).toHaveBeenCalledWith(expect.objectContaining({
      fade_out_seconds: 5, crossfade_seconds: 2, screen_mode: 'dark'
    }));
    expect(moduleRegistry.audio.updateMusicDirectoryCache).toHaveBeenCalledWith('/new-music');
    expect(electronAPI.analytics.setOptOut).toHaveBeenCalledWith(false);
    expect(safeHideModal).toHaveBeenCalledWith('#preferencesModal', expect.any(Object));
  });

  it('reports only the names of preferences that changed', async () => {
    const electronAPI = createAPI();
    const controller = initializeSettingsController({ electronAPI, moduleRegistry: {} });
    await controller.savePreferences({ preventDefault: vi.fn() });

    expect(electronAPI.analytics.trackEvent).toHaveBeenCalledWith('preferences_changed', {
      setting_names: ['music_directory', 'crossfade_seconds', 'screen_mode'],
    });
    // Each directory preference is read once, not again for the comparison
    expect(electronAPI.store.get.mock.calls.filter(([key]) => key === 'music_directory')).toHaveLength(1);
  });

  it('still saves when comparing preferences for analytics fails', async () => {
    const electronAPI = createAPI();
    electronAPI.profile.getPreference = vi.fn(async () => { throw new Error('offline'); });
    const controller = initializeSettingsController({ electronAPI, moduleRegistry: {} });
    await controller.savePreferences({ preventDefault: vi.fn() });

    expect(electronAPI.analytics.trackEvent).not.toHaveBeenCalled();
    expect(electronAPI.profile.setPreferences).toHaveBeenCalled();
    expect(safeHideModal).toHaveBeenCalled();
  });

  it('does not close or write when the secure store is unavailable', async () => {
    const controller = initializeSettingsController({ electronAPI: { analytics: { trackEvent: vi.fn() } } });
    await controller.savePreferences({ preventDefault: vi.fn() });
    expect(safeHideModal).not.toHaveBeenCalled();
  });

  it('returns null for wrapped store failures and exceptions', async () => {
    const electronAPI = createAPI();
    electronAPI.store.get.mockResolvedValueOnce({ success: false, error: 'missing' });
    const controller = initializeSettingsController({ electronAPI });
    await expect(controller.getPreference('x')).resolves.toBeNull();
    electronAPI.store.get.mockRejectedValueOnce(new Error('offline'));
    await expect(controller.getPreference('x')).resolves.toBeNull();
  });
});
