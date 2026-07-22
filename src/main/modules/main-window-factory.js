function createMainWindow({
  BrowserWindow,
  screen,
  autoUpdater,
  iconPath,
  preloadPath,
  indexPath,
  testMode = false,
  state = {}
}) {
  const {
    width = 1200,
    height = 800,
    x,
    y,
    isMaximized,
    isFullScreen,
    displayId
  } = state;

  const validDisplay = displayId
    ? screen.getAllDisplays().find((display) => display.id === displayId)
    : null;
  const windowOptions = {
    width,
    height,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: preloadPath,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      webgl: false,
      plugins: false
    }
  };

  if (validDisplay && x !== undefined && y !== undefined) {
    windowOptions.x = x;
    windowOptions.y = y;
  }
  if (testMode) {
    windowOptions.show = false;
    // Renderer timers and rAF must keep running even though the window is
    // never focused (and may be offscreen) during E2E runs.
    windowOptions.webPreferences.backgroundThrottling = false;
  }
  const window = new BrowserWindow(windowOptions);
  if (testMode && process.env.E2E_BACKGROUND === '1') {
    // Background mode: keep the window hidden for the whole run. Parking it
    // offscreen doesn't work — macOS constrains a window back onto a visible
    // screen when show() orders it front. With backgroundThrottling disabled
    // the hidden renderer still lays out and reports visibilityState
    // 'visible', and Playwright input goes over CDP, so tests don't need a
    // real onscreen window. Specs call win.show()/focus() directly, so
    // neutralize them here rather than in each spec.
    window.show = () => {};
    window.showInactive = () => {};
    window.focus = () => {};
  }
  window.loadFile(indexPath);
  window.once('ready-to-show', () => {
    autoUpdater?.checkForUpdatesAndNotify();
    if (isMaximized && !window.isDestroyed()) window.maximize();
    if (isFullScreen && !window.isDestroyed()) window.setFullScreen(true);
  });
  return window;
}

export { createMainWindow };
export default createMainWindow;
