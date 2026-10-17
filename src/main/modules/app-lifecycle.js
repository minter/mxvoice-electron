function createAppLifecycle({
  app,
  prepareWindowForClose,
  autoBackupTimer,
  analytics,
  debugLog,
  platform = process.platform
}) {
  let isQuitting = false;
  let shutdownComplete = false;

  async function beforeQuit(event) {
    if (shutdownComplete) return;
    event.preventDefault();
    if (isQuitting) return;
    isQuitting = true;

    try {
      await prepareWindowForClose();
      debugLog?.info('Window and profile state saved on app quit', {
        module: 'app-lifecycle', function: 'beforeQuit'
      });
    } catch (error) {
      debugLog?.error('Error saving state on app quit', {
        module: 'app-lifecycle', function: 'beforeQuit', error: error.message
      });
    }

    autoBackupTimer?.stopAutoBackupTimer();
    await analytics?.endSession();

    shutdownComplete = true;
    app.quit();
  }

  function setup() {
    app.on('before-quit', beforeQuit);
    // Closing the last window quits on every platform, macOS included: a show
    // tool shouldn't keep running out of sight with audio or a backup timer
    // alive. So there is no windowless state to reopen from the Dock.
    app.on('window-all-closed', () => app.quit());

    app.setAppLogsPath();
    if (platform === 'darwin') {
      app.setAboutPanelOptions({
        applicationName: app.name,
        applicationVersion: app.getVersion(),
        copyright: 'Copyright 2025',
        authors: ['Wade Minter', 'Andrew Berkowitz'],
        website: 'https://mxvoice.app/',
        credits: 'Wade Minter\nAndrew Berkowitz'
      });
    }
  }

  return { beforeQuit, isQuitting: () => isQuitting, setup };
}

export { createAppLifecycle };
export default createAppLifecycle;
