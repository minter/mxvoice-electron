import { beforeEach, describe, expect, it, vi } from 'vitest';

const handlers = {};
const app = { relaunch: vi.fn(), exit: vi.fn() };
const ipcMain = { handle: (channel, handler) => { handlers[channel] = handler; } };

vi.mock('electron', () => ({ default: { ipcMain, app }, ipcMain, app }));
vi.mock('../../../src/main/modules/profile-manager.js', () => ({}));

const { register } = await import('../../../src/main/modules/ipc/profile-handlers.js');
const { trackProfileSwitch } = await import('../../../src/main/modules/profile-switch-analytics.js');

function setup() {
  const calls = [];
  const win = { close: vi.fn(() => calls.push('close')) };
  const analytics = {
    trackEvent: vi.fn((name) => calls.push(`track:${name}`)),
    endSession: vi.fn(async () => { calls.push('endSession'); }),
  };
  app.relaunch.mockImplementation(() => calls.push('relaunch'));
  app.exit.mockImplementation(() => calls.push('exit'));
  register({
    getCurrentProfile: () => 'Default User',
    getProfileDirectory: vi.fn(),
    store: { set: vi.fn(), get: vi.fn() },
    debugLog: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
    getMainWindow: () => win,
    analytics,
  });
  return { calls, analytics };
}

describe('profile switch handlers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('flushes analytics before closing the window, then relaunches (switch via launcher)', async () => {
    const { calls } = setup();

    await handlers['profile:switch']({});

    expect(calls).toEqual(['endSession', 'close', 'relaunch', 'exit']);
  });

  it('records the switch, flushes, then closes and relaunches (switch to a named profile)', async () => {
    const { calls, analytics } = setup();

    await handlers['profile:switch-to']({}, 'Saturday Show');

    expect(analytics.trackEvent).toHaveBeenCalledWith('profile_switched', { method: 'direct' });
    expect(calls).toEqual(['track:profile_switched', 'endSession', 'close', 'relaunch', 'exit']);
  });

  it('does not record a switch to the profile already in use', async () => {
    const { analytics } = setup();

    await handlers['profile:switch-to']({}, 'Default User');

    expect(analytics.trackEvent).not.toHaveBeenCalled();
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
