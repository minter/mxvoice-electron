import { describe, expect, it, vi } from 'vitest';
import { syncPrereleasePreference } from '../../../src/main/modules/prerelease-preference.js';

function setup(preferences) {
  const store = { set: vi.fn() };
  const profileManager = { loadProfilePreferences: vi.fn(async () => preferences) };
  return { store, profileManager };
}

describe('syncPrereleasePreference', () => {
  it("copies the opening profile's preference to the global store the updater reads", async () => {
    // The 4.3.2 bug: Default User had it on, the global copy (from another profile's save) was off
    const { store, profileManager } = setup({ prerelease_updates: true, font_size: 12 });

    await expect(syncPrereleasePreference({ profileName: 'Default User', profileManager, store })).resolves.toBe(true);
    expect(profileManager.loadProfilePreferences).toHaveBeenCalledWith('Default User');
    expect(store.set).toHaveBeenCalledWith('prerelease_updates', true);
  });

  it('copies an off preference too, so a profile without prereleases never inherits them', async () => {
    const { store, profileManager } = setup({ prerelease_updates: false });
    await expect(syncPrereleasePreference({ profileName: 'Friday', profileManager, store })).resolves.toBe(false);
    expect(store.set).toHaveBeenCalledWith('prerelease_updates', false);
  });

  it('leaves the global store alone when the profile has no preference or none could be read', async () => {
    for (const preferences of [{}, null]) {
      const { store, profileManager } = setup(preferences);
      await expect(syncPrereleasePreference({ profileName: 'Old', profileManager, store })).resolves.toBeNull();
      expect(store.set).not.toHaveBeenCalled();
    }
  });
});
