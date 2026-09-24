import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const handlers = {};
const app = {
  getPath: vi.fn(() => '/tmp/app'),
  getVersion: vi.fn(() => '4.3.1'),
  getName: vi.fn(() => 'Mx. Voice'),
  quit: vi.fn(), relaunch: vi.fn(), exit: vi.fn()
};
const ipcMain = { handle: (channel, handler) => { handlers[channel] = handler; } };

vi.mock('electron', () => ({ default: { ipcMain, app }, ipcMain, app }));

const { runBackgroundCheck } = await import('../../../src/main/modules/update-scheduler.js');
const { describeUpdateError } = await import('../../../src/main/modules/update-analytics.js');

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
  afterEach(() => vi.useRealTimers());

  it('checks for updates and resets download approval state', async () => {
    const updateInfo = { version: '4.4.0' };
    const autoUpdater = { checkForUpdates: vi.fn().mockResolvedValue({ updateInfo }) };
    const { updateState } = setup(autoUpdater);

    await expect(invoke('check-for-update')).resolves.toEqual({
      success: true, updateAvailable: true, updateInfo
    });
    expect(updateState).toMatchObject({ downloaded: false, userApprovedInstall: false });
  });

  it('treats a manual check as user-initiated even while a background check is running', async () => {
    let backgroundDuringManualCheck;
    const autoUpdater = { checkForUpdates: vi.fn(async () => { backgroundDuringManualCheck = updateState.backgroundCheck; return {}; }) };
    const { updateState } = setup(autoUpdater);
    updateState.backgroundCheck = true;

    await invoke('check-for-update');

    // electron-updater merges concurrent checks, so the shared result must open the modal
    expect(backgroundDuringManualCheck).toBe(false);
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

  it('marks a download in progress so background checks skip it, then clears the mark', async () => {
    let downloadingDuringDownload;
    const autoUpdater = { downloadUpdate: vi.fn(async () => { downloadingDuringDownload = updateState.downloading; return []; }) };
    const { updateState } = setup(autoUpdater);

    await invoke('download-update');

    expect(downloadingDuringDownload).toBe(true);
    expect(updateState.downloading).toBe(false);
  });

  it('clears the in-progress mark when a download fails', async () => {
    const autoUpdater = { downloadUpdate: vi.fn().mockRejectedValue(new Error('network')) };
    const { updateState } = setup(autoUpdater);

    await expect(invoke('download-update')).resolves.toMatchObject({ success: false });
    expect(updateState.downloading).toBe(false);
  });

  it.each(['resolve', 'reject'])('keeps timed-out downloads guarded until they %s', async (outcome) => {
    vi.useFakeTimers();
    let resolveDownload;
    let rejectDownload;
    const transfer = new Promise((resolve, reject) => {
      resolveDownload = resolve;
      rejectDownload = reject;
    });
    const autoUpdater = {
      downloadUpdate: vi.fn(() => transfer),
      checkForUpdates: vi.fn().mockResolvedValue({}),
    };
    const { updateState } = setup(autoUpdater);
    updateState.downloaded = false;
    const response = invoke('download-update');
    await vi.advanceTimersByTimeAsync(60000);
    await expect(response).resolves.toEqual({ success: false, error: 'Download timeout after 60 seconds' });
    expect(updateState.downloading).toBe(true);
    await expect(runBackgroundCheck({ autoUpdater, updateState })).resolves.toBe(false);
    expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled();

    if (outcome === 'reject') {
      const error = Object.assign(new Error('checksum mismatch'), { code: 'ERR_CHECKSUM_MISMATCH' });
      // electron-updater emits its error before rejecting the transfer promise.
      expect(describeUpdateError(error, updateState)).toEqual({ error_code: 'ERR_CHECKSUM_MISMATCH', stage: 'download' });
      rejectDownload(error);
    } else {
      resolveDownload([]);
    }
    await vi.advanceTimersByTimeAsync(0);
    expect(updateState.downloading).toBe(false);
    await expect(runBackgroundCheck({ autoUpdater, updateState })).resolves.toBe(true);
  });

  it.each(['resolve', 'reject'])('keeps a retry joined to the timed-out transfer until it %s', async (outcome) => {
    vi.useFakeTimers();
    let resolveDownload;
    let rejectDownload;
    const transfer = new Promise((resolve, reject) => {
      resolveDownload = resolve;
      rejectDownload = reject;
    });
    // electron-updater returns the same promise while its download is active.
    const autoUpdater = {
      downloadUpdate: vi.fn(() => transfer),
      checkForUpdates: vi.fn().mockResolvedValue({}),
    };
    const { updateState, analytics } = setup(autoUpdater);
    updateState.downloaded = false;
    const first = invoke('download-update');
    await vi.advanceTimersByTimeAsync(60000);
    await expect(first).resolves.toMatchObject({ success: false });

    const retry = invoke('download-update');
    await vi.advanceTimersByTimeAsync(30000);
    expect(autoUpdater.downloadUpdate).toHaveBeenCalledTimes(2);
    expect(updateState.downloading).toBe(true);
    await expect(runBackgroundCheck({ autoUpdater, updateState })).resolves.toBe(false);
    expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled();

    if (outcome === 'resolve') resolveDownload([]);
    else rejectDownload(new Error('checksum mismatch'));
    await expect(retry).resolves.toMatchObject({ success: outcome === 'resolve' });
    expect(updateState.downloading).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    expect(analytics.trackEvent).toHaveBeenCalledTimes(outcome === 'resolve' ? 1 : 0);
  });

  it('clears the guard for a synchronous download failure', async () => {
    const { updateState } = setup({ downloadUpdate: () => { throw new Error('download unavailable'); } });
    await expect(invoke('download-update')).resolves.toMatchObject({ success: false });
    expect(updateState.downloading).toBe(false);
  });

  it('cancels the IPC timeout when the download finishes promptly', async () => {
    vi.useFakeTimers();
    setup({ downloadUpdate: vi.fn().mockResolvedValue([]) });
    await invoke('download-update');
    expect(vi.getTimerCount()).toBe(0);
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
