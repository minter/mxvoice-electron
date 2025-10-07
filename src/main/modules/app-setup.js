/**
 * App Setup Module
 * 
 * Handles application setup, window creation, and lifecycle management
 * for the MxVoice Electron application.
 */

import { app, BrowserWindow, Menu, dialog, shell, nativeTheme, screen } from 'electron';
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
// Accept initial dimensions and state so the caller (which has access to the store)
// can restore the last-saved window state on startup.
function createWindow({ width = 1200, height = 800, x, y, isMaximized, isFullScreen, displayId } = {}) {
  // Validate display still exists if displayId is provided
  let validDisplay = null;
  if (displayId) {
    const displays = screen.getAllDisplays();
    validDisplay = displays.find(d => d.id === displayId);
  }

  // If display is valid and coordinates are provided, use them; otherwise use defaults
  const windowOptions = {
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
      plugins: false // Disable plugins for security
    }
  };

  // Add position if we have valid coordinates and display
  if (validDisplay && x !== undefined && y !== undefined) {
    windowOptions.x = x;
    windowOptions.y = y;
  }

  // Create the browser window.
  const mainWindow = new BrowserWindow(windowOptions);

  // Load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, '../../index.html'));

  // Open the DevTools.
  //mainWindow.webContents.openDevTools();

  // Restore window state after window is ready
  mainWindow.once('ready-to-show', () => {
    if (autoUpdater) {
      autoUpdater.checkForUpdatesAndNotify();
    }
    
    // Restore maximized/fullscreen state after window is ready
    if (isMaximized && !mainWindow.isDestroyed()) {
      mainWindow.maximize();
    }
    if (isFullScreen && !mainWindow.isDestroyed()) {
      mainWindow.setFullScreen(true);
    }
  });

  return mainWindow;
}

/**
 * Set up comprehensive window state saving
 * Saves window state on resize, move, maximize, minimize, and close events
 * This should be called after the store is available (after module initialization)
 */
function setupWindowStateSaving() {
  if (!mainWindow || !store) {
    debugLog?.warn('Cannot setup window state saving - missing window or store', { 
      module: 'app-setup', 
      function: 'setupWindowStateSaving',
      hasWindow: !!mainWindow,
      hasStore: !!store
    });
    return;
  }

  debugLog?.info('Setting up window state saving', { 
    module: 'app-setup', 
    function: 'setupWindowStateSaving',
    windowId: mainWindow.id,
    windowBounds: mainWindow.getBounds()
  });

  // Save window state on resize
  mainWindow.on('will-resize', (_event, newBounds) => {
    debugLog?.debug('Window will-resize event triggered', { 
      module: 'app-setup', 
      function: 'setupWindowStateSaving',
      newBounds: newBounds
    });
    saveWindowState(mainWindow);
  });

  // Save window state on move
  mainWindow.on('will-move', (_event, newBounds) => {
    debugLog?.debug('Window will-move event triggered', { 
      module: 'app-setup', 
      function: 'setupWindowStateSaving',
      newBounds: newBounds
    });
    saveWindowState(mainWindow);
  });

  // Save window state when maximized
  mainWindow.on('maximize', () => {
    saveWindowState(mainWindow);
  });

  // Save window state when unmaximized
  mainWindow.on('unmaximize', () => {
    saveWindowState(mainWindow);
  });

  // Save window state when entering fullscreen
  mainWindow.on('enter-full-screen', () => {
    saveWindowState(mainWindow);
  });

  // Save window state when leaving fullscreen
  mainWindow.on('leave-full-screen', () => {
    saveWindowState(mainWindow);
  });

  // Save window state when minimized (for completeness)
  mainWindow.on('minimize', () => {
    saveWindowState(mainWindow);
  });

  // Save window state when restored from minimize
  mainWindow.on('restore', () => {
    saveWindowState(mainWindow);
  });

  // Save window state before closing (this is the key event)
  mainWindow.on('close', () => {
    saveWindowState(mainWindow);
  });

  // Also save on before-unload as backup
  mainWindow.on('before-unload', () => {
    saveWindowState(mainWindow);
  });

}

/**
 * Save complete window state to store
 * Includes position, size, maximized state, fullscreen state, and display ID
 */
