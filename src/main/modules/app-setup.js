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
let mainWindow;
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

// Initialize the module with dependencies
function initializeAppSetup(dependencies) {
  mainWindow = dependencies.mainWindow;
  store = dependencies.store;
  autoUpdater = dependencies.autoUpdater;
  fileOperations = dependencies.fileOperations;
  debugLog = dependencies.debugLog;
  getCurrentProfile = dependencies.getCurrentProfile;
  autoBackupTimer = dependencies.autoBackupTimer;
  analytics = dependencies.analytics;
  appStartTime = dependencies.appStartTime;
  rendererCommands = createRendererCommandDispatcher({
    getWindow: () => mainWindow,
    debugLog
  });
  windowStateManager = createWindowStateManager({
    mainWindow,
    store,
    debugLog,
    screen,
    profileManager,
    getCurrentProfile,
    log,
    isQuitting: () => appLifecycle?.isQuitting() || false
  });
  appLifecycle = createAppLifecycle({
    app,
    BrowserWindow,
    prepareWindowForClose: () => prepareMainWindowForClose(),
    createWindow,
    onClosed: () => { mainWindow = null; },
    autoBackupTimer,
    analytics,
    appStartTime,
    debugLog
  });
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

function prepareMainWindowForClose() {
  return windowStateManager?.prepareMainWindowForClose();
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
    mainWindow,
    fileOperations,
    getCurrentProfile,
    showAboutDialog,
    debugLog,
    logService: getLogService(),
    rendererCommands
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
      parent: mainWindow,
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
      dialog.showMessageBox(mainWindow, {
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

function closeAllTabs() {
  return rendererCommands?.closeAllTabs();
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

// Setup app lifecycle events
function setupAppLifecycle() {
  return appLifecycle?.setup();
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
  closeAllTabs,
  sendDeleteSong,
  sendEditSong,
  manageCategories,
  showAboutDialog,
  setupWindowStateSaving,
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
  closeAllTabs,
  sendDeleteSong,
  sendEditSong,
  manageCategories,
  showAboutDialog,
  setupWindowStateSaving,
  saveWindowState,
  loadWindowState
};
