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

  it('a just-deleted profile stays deleted when its preferences are read or written', async () => {
    expect(profiles.createProfile('Tonight', '')).toEqual({ success: true });
    expect(fs.existsSync(profileDirectory('Tonight'))).toBe(true);
    expect(profiles.deleteProfile('Tonight')).toEqual({ success: true });

    await expect(profiles.loadProfilePreferences('Tonight')).resolves.toMatchObject({ screen_mode: 'auto' });
    await expect(profiles.saveProfilePreferences('Tonight', { font_size: 12 })).resolves.toBe(false);

    expect(fs.existsSync(profileDirectory('Tonight'))).toBe(false);
    expect(profiles.profileExists('Tonight')).toBe(false);
  });

  it('names why a delete would be refused, and deleteProfile refuses the same', () => {
    expect(profiles.createProfile('Tonight', '')).toEqual({ success: true });
    expect(profiles.getDeleteProfileBlocker('Default User')).toBe('Cannot delete Default User profile');
    expect(profiles.getDeleteProfileBlocker('Nobody')).toBe('Profile does not exist');
    expect(profiles.getDeleteProfileBlocker('Tonight')).toBeNull();
    expect(profiles.deleteProfile('Nobody')).toEqual({ success: false, error: 'Profile does not exist' });
  });

  it('a name that was never registered is not created either', async () => {
    await profiles.loadProfilePreferences('Nobody');
    await profiles.saveProfilePreferences('Nobody', {});
    expect(fs.existsSync(profileDirectory('Nobody'))).toBe(false);
  });

  it('a registered profile without preferences yet still gets them created', async () => {
    // Default User is registered by the default registry but has no directory
    expect(profiles.profileExists('Default User')).toBe(true);
    expect(fs.existsSync(profileDirectory('Default User'))).toBe(false);

    const preferences = await profiles.loadProfilePreferences('Default User');

    expect(preferences).toMatchObject({ screen_mode: 'auto' });
    expect(fs.existsSync(path.join(profileDirectory('Default User'), 'preferences.json'))).toBe(true);
    await expect(profiles.saveProfilePreferences('Default User', { font_size: 12 })).resolves.toBe(true);
  });

  it('re-registers a profile whose directory survived a lost registry', async () => {
    expect(profiles.createProfile('Survivor', '')).toEqual({ success: true });
    // profiles.json lost: only the default registry is left
    fs.rmSync(path.join(userDataDirectory, 'profiles.json'), { force: true });
    expect(profiles.profileExists('Survivor')).toBe(false);

    expect(profiles.adoptProfileDirectory('Survivor')).toBe(true);
    expect(profiles.profileExists('Survivor')).toBe(true);
    await expect(profiles.saveProfilePreferences('Survivor', { font_size: 12 })).resolves.toBe(true);
  });

  it('never replaces an unreadable registry when adopting a directory', () => {
    expect(profiles.createProfile('Survivor', '')).toEqual({ success: true });
    expect(profiles.createProfile('Other', '')).toEqual({ success: true });
    const registryPath = path.join(userDataDirectory, 'profiles.json');
    expect(profiles.isProfileRegistryReadable()).toBe(true);
    fs.writeFileSync(registryPath, '{ "profiles": { "Survivor"');
    expect(profiles.isProfileRegistryReadable()).toBe(false);

    expect(profiles.adoptProfileDirectory('Survivor')).toBe(false);
    // Still the damaged file, which can be repaired by hand
    expect(fs.readFileSync(registryPath, 'utf8')).toBe('{ "profiles": { "Survivor"');
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
