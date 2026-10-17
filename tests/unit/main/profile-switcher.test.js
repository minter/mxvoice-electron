import { describe, expect, it, vi } from 'vitest';
import { createProfileSwitcher, applyWindowState } from '../../../src/main/modules/profile-switcher.js';

function setup({ current = 'Default User', existing = ['Default User', 'Saturday Show'], preferences = {}, windowState = null } = {}) {
  const calls = [];
  let profile = current;
  const profiles = new Set(existing);
  const win = {
    isDestroyed: () => false,
    webContents: {
      executeJavaScript: vi.fn(async (code) => { calls.push(`js:${code}`); }),
      reload: vi.fn(() => calls.push(`reload:${profile}`)),
    },
  };
  const store = { set: vi.fn((key, value) => calls.push(`store:${key}=${value}`)) };
  const analytics = { trackEvent: vi.fn((name, props) => calls.push(`track:${name}:${props.method}`)) };
  let switcher;
  const deps = {
    getMainWindow: () => win,
    getCurrentProfile: () => profile,
    setCurrentProfile: (name) => { profile = name; calls.push(`current=${name}`); },
    prepareForSwitch: vi.fn(async () => { calls.push(`flush:${profile}:fenced=${switcher.isSavingFenced()}`); }),
    profileManager: {
      profileExists: (name) => profiles.has(name),
      updateProfileLastUsed: vi.fn((name) => calls.push(`lastUsed:${name}`)),
      loadProfilePreferences: vi.fn(async () => preferences),
    },
    autoBackupTimer: {
      stopAutoBackupTimer: vi.fn(() => calls.push('backup:stop')),
      startAutoBackupTimer: vi.fn(async (name) => { calls.push(`backup:start:${name}`); }),
    },
    store,
    rebuildMenu: vi.fn(() => calls.push(`menu:${profile}`)),
    loadWindowState: vi.fn(async (name) => { calls.push(`loadBounds:${name}`); return windowState; }),
    applyWindowState: vi.fn((_win, state) => calls.push(`applyBounds:${state ? 'state' : 'none'}`)),
    getAnalytics: () => analytics,
    debugLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
  switcher = createProfileSwitcher(deps);
  return { switcher, deps, calls, win, profiles, store, analytics, getProfile: () => profile };
}

describe('profile switcher', () => {
  it('flushes the old profile, then switches every profile-bound service, then reloads', async () => {
    const { switcher, calls } = setup({ preferences: { prerelease_updates: true }, windowState: { width: 900 } });

    await expect(switcher.switchProfile('Saturday Show')).resolves.toEqual({ success: true });

    expect(calls).toEqual([
      'flush:Default User:fenced=false',
      'js:window.isRestoringProfileState = true',
      'current=Saturday Show',
      'lastUsed:Saturday Show',
      'backup:stop',
      'backup:start:Saturday Show',
      'store:prerelease_updates=true',
      'menu:Saturday Show',
      'loadBounds:Saturday Show',
      'applyBounds:state',
      'track:profile_switched:direct',
      'reload:Saturday Show',
    ]);
  });

  it('fences implicit state saves from the flush until the reload', async () => {
    const { switcher, deps } = setup();
    const fencedAt = {};
    deps.rebuildMenu.mockImplementation(() => { fencedAt.menu = switcher.isSavingFenced(); });

    await switcher.switchProfile('Saturday Show');

    expect(fencedAt.menu).toBe(true);
    expect(switcher.isSavingFenced()).toBe(false);
  });

  it('leaves the global prerelease flag alone when the new profile has no preference', async () => {
    const { switcher, store } = setup({ preferences: {} });
    await switcher.switchProfile('Saturday Show');
    expect(store.set).not.toHaveBeenCalled();
  });

  it('does not flush into a profile that was just deleted', async () => {
    const { switcher, deps, profiles } = setup({ current: 'Gone' });
    profiles.delete('Gone');
    await switcher.switchProfile('Saturday Show');
    expect(deps.prepareForSwitch).not.toHaveBeenCalled();
  });

  it('keeps switching when a side step fails', async () => {
    const { switcher, deps, calls } = setup();
    deps.prepareForSwitch.mockRejectedValue(new Error('renderer gone'));
    deps.autoBackupTimer.startAutoBackupTimer.mockRejectedValue(new Error('disk'));

    await expect(switcher.switchProfile('Saturday Show')).resolves.toEqual({ success: true });
    expect(calls).toContain('reload:Saturday Show');
    expect(deps.debugLog.warn).toHaveBeenCalledTimes(2);
  });

  it('a page that never answers the save lock delays the switch but cannot wedge it', async () => {
    const { deps, calls } = setup();
    deps.getMainWindow().webContents.executeJavaScript.mockImplementation(() => new Promise(() => {}));
    const switcher = createProfileSwitcher({ ...deps, rendererTimeoutMs: 10 });

    await expect(switcher.switchProfile('Saturday Show')).resolves.toEqual({ success: true });
    expect(calls).toContain('reload:Saturday Show');
    expect(deps.debugLog.warn).toHaveBeenCalledWith(
      expect.stringContaining('lock-renderer-saves'),
      expect.objectContaining({ error: 'lock-renderer-saves timed out after 10ms' })
    );

    // The next switch is not refused as "already in progress"
    await expect(switcher.switchProfile('Default User')).resolves.toEqual({ success: true });
  });

  it('is a no-op for the profile already in use', async () => {
    const { switcher, win, deps } = setup();
    await expect(switcher.switchProfile('Default User')).resolves.toEqual({ success: true, unchanged: true });
    expect(win.webContents.reload).not.toHaveBeenCalled();
    expect(deps.prepareForSwitch).not.toHaveBeenCalled();
  });

  it('rejects unknown profiles, a missing window and overlapping switches', async () => {
    const { switcher, deps } = setup();
    await expect(switcher.switchProfile('Nope')).resolves.toMatchObject({ success: false });
    await expect(switcher.switchProfile('')).resolves.toMatchObject({ success: false });

    let release;
    deps.prepareForSwitch.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    const first = switcher.switchProfile('Saturday Show');
    await expect(switcher.switchProfile('Saturday Show')).resolves.toMatchObject({
      success: false, error: 'A profile switch is already in progress',
    });
    release();
    await expect(first).resolves.toEqual({ success: true });

    const noWindow = setup();
    noWindow.deps.getMainWindow = () => null;
    const switcherWithoutWindow = createProfileSwitcher(noWindow.deps);
    await expect(switcherWithoutWindow.switchProfile('Saturday Show')).resolves.toMatchObject({ success: false });
  });
});

describe('applyWindowState', () => {
  function makeWindow({ maximized = false, fullScreen = false } = {}) {
    return {
      isDestroyed: () => false,
      isMaximized: () => maximized,
      isFullScreen: () => fullScreen,
      setFullScreen: vi.fn(),
      unmaximize: vi.fn(),
      maximize: vi.fn(),
      setBounds: vi.fn(),
    };
  }
  const screen = { getAllDisplays: () => [{ id: 7 }] };

  it('restores size, position on a known display, and maximized state', () => {
    const win = makeWindow({ fullScreen: true, maximized: true });
    applyWindowState(win, { x: 5, y: 6, width: 900, height: 700, displayId: 7, isMaximized: true }, screen);
    expect(win.setFullScreen).toHaveBeenCalledWith(false);
    expect(win.unmaximize).toHaveBeenCalled();
    expect(win.setBounds).toHaveBeenCalledWith({ x: 5, y: 6, width: 900, height: 700 });
    expect(win.maximize).toHaveBeenCalled();
  });

  it('keeps the position when the saved display is gone, and restores full screen', () => {
    const win = makeWindow();
    applyWindowState(win, { x: 5, y: 6, width: 900, height: 700, displayId: 99, isFullScreen: true }, screen);
    expect(win.setBounds).toHaveBeenCalledWith({ width: 900, height: 700 });
    expect(win.setFullScreen).toHaveBeenCalledWith(true);
  });

  it('ignores a missing state or window', () => {
    const win = makeWindow();
    applyWindowState(win, null, screen);
    applyWindowState(null, { width: 1 }, screen);
    applyWindowState(win, {}, screen);
    expect(win.setBounds).not.toHaveBeenCalled();
  });
});