function saveWindowState(window) {
  if (!window || !store || window.isDestroyed()) {
    debugLog?.warn('Cannot save window state - missing dependencies', { 
      module: 'app-setup', 
      function: 'saveWindowState',
      hasWindow: !!window,
      hasStore: !!store,
      isDestroyed: window?.isDestroyed?.()
    });
    return;
  }

  try {
    const bounds = window.getBounds();
    const display = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y });
    const state = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: window.isMaximized(),
      isFullScreen: window.isFullScreen(),
      displayId: display.id,
      displayName: display.label || `Display ${display.id}`
    };

    // Save individual properties for backward compatibility
    const widthResult = store.set('browser_width', state.width);
    const heightResult = store.set('browser_height', state.height);
    
    // Save complete window state
    const windowStateResult = store.set('window_state', state);

    debugLog?.debug('Window state saved successfully', { 
      module: 'app-setup', 
      function: 'saveWindowState',
      state: state
    });
  } catch (error) {
    debugLog?.error('Failed to save window state', { 
      module: 'app-setup', 
      function: 'saveWindowState',
      error: error.message,
      stack: error.stack
    });
  }
}

/**
 * Load window state from store
 * Returns complete window state object or null if not available
 */
function loadWindowState(storeInstance = store) {
  if (!storeInstance) {
    debugLog?.warn('Cannot load window state - store not available', { 
      module: 'app-setup', 
      function: 'loadWindowState'
    });
    return null;
  }

  try {
    debugLog?.info('Loading window state from store', { 
      module: 'app-setup', 
      function: 'loadWindowState',
      storePath: storeInstance.path
    });
    
    const state = storeInstance.get('window_state');
    if (state && typeof state === 'object') {
      debugLog?.info('Window state loaded successfully', { 
        module: 'app-setup', 
        function: 'loadWindowState',
        state: state
      });
      return state;
    } else {
      debugLog?.info('No window state found in store', { 
        module: 'app-setup', 
        function: 'loadWindowState',
        foundState: state
      });
    }
  } catch (error) {
    debugLog?.error('Failed to load window state', { 
      module: 'app-setup', 
      function: 'loadWindowState',
      error: error.message,
      stack: error.stack
    });
  }
  
  return null;
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
          id: "toggle_advanced_search",
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
      label: "Profile",
      submenu: [
        {
          label: "Switch Profile...",
          click: async () => {
            // Send message to renderer to handle profile switch with state save
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('menu:switch-profile');
            }
          },
        },
        {
          label: "New Profile...",
          click: () => {
            // Send message to renderer to handle new profile creation
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('menu:new-profile');
            }
          },
        },
        {
          label: "Duplicate Profile...",
          click: () => {
            // Send message to renderer to handle profile duplication
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('menu:duplicate-profile');
            }
          },
        },
        { type: "separator" },
        {
          label: "Delete Current Profile...",
          click: () => {
            // Send message to renderer to handle current profile deletion
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('menu:delete-current-profile');
            }
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
          label: 'Release Notes',
          click: () => {
            shell.openExternal(`https://github.com/minter/mxvoice-electron/releases/`);
          }
        },
        {
          label: 'Contact Support…',
          click: () => {
            shell.openExternal('mailto:support@mxvoice.app?subject=' + encodeURIComponent('Mx. Voice Support Request'));
          }
        },
        {
          label: 'Export Logs',
          click: async () => {
            try { 
              await getLogService()?.exportLogs({ days: 7 }); 
            } catch (error) {
              debugLog.warn('Failed to export logs from menu', { 
                module: 'app-setup', 
                function: 'exportLogs',
                error: error?.message || 'Unknown error' 
              });
            }
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
          label: 'Release Notes',
          click: () => {
            shell.openExternal(`https://github.com/minter/mxvoice-electron/releases/`);
          }
        },
        {
          label: 'Contact Support…',
          click: () => {
            shell.openExternal('mailto:support@mxvoice.app?subject=' + encodeURIComponent('Mx. Voice Support Request'));
          }
        },
        {
          label: 'Export Logs',
          click: async () => {
            try { 
              await getLogService()?.exportLogs({ days: 7 }); 
            } catch (error) {
              debugLog.warn('Failed to export logs from menu', { 
                module: 'app-setup', 
                function: 'exportLogs',
                error: error?.message || 'Unknown error' 
              });
            }
          }
        },
        {
          type: 'separator'
        },
        {
          label: 'Developer Tools',
          role: 'toggleDevTools'
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
      <div class="section">
        <div class="heading">Support</div>
        <a class="link" href="mailto:support@mxvoice.app" onclick="event.preventDefault(); window.open('mailto:support@mxvoice.app?subject=' + encodeURIComponent('Mx. Voice Support Request'))">Email support@mxvoice.app</a>
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
  testAppSetup,
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
  testAppSetup,
  setupWindowStateSaving,
  saveWindowState,
  loadWindowState
}; 