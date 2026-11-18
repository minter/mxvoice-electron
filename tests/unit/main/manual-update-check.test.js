import { describe, expect, it, vi } from 'vitest';
import { runManualUpdateCheck } from '../../../src/main/modules/manual-update-check.js';

function setup({ updateState = {}, checkResult = { isUpdateAvailable: false, updateInfo: { version: '4.4.0' } }, ...overrides } = {}) {
  const autoUpdater = {
    checkForUpdates: vi.fn(async () => {
      if (checkResult instanceof Error) throw checkResult;
      return checkResult;
    }),
  };
  const deps = {
    autoUpdater,
    updateState: { downloaded: false, ...updateState },
    isPackaged: true,
    appName: 'Mx. Voice',
    currentVersion: '4.4.0',
    hasWindow: () => true,
    showMessage: vi.fn(async () => ({ response: 1 })),
    installUpdate: vi.fn(async () => {}),
    ...overrides,
  };
  return { autoUpdater, deps };
}

describe('runManualUpdateCheck', () => {
  it('says the user is up to date when no newer version is offered', async () => {
    const { deps } = setup();

    await expect(runManualUpdateCheck(deps)).resolves.toBe('up-to-date');

    expect(deps.showMessage).toHaveBeenCalledOnce();
    expect(deps.showMessage.mock.calls[0][0]).toMatchObject({
      type: 'info',
      message: "You're up to date",
      detail: 'Mx. Voice 4.4.0 is the newest version available.',
    });
  });

  it('leaves a found update to the release-notes modal, as a user-initiated check', async () => {
    const { autoUpdater, deps } = setup({
      updateState: { backgroundCheck: true },
      checkResult: { isUpdateAvailable: true, updateInfo: { version: '4.4.1' } },
    });
    let backgroundDuringCheck;
    autoUpdater.checkForUpdates.mockImplementation(async () => {
      backgroundDuringCheck = deps.updateState.backgroundCheck;
      return { isUpdateAvailable: true, updateInfo: { version: '4.4.1' } };
    });

    await expect(runManualUpdateCheck(deps)).resolves.toBe('available');

    // electron-updater merges this check into a background one in flight;
    // the update-available handler must still open the modal
    expect(backgroundDuringCheck).toBe(false);
    expect(deps.showMessage).not.toHaveBeenCalled();
  });

  it('names the update when there is no window to show the release notes in (macOS)', async () => {
    const { deps } = setup({
      checkResult: { isUpdateAvailable: true, updateInfo: { version: '4.4.1' } },
      hasWindow: () => false,
    });

    await expect(runManualUpdateCheck(deps)).resolves.toBe('available');

    expect(deps.showMessage.mock.calls[0][0]).toMatchObject({
      type: 'info',
      message: 'Mx. Voice 4.4.1 is available',
      detail: 'Open the Mx. Voice window to see what\'s new and install it.',
    });
  });

  it('says the check failed when the updater cannot reach the server', async () => {
    const { deps } = setup({ checkResult: new Error('net::ERR_INTERNET_DISCONNECTED') });

    await expect(runManualUpdateCheck(deps)).resolves.toBe('failed');

    expect(deps.showMessage.mock.calls[0][0]).toMatchObject({
      type: 'warning',
      message: "Couldn't check for updates",
      detail: 'Check your internet connection and try again.',
    });
  });

  it('explains that a build which is not installed cannot update itself', async () => {
    const { autoUpdater, deps } = setup({ isPackaged: false });

    await expect(runManualUpdateCheck(deps)).resolves.toBe('unavailable');

    expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled();
    expect(deps.showMessage.mock.calls[0][0]).toMatchObject({
      type: 'info',
      message: "Can't check for updates",
      detail: "This copy of Mx. Voice isn't an installed release, so it can't update itself.",
    });
  });

  it('treats a missing updater like a build that cannot update', async () => {
    const { deps } = setup({ autoUpdater: null });

    await expect(runManualUpdateCheck(deps)).resolves.toBe('unavailable');
    expect(deps.showMessage).toHaveBeenCalledOnce();
  });

  it('treats a skipped check (the updater returns null) like a build that cannot update', async () => {
    const { deps } = setup({ checkResult: null });

    await expect(runManualUpdateCheck(deps)).resolves.toBe('unavailable');
    expect(deps.showMessage.mock.calls[0][0].message).toBe("Can't check for updates");
  });

  it('does not check again while an update is downloading', async () => {
    const { autoUpdater, deps } = setup({ updateState: { downloading: true, downloadStartedAt: 1000 }, now: () => 2000 });

    await expect(runManualUpdateCheck(deps)).resolves.toBe('downloading');

    expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled();
    expect(deps.showMessage.mock.calls[0][0]).toMatchObject({
      message: 'An update is already downloading',
      detail: 'Mx. Voice will restart to install it when the download finishes.',
    });
  });

  it('checks again once a download has hung for 30 minutes', async () => {
    const { autoUpdater, deps } = setup({ updateState: { downloading: true, downloadStartedAt: 0 }, now: () => 30 * 60 * 1000 });

    await expect(runManualUpdateCheck(deps)).resolves.toBe('up-to-date');
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledOnce();
  });

  it('offers to install an update that is already downloaded, defaulting to Later', async () => {
    const { autoUpdater, deps } = setup({ updateState: { downloaded: true, downloadedVersion: '4.4.1' } });

    await expect(runManualUpdateCheck(deps)).resolves.toBe('downloaded');

    expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled();
    expect(deps.showMessage.mock.calls[0][0]).toMatchObject({
      message: 'Mx. Voice 4.4.1 is ready to install',
      detail: 'Mx. Voice will restart to install it.',
      buttons: ['Restart and Install', 'Later'],
      // Restarting mid-show is the costly mistake, so Return keeps the app open
      defaultId: 1,
      cancelId: 1,
    });
    expect(deps.installUpdate).not.toHaveBeenCalled();
  });

  it('installs the downloaded update when the user chooses Restart and Install', async () => {
    const { deps } = setup({
      updateState: { downloaded: true, downloadedVersion: '4.4.1' },
      showMessage: vi.fn(async () => ({ response: 0 })),
    });

    await runManualUpdateCheck(deps);

    expect(deps.installUpdate).toHaveBeenCalledOnce();
  });

  it('ignores a second click while a check is still running', async () => {
    let finishCheck;
    const { autoUpdater, deps } = setup();
    autoUpdater.checkForUpdates.mockImplementation(() => new Promise((resolve) => {
      finishCheck = () => resolve({ isUpdateAvailable: false, updateInfo: { version: '4.4.0' } });
    }));

    const first = runManualUpdateCheck(deps);
    await expect(runManualUpdateCheck(deps)).resolves.toBe('busy');
    finishCheck();
    await expect(first).resolves.toBe('up-to-date');

    expect(autoUpdater.checkForUpdates).toHaveBeenCalledOnce();
    expect(deps.showMessage).toHaveBeenCalledOnce();
    expect(deps.updateState.manualCheck).toBe(false);
  });

  it('clears the in-progress flag when the check fails', async () => {
    const { deps } = setup({ checkResult: new Error('offline') });

    await runManualUpdateCheck(deps);

    expect(deps.updateState.manualCheck).toBe(false);
  });
});
