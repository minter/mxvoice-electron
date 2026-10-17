import { beforeEach, describe, expect, it, vi } from 'vitest';

const handlers = {};
const ipcMain = { handle: (channel, handler) => { handlers[channel] = handler; } };
const profileManager = vi.hoisted(() => ({
  saveProfileState: vi.fn(async () => ({ success: true })),
  getAvailableProfiles: vi.fn(() => [{ name: 'Default User' }]),
}));

vi.mock('electron', () => ({ default: { ipcMain }, ipcMain }));
vi.mock('../../../src/main/modules/profile-manager.js', () => profileManager);

const { register } = await import('../../../src/main/modules/ipc/profile-handlers.js');
const { trackProfileSwitch } = await import('../../../src/main/modules/profile-switch-analytics.js');

function setup({ fenced = false } = {}) {
  const profileSwitcher = {
    switchProfile: vi.fn(async () => ({ success: true })),
    isSavingFenced: () => fenced,
  };
  register({
    getCurrentProfile: () => 'Default User',
    getProfileDirectory: vi.fn(),
    store: { set: vi.fn(), get: vi.fn() },
    debugLog: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
    profileSwitcher,
  });
  return { profileSwitcher };
}

describe('profile switch handlers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists profiles for the Switch Profile dialog', async () => {
    setup();
    await expect(handlers['profile:list']({})).resolves.toEqual({ success: true, profiles: [{ name: 'Default User' }] });
    profileManager.getAvailableProfiles.mockImplementationOnce(() => { throw new Error('registry'); });
    await expect(handlers['profile:list']({})).resolves.toEqual({ success: false, error: 'registry' });
  });

  it('switch-to switches in-process, as a direct switch unless the picker chose it', async () => {
    const { profileSwitcher } = setup();
    await handlers['profile:switch-to']({}, 'Saturday Show');
    expect(profileSwitcher.switchProfile).toHaveBeenLastCalledWith('Saturday Show', { method: 'direct' });
    await handlers['profile:switch-to']({}, 'Saturday Show', 'launcher');
    expect(profileSwitcher.switchProfile).toHaveBeenLastCalledWith('Saturday Show', { method: 'launcher' });
    await handlers['profile:switch-to']({}, 'Saturday Show', 'bogus');
    expect(profileSwitcher.switchProfile).toHaveBeenLastCalledWith('Saturday Show', { method: 'direct' });
  });

  it('reports switcher failures', async () => {
    const { profileSwitcher } = setup();
    profileSwitcher.switchProfile.mockRejectedValue(new Error('busy'));
    await expect(handlers['profile:switch-to']({}, 'X')).resolves.toEqual({ success: false, error: 'busy' });
  });

  it('refuses implicit state saves while a switch is fencing them', async () => {
    setup({ fenced: true });
    await expect(handlers['profile:save-state']({}, { hotkeys: [] })).resolves.toMatchObject({ success: false, skipped: true });
    expect(profileManager.saveProfileState).not.toHaveBeenCalled();

    await handlers['profile:save-state']({}, { hotkeys: [] }, 'Default User');
    expect(profileManager.saveProfileState).toHaveBeenCalledWith('Default User', { hotkeys: [] }, { reason: 'window-close' });
  });

  it('saves to the current profile when no switch is running', async () => {
    setup();
    await handlers['profile:save-state']({}, { hotkeys: [] });
    expect(profileManager.saveProfileState).toHaveBeenCalledWith('Default User', { hotkeys: [] }, { reason: 'window-close' });
  });
});

describe('trackProfileSwitch', () => {
  it('records a change of profile with its method', () => {
    const analytics = { trackEvent: vi.fn() };
    trackProfileSwitch({ analytics, fromProfile: 'A', toProfile: 'B', method: 'launcher' });
    expect(analytics.trackEvent).toHaveBeenCalledWith('profile_switched', { method: 'launcher' });
  });

  it.each([
    ['the same profile is chosen again', 'A', 'A'],
    ['there was no previous profile (fresh launch)', undefined, 'B'],
  ])('ignores %s', (_label, fromProfile, toProfile) => {
    const analytics = { trackEvent: vi.fn() };
    trackProfileSwitch({ analytics, fromProfile, toProfile, method: 'launcher' });
    expect(analytics.trackEvent).not.toHaveBeenCalled();
  });

  it('is a no-op without analytics', () => {
    expect(() => trackProfileSwitch({ analytics: null, fromProfile: 'A', toProfile: 'B', method: 'launcher' })).not.toThrow();
  });
});
