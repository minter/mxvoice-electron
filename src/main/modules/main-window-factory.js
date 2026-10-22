function createMainWindow({
  BrowserWindow,
  screen,
  autoUpdater,
  iconPath,
  preloadPath,
  indexPath,
  testMode = false,
  state = {},
  platform = process.platform
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

  // macOS: draw the window to the top edge, with the traffic lights inset over
  // the app's own title strip (index.css body.platform-mac). Windows and Linux
  // keep the native title bar, and with it the menu bar.
  if (platform === 'darwin') {
    windowOptions.titleBarStyle = 'hiddenInset';
  }

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
  if (platform === 'darwin') hideTitleStripInFullScreen(window);
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
  if (testMode) {
    // Zero out Bootstrap's fade/collapse transitions during E2E runs.
    // Bootstrap ignores Modal.hide() while a fade-in transition is still
    // running, so a close click issued right after the modal becomes visible
    // can be silently swallowed — a race that CI runner timing changes keep
    // re-exposing. Scoped to Bootstrap classes only: the app's animateCSS
    // helper depends on real animationend events from animate.css.
    window.webContents.on('did-finish-load', () => {
      window.webContents.insertCSS(
        '.fade, .collapsing, .modal.fade .modal-dialog {' +
          'transition-duration: 0s !important;' +
          'transition-delay: 0s !important;' +
        '}'
      );
    });
  }
  window.loadFile(indexPath);
  window.once('ready-to-show', () => {
    // Failures are reported by the autoUpdater 'error' handler (update_failed);
    // an uncaught rejection would also surface as a noisy app_error
    autoUpdater?.checkForUpdatesAndNotify()?.catch(() => {});
    if (isMaximized && !window.isDestroyed()) window.maximize();
    if (isFullScreen && !window.isDestroyed()) window.setFullScreen(true);
  });
  return window;
}

// Full screen has no traffic lights, so the inset title strip would be empty
// space: hide it while the window is full screen (index.css draws it)
const FULL_SCREEN_CSS = 'body.platform-mac #top-row { padding-top: var(--panel-gap) !important; }'
  + ' body.platform-mac .container-fluid::before { display: none; }';

function hideTitleStripInFullScreen(window) {
  let key = null;
  window.on('enter-full-screen', async () => {
    try {
      const inserted = await window.webContents.insertCSS(FULL_SCREEN_CSS);
      // Left full screen while the CSS was going in: take it straight back out
      if (!window.isFullScreen()) {
        window.webContents.removeInsertedCSS(inserted).catch(() => {});
        return;
      }
      key = inserted;
    } catch {
      key = null;
    }
  });
  window.on('leave-full-screen', () => {
    if (!key) return;
    const done = key;
    key = null;
    window.webContents.removeInsertedCSS(done).catch(() => {});
  });
  // A reload drops inserted CSS; put it back if the window is still full screen
  window.webContents.on('did-finish-load', async () => {
    if (!window.isFullScreen()) return;
    try {
      key = await window.webContents.insertCSS(FULL_SCREEN_CSS);
    } catch {
      key = null;
    }
  });
}

export { createMainWindow };
export default createMainWindow;
