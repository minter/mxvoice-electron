/**
 * App Setup Module
 * 
 * Handles application setup, window creation, and lifecycle management
 * for the MxVoice Electron application.
 */

import { app, BrowserWindow, Menu, dialog, shell, nativeTheme } from 'electron';
import { getLogService } from './log-service.js';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES6 modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dependencies that will be injected
let mainWindow;
let store;
let autoUpdater;
let fileOperations;
let debugLog;

// Initialize the module with dependencies
function initializeAppSetup(dependencies) {
  mainWindow = dependencies.mainWindow;
  store = dependencies.store;
  autoUpdater = dependencies.autoUpdater;
  fileOperations = dependencies.fileOperations;
  debugLog = dependencies.debugLog;
}

// Create the main window
// Accept initial dimensions so the caller (which has access to the store)
// can restore the last-saved size on startup.
function createWindow({ width = 1200, height = 800 } = {}) {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width,
    height,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, '../../preload/preload-modular.js'),
      sandbox: false, // Keep false for now as we're using preload scripts
      webSecurity: true,
      allowRunningInsecureContent: false,
      // Enhanced security settings
      experimentalFeatures: false,
      webgl: false, // Disable WebGL for security (can be enabled if needed)
      plugins: false, // Disable plugins for security
      // Content Security Policy
      contentSecurityPolicy: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; media-src 'self' blob: data:"
    }
  });

  // Load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, '../../index.html'));

  // Show Apple Silicon warning if running x64 build on Apple Silicon Mac
  if (
    process.platform === 'darwin' &&
    process.arch === 'x64'
  ) {
    try {
      const cpuModel = os.cpus()[0].model || '';
      if (cpuModel.includes('Apple')) {
        dialog.showMessageBox(mainWindow, {
          type: 'warning',
          buttons: ['OK', 'Visit Website'],
          defaultId: 1,
          cancelId: 0,
          title: 'Apple Silicon Version Recommended',
          message: 'You are running the Intel (x64) version of Mx. Voice on an Apple Silicon Mac.',
          detail: 'For best performance, please visit https://mxvoice.app/ and download the Apple Silicon version.',
          noLink: true
        }).then(result => {
          if (result.response === 1) {
            shell.openExternal('https://mxvoice.app/');
          }
        });
      }
    } catch (e) {
      // Fallback: do nothing if detection fails
    }
  }

  // Open the DevTools.
  //mainWindow.webContents.openDevTools();

  mainWindow.on('will-resize', (_event, newBounds) => {
    if (store) {
      store.set('browser_width', newBounds.width);
      store.set('browser_height', newBounds.height);
    }
  });

  mainWindow.on('ready-to-show', () => {
    if (autoUpdater) {
      autoUpdater.checkForUpdatesAndNotify();
    }
  });

  return mainWindow;
}

