function createAppLifecycle({
  app,
  BrowserWindow,
  prepareWindowForClose,
  createWindow,
  onClosed,
  autoBackupTimer,
  analytics,
  debugLog,
  platform = process.platform,
  environment = process.env
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
    app.on('closed', onClosed);
    app.on('before-quit', beforeQuit);
    app.on('window-all-closed', () => {
      const inTestMode = environment.APP_TEST_MODE === '1' || !!environment.E2E_USER_DATA_DIR;
      if (platform !== 'darwin' || inTestMode) app.quit();
    });
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });

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
