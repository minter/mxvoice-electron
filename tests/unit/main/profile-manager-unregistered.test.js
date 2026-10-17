import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const userDataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mxvoice-profile-unregistered-'));

vi.mock('electron', () => ({
  default: { app: { getPath: () => userDataDirectory } }
}));

const profiles = await import('../../../src/main/modules/profile-manager.js');
const profileDirectory = (name) => path.join(userDataDirectory, 'profiles', name);
const state = { hotkeys: [{ tabNumber: 1, hotkeys: { f1: '1' } }], holdingTank: [] };

beforeAll(() => {
  profiles.initializeProfileManager({
    debugLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
  });
});

afterAll(() => fs.rmSync(userDataDirectory, { recursive: true, force: true }));

// After Delete Current Profile the running window still names the deleted
// profile until another one opens; nothing it reads or writes may revive it
describe('unregistered profiles are never recreated on disk', () => {
  beforeEach(() => {
    fs.rmSync(path.join(userDataDirectory, 'profiles'), { recursive: true, force: true });
    fs.rmSync(path.join(userDataDirectory, 'profiles.json'), { force: true });
  });

  it('a just-deleted profile stays deleted when its preferences and state are read or written', async () => {
    expect(profiles.createProfile('Tonight', '')).toEqual({ success: true });
    expect(fs.existsSync(profileDirectory('Tonight'))).toBe(true);
    expect(profiles.deleteProfile('Tonight')).toEqual({ success: true });

    await expect(profiles.loadProfilePreferences('Tonight')).resolves.toMatchObject({ screen_mode: 'auto' });
    await expect(profiles.saveProfilePreferences('Tonight', { font_size: 12 })).resolves.toBe(false);
    await expect(profiles.saveProfileState('Tonight', state)).resolves.toMatchObject({ success: false, skipped: true });

    expect(fs.existsSync(profileDirectory('Tonight'))).toBe(false);
    expect(profiles.profileExists('Tonight')).toBe(false);
  });

  it('a name that was never registered is not created either', async () => {
    await profiles.loadProfilePreferences('Nobody');
    await profiles.saveProfilePreferences('Nobody', {});
    await profiles.saveProfileState('Nobody', state);
    expect(fs.existsSync(profileDirectory('Nobody'))).toBe(false);
  });

  it('a registered profile without preferences yet still gets them created', async () => {
    // Default User is registered by the default registry but has no directory
    expect(profiles.profileExists('Default User')).toBe(true);
    expect(fs.existsSync(profileDirectory('Default User'))).toBe(false);

    const preferences = await profiles.loadProfilePreferences('Default User');

    expect(preferences).toMatchObject({ screen_mode: 'auto' });
    expect(fs.existsSync(path.join(profileDirectory('Default User'), 'preferences.json'))).toBe(true);
    await expect(profiles.saveProfileState('Default User', state)).resolves.toEqual({ success: true });
  });

  it('re-registers a profile whose directory survived a lost registry', async () => {
    expect(profiles.createProfile('Survivor', '')).toEqual({ success: true });
    // profiles.json lost: only the default registry is left
    fs.rmSync(path.join(userDataDirectory, 'profiles.json'), { force: true });
    expect(profiles.profileExists('Survivor')).toBe(false);

    expect(profiles.adoptProfileDirectory('Survivor')).toBe(true);
    expect(profiles.profileExists('Survivor')).toBe(true);
    await expect(profiles.saveProfileState('Survivor', state)).resolves.toEqual({ success: true });
  });

  it('does not adopt a name without a directory, or one that collides with a registered profile', () => {
    expect(profiles.adoptProfileDirectory('Never Made')).toBe(false);
    expect(fs.existsSync(profileDirectory('Never Made'))).toBe(false);

    expect(profiles.createProfile('Show', '')).toEqual({ success: true });
    // "Show!" sanitizes to the same directory as "Show"
    expect(profiles.adoptProfileDirectory('Show!')).toBe(false);
    expect(profiles.profileExists('Show!')).toBe(false);
  });
});