// Create application menu
function createApplicationMenu() {
  const application_menu = [
    {
      label: "Edit",
      submenu: [
        {
          label: "Cut",
          role: "cut",
        },
        {
          label: "Copy",
          role: "copy",
        },
        {
          label: "Paste",
          role: "paste",
        },
        {
          label: "Paste And Match Style",
          role: "pasteAndMatchStyle",
        },
        {
          label: "Select All",
          role: "selectAll",
        },
      ],
    },
    {
      label: "View",
      submenu: [
        {
          label: "Increase Font Size",
          accelerator: "CommandOrControl+=",
          click: () => {
            increaseFontSize();
          },
        },
        {
          label: "Decrease Font Size",
          accelerator: "CommandOrControl+-",
          click: () => {
            decreaseFontSize();
          },
        },
        { type: "separator" },
        {
          label: "Show/Hide Waveform",
          accelerator: "CommandOrControl+W",
          click: () => {
            toggleWaveform();
          },
        },
        {
          label: "Show/Hide Advanced Search",
          accelerator: "CommandOrControl+M",
          click: () => {
            toggleAdvancedSearch();
          },
        },
        { type: "separator" },
        {
          label: "Start a New Session",
          click: () => {
            closeAllTabs();
          },
        },
      ],
    },
    {
      label: "Songs",
      submenu: [
        {
          label: "Add Song",
          click: () => {
            if (fileOperations && fileOperations.addFileDialog) {
              fileOperations.addFileDialog();
            }
          },
        },
        {
          label: "Add All Songs In Directory",
          click: () => {
            if (fileOperations && fileOperations.addDirectoryDialog) {
              fileOperations.addDirectoryDialog();
            }
          },
        },
        {
          label: "Edit Selected Song",
          click: () => {
            sendEditSong();
          },
        },
        {
          label: "Delete Selected Song",
          click: () => {
            sendDeleteSong();
          },
        },
      ],
    },
    {
      label: "Hotkeys",
      submenu: [
        {
          label: "Open Hotkeys File",
          accelerator: "CommandOrControl+O",
          click: () => {
            if (fileOperations && fileOperations.loadHotkeysFile) {
              fileOperations.loadHotkeysFile();
            }
          },
        },
        {
          label: "Save Hotkeys To File",
          accelerator: "CommandOrControl+S",
          click: () => {
            mainWindow.webContents.send("start_hotkey_save");
          },
        },
      ],
    },
    {
      label: "Categories",
      submenu: [
        {
          label: "Manage Categories",
          click: () => {
            manageCategories();
          },
        },
      ],
    },
  ];

  if (process.platform == 'darwin') {
    const name = app.name;
    application_menu.unshift({
      label: name,
      submenu: [
        {
          label: 'About ' + name,
          role: 'about'
        },
        {
          label: 'Release Notes For Version ' + app.getVersion(),
          click: () => {
            shell.openExternal(`https://github.com/minter/mxvoice-electron/releases/tag/v${app.getVersion()}`);
          }
        },
        {
          label: 'Release Notes For All Versions',
          click: () => {
            shell.openExternal(`https://github.com/minter/mxvoice-electron/releases/`);
          }
        },
        {
          type: 'separator'
        },
        {
          label: 'Preferences',
          click: () => {
            mainWindow.webContents.send('show_preferences');
          }
        },
        {
          type: 'separator'
        },
        {
          label: 'Hide ' + name,
          accelerator: 'Command+H',
          role: 'hide'
        },
        {
          label: 'Hide Others',
          accelerator: 'Command+Shift+H',
          role: 'hideothers'
        },
        {
          label: 'Show All',
          role: 'unhide'
        },
        {
          label: 'Developer Tools',
          role: 'toggleDevTools'
        },
        {
          label: 'Export Logs…',
          click: async () => {
            try { await getLogService()?.exportLogs({ days: 7 }); } catch (_) {}
          }
        },
        {
          type: 'separator'
        },
        {
          role: 'quit'
        },
      ]
    });
  } else {
    application_menu[0].submenu.push(
      {
        type: 'separator'
      },
      {
        label: 'Preferences',
        click: () => {
          mainWindow.webContents.send('show_preferences');
        }
      }
    )
    const name = app.name;

    application_menu.unshift({
      label: 'File',
      submenu: [
        {
          role: 'quit'
        }
      ]
    })

    application_menu.push({
      label: 'Help',
      role: 'help',
      submenu: [
        {
          label: 'About ' + name,
          click: () => {
            showAboutDialog();
          }
        },
        {
          label: 'Release Notes For Version ' + app.getVersion(),
          click: () => {
            shell.openExternal(`https://github.com/minter/mxvoice-electron/releases/tag/v${app.getVersion()}`);
          }
        },
        {
          label: 'Release Notes For All Versions',
          click: () => {
            shell.openExternal(`https://github.com/minter/mxvoice-electron/releases/`);
          }
        },
        {
          type: 'separator'
        },
        {
          label: 'Developer Tools',
          role: 'toggleDevTools'
        },
        {
          label: 'Export Logs…',
          click: async () => {
            try { await getLogService()?.exportLogs({ days: 7 }); } catch (_) {}
          }
        }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(application_menu);
  Menu.setApplicationMenu(menu);
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
      height: 360,
      resizable: false,
      minimizable: false,
      maximizable: false,
      title: `About ${applicationName}`,
      backgroundColor,
      autoHideMenuBar: true,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:;" />
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
      .link { color: #4da3ff; text-decoration: none; }
      .btn { background: transparent; color: var(--fg); border: 1px solid var(--muted); padding: 6px 12px; border-radius: 6px; cursor: pointer; }
      .btn:hover { border-color: var(--fg); }
    </style>
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
        <a class="link" href="https://mxvoice.app/" onclick="event.preventDefault(); window.open('https://mrvoice.net/')">https://mrvoice.net/</a>
      </div>
      <div class="footer">
        <div style="color: var(--muted);">© 2025</div>
        <button class="btn" onclick="window.close()">Close</button>
      </div>
    </div>
  </body>
</html>`;

    aboutWindow.removeMenu();
    aboutWindow.loadURL('data:text/html;charset=UTF-8,' + encodeURIComponent(html));
  } catch (_error) {
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
    } catch (_) {}
  }
}
function increaseFontSize() {
  debugLog?.info('Increasing font size', { module: 'app-setup', function: 'increaseFontSize' });
  if (mainWindow) {
    mainWindow.webContents.send("increase_font_size");
  }
}

function decreaseFontSize() {
  debugLog?.info("Decreasing font size", { module: 'app-setup', function: 'decreaseFontSize' });
  if (mainWindow) {
    mainWindow.webContents.send("decrease_font_size");
  }
}

function toggleWaveform() {
  debugLog?.info("Toggling waveform", { module: 'app-setup', function: 'toggleWaveform' });
  if (mainWindow) {
    mainWindow.webContents.send("toggle_wave_form");
  }
}

function toggleAdvancedSearch() {
  debugLog?.info("Toggling advanced search", { module: 'app-setup', function: 'toggleAdvancedSearch' });
  if (mainWindow) {
    mainWindow.webContents.send("toggle_advanced_search");
  }
}

function closeAllTabs() {
  if (mainWindow) {
    mainWindow.webContents.send("close_all_tabs");
  }
}

function sendDeleteSong() {
  debugLog?.info('Sending delete_selected_song message', { module: 'app-setup', function: 'sendDeleteSong' });
  if (mainWindow) {
    mainWindow.webContents.send('delete_selected_song');
  }
}

function sendEditSong() {
  debugLog?.info('Sending edit_selected_song message', { module: 'app-setup', function: 'sendEditSong' });
  if (mainWindow) {
    mainWindow.webContents.send('edit_selected_song');
  }
}

function manageCategories() {
  debugLog?.info('Sending manage_categories message', { module: 'app-setup', function: 'manageCategories' });
  if (mainWindow) {
    mainWindow.webContents.send('manage_categories');
  }
}

// Setup app lifecycle events
function setupAppLifecycle() {
  app.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });

  // Quit when all windows are closed.
  app.on('window-all-closed', () => {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  // Removes a deprecation warning when building
  app.allowRendererProcessReuse = true;
  app.setAppLogsPath();

  if (process.platform == 'darwin') {
    app.setAboutPanelOptions({
      applicationName: app.name,
      applicationVersion: app.getVersion(),
      copyright: 'Copyright 2025',
      authors: [
        'Wade Minter',
        'Andrew Berkowitz'
      ],
      website: 'https://mrvoice.net/',
      credits: "Wade Minter\nAndrew Berkowitz"
    })
  }
}

// Test function
function testAppSetup() {
  debugLog?.info('Testing App Setup...', { module: 'app-setup', function: 'testAppSetup' });
  debugLog?.info('✅ App setup module loaded', { module: 'app-setup', function: 'testAppSetup' });
  return true;
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
  testAppSetup
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
  testAppSetup
}; 