/**
 * App Setup Module
 * 
 * Handles application setup, window creation, and lifecycle management
 * for the MxVoice Electron application.
 */

import electron from 'electron';
import log from 'electron-log';
import { getLogService } from './log-service.js';
import * as profileManager from './profile-manager.js';
import { isAllowedAboutExternalUrl } from './about-external-url.js';
import { createRendererCommandDispatcher } from './renderer-command-dispatcher.js';
import { buildApplicationMenu } from './application-menu.js';
import { swatchImage } from './color-swatch-image.js';
import { createWindowStateManager } from './window-state-manager.js';
import { createMainWindow } from './main-window-factory.js';
import { createAppLifecycle } from './app-lifecycle.js';
import path from 'path';
import { fileURLToPath } from 'url';

// Destructure from electron (handles both named and default exports)
const { app, BrowserWindow, Menu, dialog, shell, nativeTheme, screen, ipcMain } = electron;

// Get __dirname equivalent for ES6 modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dependencies that will be injected
let getMainWindow = () => null;
let store;
let autoUpdater;
let fileOperations;
let debugLog;
let getCurrentProfile;
let autoBackupTimer;
let analytics;
let appStartTime;
let rendererCommands;
let windowStateManager;
let appLifecycle;
let showSession;

// Initialize the module with dependencies
function initializeAppSetup(dependencies) {
  getMainWindow = dependencies.getMainWindow || (() => dependencies.mainWindow);
  store = dependencies.store;
  autoUpdater = dependencies.autoUpdater;
  fileOperations = dependencies.fileOperations;
  debugLog = dependencies.debugLog;
  getCurrentProfile = dependencies.getCurrentProfile;
  autoBackupTimer = dependencies.autoBackupTimer;
  analytics = dependencies.analytics;
  appStartTime = dependencies.appStartTime;
  showSession = dependencies.showSession;
  rendererCommands = createRendererCommandDispatcher({
    getWindow: () => getMainWindow(),
    debugLog
  });
  windowStateManager = createWindowStateManager({
    getMainWindow: () => getMainWindow(),
    store,
    debugLog,
    screen,
    profileManager,
    getCurrentProfile,
    log,
    isQuitting: () => appLifecycle?.isQuitting() || false,
    confirmClose: (window) => confirmQuitOnWindowClose(window),
    showSession
  });
  appLifecycle = createAppLifecycle({
    app,
    prepareWindowForClose: () => prepareMainWindowForClose(),
    autoBackupTimer,
    analytics,
    appStartTime,
    debugLog
  });
}

/**
 * Closing the main window quits the app (all platforms), so ask first: a
 * stray click on the close button mid-show would otherwise stop the audio and
 * exit. Cmd-Q and File > Quit are explicit and don't ask.
 * @param {BrowserWindow} window
 * @returns {Promise<boolean>} true to close and quit
 */
async function confirmQuitOnWindowClose(window) {
  if (process.env.APP_TEST_MODE === '1') {
    // E2E seam: no native dialog. Tests set the answer and read the count.
    globalThis.__e2eCloseConfirmations = (globalThis.__e2eCloseConfirmations || 0) + 1;
    return (globalThis.__e2eCloseAnswer || 'quit') === 'quit';
  }
  const { response } = await dialog.showMessageBox(window, {
    type: 'question',
    buttons: ['Quit', 'Cancel'],
    // Quitting mid-show is the costly mistake, so Return keeps the app open
    defaultId: 1,
    cancelId: 1,
    message: `Quit ${app.name}?`,
    detail: `Closing the window quits ${app.name}. Anything playing will stop.`
  });
  return response === 0;
}

