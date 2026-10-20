import { beforeEach, describe, expect, it, vi } from 'vitest';

const handlers = {};
const ipcMain = { handle: (channel, handler) => { handlers[channel] = handler; } };
const profileManager = vi.hoisted(() => ({
  getAvailableProfiles: vi.fn(() => [{ name: 'Default User' }]),
  deleteProfile: vi.fn(() => ({ success: true })),
  getDeleteProfileBlocker: vi.fn(() => null),
}));

vi.mock('electron', () => ({ default: { ipcMain }, ipcMain }));
vi.mock('../../../src/main/modules/profile-manager.js', () => profileManager);

const { register } = await import('../../../src/main/modules/ipc/profile-handlers.js');
const { trackProfileSwitch } = await import('../../../src/main/modules/profile-switch-analytics.js');

function setup() {
  const profileSwitcher = {
    switchProfile: vi.fn(async () => ({ success: true })),
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

  it('registers no state.json channels: live edits go to the board session', () => {
    setup();
    expect(handlers['profile:load-state']).toBeUndefined();
    expect(handlers['profile:save-state']).toBeUndefined();
    expect(handlers['profile:save-state-before-switch']).toBeUndefined();
  });
});

describe('profile delete handler', () => {
  beforeEach(() => vi.clearAllMocks());

  function setupDelete({ current = 'Saturday Show' } = {}) {
    const calls = [];
    const boardSession = { end: vi.fn(async (reason) => { calls.push(`end:${reason}`); }) };
    const recoveryStore = { retire: vi.fn(async (name) => { calls.push(`retire:${name}`); }) };
    const debugLog = { info: vi.fn(), error: vi.fn(), warn: vi.fn() };
    profileManager.deleteProfile.mockImplementation((name) => { calls.push(`delete:${name}`); return { success: true }; });
    register({
      getCurrentProfile: () => current,
      getProfileDirectory: vi.fn(),
      store: { set: vi.fn(), get: vi.fn() },
      debugLog,
      profileSwitcher: { switchProfile: vi.fn() },
      boardSession,
      recoveryStore,
    });
    return { calls, boardSession, recoveryStore, debugLog };
  }

  it('deleteProfile removes its recovery record', async () => {
    const { calls, boardSession } = setupDelete({ current: 'Default User' });
    await expect(handlers['profile:delete']({}, 'Old Show')).resolves.toEqual({ success: true });
    expect(calls).toEqual(['delete:Old Show', 'retire:Old Show']);
    expect(boardSession.end).not.toHaveBeenCalled();
  });

  it('deleting the current profile ends its session before deleting', async () => {
    const { calls } = setupDelete({ current: 'Saturday Show' });
    await handlers['profile:delete']({}, 'Saturday Show');
    expect(calls).toEqual(['end:profile-deleted', 'delete:Saturday Show', 'retire:Saturday Show']);
  });

  it('a delete that will be refused leaves the session and record alone', async () => {
    const { boardSession, recoveryStore } = setupDelete({ current: 'Default User' });
    profileManager.getDeleteProfileBlocker.mockReturnValue('Cannot delete Default User profile');
    profileManager.deleteProfile.mockReturnValue({ success: false, error: 'Cannot delete Default User profile' });
    await expect(handlers['profile:delete']({}, 'Default User')).resolves.toMatchObject({ success: false });
    expect(boardSession.end).not.toHaveBeenCalled();
    expect(recoveryStore.retire).not.toHaveBeenCalled();
  });

  it('a failed recovery retire is logged, not fatal', async () => {
    const { recoveryStore, debugLog } = setupDelete({ current: 'Default User' });
    recoveryStore.retire.mockRejectedValue(new Error('locked'));
    await expect(handlers['profile:delete']({}, 'Old Show')).resolves.toEqual({ success: true });
    expect(debugLog.warn).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ error: 'locked' }));
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
