import { beforeEach, describe, expect, it, vi } from 'vitest';

const handlers = {};
const app = {
  getPath: vi.fn(() => '/tmp/app'),
  getVersion: vi.fn(() => '4.3.1'),
  getName: vi.fn(() => 'Mx. Voice'),
  quit: vi.fn(), relaunch: vi.fn(), exit: vi.fn()
};
const ipcMain = { handle: (channel, handler) => { handlers[channel] = handler; } };

vi.mock('electron', () => ({ default: { ipcMain, app }, ipcMain, app }));

const { register } = await import('../../../src/main/modules/ipc/app-update-handlers.js');

function setup(autoUpdater = null) {
  const updateState = { downloaded: true, userApprovedInstall: true };
  const analytics = { trackEvent: vi.fn() };
  const debugLog = { info: vi.fn(), error: vi.fn() };
  register({ autoUpdater, updateState, analytics, debugLog });
  return { updateState, analytics, debugLog };
}

function invoke(channel, ...args) {
  return handlers[channel]({}, ...args);
}

describe('app update IPC handlers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('checks for updates and resets download approval state', async () => {
    const updateInfo = { version: '4.4.0' };
    const autoUpdater = { checkForUpdates: vi.fn().mockResolvedValue({ updateInfo }) };
    const { updateState } = setup(autoUpdater);

    await expect(invoke('check-for-update')).resolves.toEqual({
      success: true, updateAvailable: true, updateInfo
    });
    expect(updateState).toMatchObject({ downloaded: false, userApprovedInstall: false });
  });

  it('returns a wrapped error when the updater is unavailable', async () => {
    setup();
    await expect(invoke('check-for-update')).resolves.toEqual({
      success: false, error: 'Auto updater not available'
    });
  });

  it('downloads an update and records acceptance', async () => {
    const autoUpdater = { downloadUpdate: vi.fn().mockResolvedValue([]) };
    const { analytics } = setup(autoUpdater);
    await expect(invoke('download-update')).resolves.toEqual({
      success: true, message: 'Download started'
    });
    expect(analytics.trackEvent).toHaveBeenCalledWith('auto_update_action', { action: 'accepted' });
  });

  it('refuses installation until the download-complete state is set', async () => {
    const autoUpdater = { quitAndInstall: vi.fn() };
    const { updateState } = setup(autoUpdater);
    updateState.downloaded = false;
    await expect(invoke('install-update')).resolves.toEqual({
      success: false, error: 'No update has been downloaded yet'
    });
    expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled();
  });

  it('schedules installation after a completed download', async () => {
    vi.useFakeTimers();
    const autoUpdater = { quitAndInstall: vi.fn() };
    setup(autoUpdater);
    await expect(invoke('install-update')).resolves.toMatchObject({ success: true });
    await vi.runAllTimersAsync();
    expect(autoUpdater.quitAndInstall).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