// Create the main window
// Accept initial dimensions and state so the caller (which has access to the store)
// can restore the last-saved window state on startup.
function createWindow({ width = 1200, height = 800, x, y, isMaximized, isFullScreen, displayId } = {}) {
  return createMainWindow({
    BrowserWindow,
    screen,
    autoUpdater,
    iconPath: path.join(__dirname, '../../assets/icons/mxvoice.ico'),
    preloadPath: path.join(__dirname, '../../preload/preload-bundle.cjs'),
    indexPath: path.join(__dirname, '../../index.html'),
    testMode: process.env.APP_TEST_MODE === '1',
    state: { width, height, x, y, isMaximized, isFullScreen, displayId }
  });
}

/**
 * Set up comprehensive window state saving
 * Saves window state on resize, move, maximize, minimize, and close events
 * This should be called after the store is available (after module initialization)
 */
function setupWindowStateSaving() {
  return windowStateManager?.setupWindowStateSaving();
}

/** @param {{ exit?: 'clean'|'switch'|'handoff' }} [options] - see window-state-manager */
function prepareMainWindowForClose(options) {
  return windowStateManager?.prepareMainWindowForClose(options);
}

function saveWindowState(window) {
  return windowStateManager?.saveWindowState(window);
}

function loadWindowState(storeInstance = store, currentProfile = null) {
  return windowStateManager?.loadWindowState(storeInstance, currentProfile);
}


// Create application menu
function createApplicationMenu() {
  return buildApplicationMenu({
    app,
    Menu,
    shell,
    mainWindow: getMainWindow(),
    fileOperations,
    getCurrentProfile,
    showAboutDialog,
    debugLog,
    logService: getLogService(),
    rendererCommands,
    getShowMenuState: () => {
      const { status, doc, dirty, hasPlayed } = showSession?.state?.() ?? {};
      const shows = (doc?.shows ?? []).map((b) => ({ id: b.id, name: b.name, color: b.color ?? null }));
      const activeShow = shows.find((b) => b.id === doc?.activeShowId) ?? null;
      return { status: status ?? 'idle', activeShow, shows, dirty: !!dirty, hasPlayed: !!hasPlayed };
    },
    rebuildMenu: () => createApplicationMenu(),
    swatchImage
  });
}
// UI operation functions
function showAboutDialog() {
  try {
    const applicationName = app.name;
    const applicationVersion = app.getVersion();
    const isDarkMode = nativeTheme.shouldUseDarkColors;
    const backgroundColor = isDarkMode ? '#1e1e1e' : '#ffffff';
    const foregroundColor = isDarkMode ? '#e6e6e6' : '#222222';
    const mutedColor = isDarkMode ? '#bbbbbb' : '#666666';

    const aboutWindow = new BrowserWindow({
      parent: getMainWindow(),
      modal: true,
      width: 460,
      height: 400,
      resizable: false,
      minimizable: false,
      maximizable: false,
      title: `About ${applicationName}`,
      backgroundColor,
      autoHideMenuBar: true,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join(__dirname, '../../preload/about-preload.cjs')
      }
    });

    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:;" />
    <title>About ${applicationName}</title>
    <style>
      :root {
        --bg: ${backgroundColor};
        --fg: ${foregroundColor};
        --muted: ${mutedColor};
      }
      html, body { margin: 0; padding: 0; background: var(--bg); color: var(--fg); font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, 'Helvetica Neue', Arial, 'Noto Sans', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'; }
      .container { padding: 24px; display: flex; flex-direction: column; gap: 12px; }
      h1 { margin: 0; font-size: 20px; }
      .version { color: var(--muted); }
      .section { margin-top: 8px; }
      .heading { font-weight: 600; margin-bottom: 4px; }
      .credits { white-space: pre-line; }
      .footer { display: flex; justify-content: space-between; align-items: center; margin-top: 16px; }
      .link { color: #4da3ff; text-decoration: none; cursor: pointer; }
      .btn { background: transparent; color: var(--fg); border: 1px solid var(--muted); padding: 6px 12px; border-radius: 6px; cursor: pointer; }
      .btn:hover { border-color: var(--fg); }
    </style>
    <script>
      // Wait for DOM to load, then attach event listeners
      document.addEventListener('DOMContentLoaded', () => {
        // Check if aboutAPI is available
        if (!window.aboutAPI) {
          // aboutAPI not available - preload script may not have loaded
          return;
        }

        // Close button
        const closeBtn = document.getElementById('close-btn');
        if (closeBtn) {
          closeBtn.addEventListener('click', () => {
            window.aboutAPI.closeWindow();
          });
        }

        // Website link
        const websiteLink = document.getElementById('website-link');
        if (websiteLink) {
          websiteLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.aboutAPI.openExternal('https://mxvoice.app/');
          });
        }

        // Documentation link
        const docsLink = document.getElementById('docs-link');
        if (docsLink) {
          docsLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.aboutAPI.openExternal('https://mxvoice.app/docs/');
          });
        }

        // Support link
        const supportLink = document.getElementById('support-link');
        if (supportLink) {
          supportLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.aboutAPI.openExternal('mailto:support@mxvoice.app?subject=' + encodeURIComponent('Mx. Voice Support Request'));
          });
        }
      });
    </script>
  </head>
  <body>
    <div class="container">
      <div>
        <h1>${applicationName}</h1>
        <div class="version">Version ${applicationVersion}</div>
      </div>
      <div class="section">
        <div class="heading">Authors</div>
        <div>Wade Minter</div>
        <div>Andrew Berkowitz</div>
      </div>
      <div class="section">
        <div class="heading">Website</div>
        <a class="link" id="website-link" href="https://mxvoice.app/">https://mxvoice.app/</a>
      </div>
      <div class="section">
        <div class="heading">Documentation</div>
        <a class="link" id="docs-link" href="https://mxvoice.app/docs/">https://mxvoice.app/docs/</a>
      </div>
      <div class="section">
        <div class="heading">Support</div>
        <a class="link" id="support-link" href="mailto:support@mxvoice.app">Email support@mxvoice.app</a>
      </div>
      <div class="footer">
        <div style="color: var(--muted);">© 2025</div>
        <button class="btn" id="close-btn">Close</button>
      </div>
    </div>
  </body>
