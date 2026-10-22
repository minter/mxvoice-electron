import { describe, expect, it, vi } from 'vitest';
import { migrateFadeToProfiles } from '../../../src/main/modules/fade-migration.js';
import { getDefaultPreferences } from '../../../src/main/modules/profile-manager.js';

function makeEnv({ global = {}, profiles = ['A', 'B'], failSave = [] } = {}) {
  const data = { ...global };
  const store = { has: (k) => k in data, get: (k) => data[k], set: (k, v) => { data[k] = v; } };
  const prefs = Object.fromEntries(profiles.map((p) => [p, { fade_out_seconds: 3, other: p }]));
  return {
    data, prefs,
    deps: {
      store,
      listProfiles: () => Object.keys(prefs),
      loadProfilePreferences: async (n) => (prefs[n] ? { ...prefs[n] } : null),
      saveProfilePreferences: async (n, p) => { if (failSave.includes(n)) return false; prefs[n] = p; return true; },
      debugLog: { warn: vi.fn(), error: vi.fn(), info: vi.fn() }
    }
  };
}

describe('migrateFadeToProfiles', () => {
  it('copies the global 2 into every profile and sets the flag', async () => {
    const env = makeEnv({ global: { fade_out_seconds: 2 } });
    const result = await migrateFadeToProfiles(env.deps);
    expect(result.migrated).toEqual(['A', 'B']);
    expect(env.prefs.A.fade_out_seconds).toBe(2);
    expect(env.prefs.B.fade_out_seconds).toBe(2);
    expect(env.prefs.A.other).toBe('A');
    expect(env.data.fade_out_migrated_to_profiles).toBe(true);
    expect(env.data.fade_out_seconds).toBe(2);
  });

  it('copies a customised global value', async () => {
    const env = makeEnv({ global: { fade_out_seconds: 5 } });
    await migrateFadeToProfiles(env.deps);
    expect(env.prefs.A.fade_out_seconds).toBe(5);
  });

  it('a missing global value copies 2', async () => {
    const env = makeEnv();
    await migrateFadeToProfiles(env.deps);
    expect(env.prefs.A.fade_out_seconds).toBe(2);
  });

  it('a non-positive or invalid global value copies 2', async () => {
    for (const bad of [0, -1, 'x', null, Infinity]) {
      const env = makeEnv({ global: { fade_out_seconds: bad } });
      await migrateFadeToProfiles(env.deps);
      expect(env.prefs.A.fade_out_seconds).toBe(2);
    }
  });

  it('a second run does nothing', async () => {
    const env = makeEnv({ global: { fade_out_seconds: 2 } });
    await migrateFadeToProfiles(env.deps);
    env.prefs.A.fade_out_seconds = 7;
    const result = await migrateFadeToProfiles(env.deps);
    expect(result.migrated).toEqual([]);
    expect(env.prefs.A.fade_out_seconds).toBe(7);
  });

  it('a profile whose preferences fail to save is skipped and the rest are migrated', async () => {
    const env = makeEnv({ global: { fade_out_seconds: 2 }, profiles: ['A', 'B', 'C'], failSave: ['B'] });
    const result = await migrateFadeToProfiles(env.deps);
    expect(result.migrated).toEqual(['A', 'C']);
    expect(env.prefs.B.fade_out_seconds).toBe(3);
    expect(env.data.fade_out_migrated_to_profiles).toBe(true);
    expect(env.deps.debugLog.warn).toHaveBeenCalled();
  });

  it('a profile whose preferences cannot be read is skipped', async () => {
    const env = makeEnv({ global: { fade_out_seconds: 2 } });
    env.deps.loadProfilePreferences = async (n) => (n === 'A' ? null : { fade_out_seconds: 3 });
    const result = await migrateFadeToProfiles(env.deps);
    expect(result.migrated).toEqual(['B']);
    expect(env.data.fade_out_migrated_to_profiles).toBe(true);
  });

  it('a profile created after the migration keeps the new default', async () => {
    const env = makeEnv({ global: { fade_out_seconds: 2 } });
    await migrateFadeToProfiles(env.deps);
    env.prefs.New = getDefaultPreferences();
    await migrateFadeToProfiles(env.deps);
    expect(env.prefs.New.fade_out_seconds).toBe(3);
  });

  it('resolves when the flag write throws, after migrating the profiles', async () => {
    const env = makeEnv({ global: { fade_out_seconds: 2 } });
    env.deps.store.set = () => { throw new Error('EROFS'); };
    const result = await migrateFadeToProfiles(env.deps);
    expect(result.migrated).toEqual(['A', 'B']);
    expect(env.deps.debugLog.error).toHaveBeenCalled();
  });

  it('resolves when the store cannot be read', async () => {
    const env = makeEnv();
    env.deps.store.get = () => { throw new Error('EACCES'); };
    await expect(migrateFadeToProfiles(env.deps)).resolves.toEqual({ migrated: [] });
  });

  it('resolves and still sets the flag when listProfiles throws', async () => {
    const env = makeEnv();
    env.deps.listProfiles = () => { throw new Error('registry'); };
    const set = vi.spyOn(env.deps.store, 'set');
    await expect(migrateFadeToProfiles(env.deps)).resolves.toEqual({ migrated: [] });
    expect(env.deps.debugLog.error).toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith('fade_out_migrated_to_profiles', true);
    expect(env.data.fade_out_migrated_to_profiles).toBe(true);
  });

  it('skips a profile whose preferences load rejects', async () => {
    const env = makeEnv({ global: { fade_out_seconds: 2 } });
    env.deps.loadProfilePreferences = async (n) => { if (n === 'A') throw new Error('bad json'); return { fade_out_seconds: 3 }; };
    const result = await migrateFadeToProfiles(env.deps);
    expect(result.migrated).toEqual(['B']);
  });
});
