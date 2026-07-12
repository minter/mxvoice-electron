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
  if (testMode) windowOptions.show = false;

  const window = new BrowserWindow(windowOptions);
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