</html>`;

    // Register IPC handlers for this about window
    const closeHandler = () => {
      debugLog?.info('About window close requested via IPC', { 
        module: 'app-setup', 
        function: 'showAboutDialog' 
      });
      if (aboutWindow && !aboutWindow.isDestroyed()) {
        aboutWindow.close();
      }
    };

    const openExternalHandler = (event, url) => {
      if (event.sender !== aboutWindow.webContents) {
        debugLog?.warn('Rejected external URL request from unexpected sender', {
          module: 'app-setup',
          function: 'showAboutDialog',
          url
        });
        return;
      }
      if (!isAllowedAboutExternalUrl(url)) {
        debugLog?.warn('Rejected unapproved About window URL', {
          module: 'app-setup',
          function: 'showAboutDialog',
          url
        });
        return;
      }
      debugLog?.info('Opening external URL from about dialog', { 
        module: 'app-setup', 
        function: 'showAboutDialog',
        url 
      });
      shell.openExternal(url);
    };

    // Remove existing handlers if any
    ipcMain.removeHandler('about:close-window');
    ipcMain.removeAllListeners('about:close-window');
    ipcMain.removeAllListeners('about:open-external');

    debugLog?.info('Registering IPC handlers for about window', { 
      module: 'app-setup', 
      function: 'showAboutDialog' 
    });

    // Register new handlers
    ipcMain.on('about:close-window', closeHandler);
    ipcMain.on('about:open-external', openExternalHandler);

    // Clean up handlers when window closes
    aboutWindow.on('closed', () => {
      debugLog?.info('About window closed, cleaning up IPC handlers', { 
        module: 'app-setup', 
        function: 'showAboutDialog' 
      });
      ipcMain.removeListener('about:close-window', closeHandler);
      ipcMain.removeListener('about:open-external', openExternalHandler);
    });

    aboutWindow.removeMenu();
    aboutWindow.loadURL('data:text/html;charset=UTF-8,' + encodeURIComponent(html));
  } catch (error) {
    debugLog.warn('Failed to create about dialog, using fallback', { 
      module: 'app-setup', 
      function: 'showAboutDialog',
      error: error?.message || 'Unknown error' 
    });
    // Fallback to simple message box if anything fails
    try {
      const name = app.name;
      dialog.showMessageBox(getMainWindow(), {
        type: 'info',
        title: `About ${name}`,
        message: `${name}`,
        detail: `Version ${app.getVersion()}\n\nAuthors:\n  • Wade Minter\n  • Andrew Berkowitz`,
        buttons: ['OK']
      });
    } catch (fallbackError) {
      debugLog.error('Failed to show fallback about dialog', { 
        module: 'app-setup', 
        function: 'showAboutDialog',
        error: fallbackError?.message || 'Unknown error' 
      });
    }
  }
}
function increaseFontSize() {
  return rendererCommands?.increaseFontSize();
}

function decreaseFontSize() {
  return rendererCommands?.decreaseFontSize();
}

function toggleWaveform() {
  return rendererCommands?.toggleWaveform();
}

function toggleAdvancedSearch() {
  return rendererCommands?.toggleAdvancedSearch();
}

function sendDeleteSong() {
  return rendererCommands?.deleteSelectedSong();
}

function sendEditSong() {
  return rendererCommands?.editSelectedSong();
}

function manageCategories() {
  return rendererCommands?.manageCategories();
}

/**
 * Installing an update: save state now, and hand the show session off so
 * the relaunch restores the show in progress. quitAndInstall() then closes the
 * window without the close-time flush; the "Quit?" question is skipped from
 * Electron's before-quit-for-update (allowUnconfirmedClose), which fires only
 * when the install really quits. The quit's own clean exit keeps the record.
 */
function prepareForUpdateInstall() {
  return windowStateManager?.prepareMainWindowForClose({ exit: 'handoff' });
}

/** Ignore window-state saves caused by the next `ms` of programmatic resizing */
function suppressWindowStateSaves(ms) {
  windowStateManager?.suppressSaves(ms);
}

/** The app is closing the window itself right now: don't ask "Quit?" */
function allowUnconfirmedClose() {
  windowStateManager?.allowUnconfirmedClose();
}

/** An update install didn't quit after all: closes ask "Quit?" again */
function requireCloseConfirmation() {
  windowStateManager?.requireCloseConfirmation();
}

// Setup app lifecycle events. Call after initializeAppSetup(): before it
// there is no lifecycle to set up, and the call would silently do nothing.
function setupAppLifecycle() {
  if (!appLifecycle) {
    throw new Error('setupAppLifecycle() called before initializeAppSetup()');
  }
  return appLifecycle.setup();
}

export {
  initializeAppSetup,
  createWindow,
  createApplicationMenu,
  setupAppLifecycle,
  increaseFontSize,
  decreaseFontSize,
  toggleWaveform,
  toggleAdvancedSearch,
  sendDeleteSong,
  sendEditSong,
  manageCategories,
  showAboutDialog,
  setupWindowStateSaving,
  prepareMainWindowForClose,
  prepareForUpdateInstall,
  allowUnconfirmedClose,
  requireCloseConfirmation,
  suppressWindowStateSaves,
  saveWindowState,
  loadWindowState
};

// Default export for module loading
export default {
  initializeAppSetup,
  createWindow,
  createApplicationMenu,
  setupAppLifecycle,
  increaseFontSize,
  decreaseFontSize,
  toggleWaveform,
  toggleAdvancedSearch,
  sendDeleteSong,
  sendEditSong,
  manageCategories,
  showAboutDialog,
  setupWindowStateSaving,
  prepareMainWindowForClose,
  prepareForUpdateInstall,
  allowUnconfirmedClose,
  requireCloseConfirmation,
  suppressWindowStateSaves,
  saveWindowState,
  loadWindowState
};
