import { describe, expect, it, vi } from 'vitest';

import {
  getPreference,
  setPreference
} from '../../../src/renderer/modules/preferences/profile-preference-adapter.js';

function createAPI() {
  return {
    store: {
      get: vi.fn().mockResolvedValue({ success: true, value: '/music' }),
      set: vi.fn().mockResolvedValue({ success: true })
    },
    profile: {
      getPreference: vi.fn().mockResolvedValue({ success: true, value: 'dark' }),
      setPreference: vi.fn().mockResolvedValue({ success: true })
    }
  };
}

describe('profile preference adapter', () => {
  it('routes global preferences through the store API', async () => {
    const api = createAPI();

    await expect(getPreference('music_directory', api)).resolves.toEqual({
      success: true,
      value: '/music'
    });
    await setPreference('music_directory', '/new-music', api);

    expect(api.store.get).toHaveBeenCalledWith('music_directory');
    expect(api.store.set).toHaveBeenCalledWith('music_directory', '/new-music');
    expect(api.profile.getPreference).not.toHaveBeenCalled();
    expect(api.profile.setPreference).not.toHaveBeenCalled();
  });

  it('routes profile preferences through the profile API', async () => {
    const api = createAPI();

    await expect(getPreference('screen_mode', api)).resolves.toEqual({
      success: true,
      value: 'dark'
    });
    await setPreference('screen_mode', 'light', api);

    expect(api.profile.getPreference).toHaveBeenCalledWith('screen_mode');
    expect(api.profile.setPreference).toHaveBeenCalledWith('screen_mode', 'light');
    expect(api.store.get).not.toHaveBeenCalled();
    expect(api.store.set).not.toHaveBeenCalled();
  });

  it('does not fall back to global storage when the profile API is missing', async () => {
    const api = createAPI();
    delete api.profile;

    await expect(getPreference('screen_mode', api)).resolves.toEqual({
      success: false,
      error: 'electronAPI.profile is undefined'
    });
    await expect(setPreference('screen_mode', 'dark', api)).resolves.toEqual({
      success: false,
      error: 'electronAPI.profile is undefined'
    });

    expect(api.store.get).not.toHaveBeenCalled();
    expect(api.store.set).not.toHaveBeenCalled();
  });

  it('rejects unknown keys instead of storing them globally', async () => {
    const api = createAPI();

    await expect(getPreference('unknown_key', api)).resolves.toEqual({
      success: false,
      error: 'Unknown preference key: unknown_key'
    });
    await expect(setPreference('unknown_key', true, api)).resolves.toEqual({
      success: false,
      error: 'Unknown preference key: unknown_key'
    });

    expect(api.store.get).not.toHaveBeenCalled();
    expect(api.store.set).not.toHaveBeenCalled();
  });
});
