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

// Initialize the module with dependencies
function initializeAppSetup(dependencies) {
  mainWindow = dependencies.mainWindow;
  store = dependencies.store;
  autoUpdater = dependencies.autoUpdater;
  fileOperations = dependencies.fileOperations;
  debugLog = dependencies.debugLog;
  getCurrentProfile = dependencies.getCurrentProfile;
  autoBackupTimer = dependencies.autoBackupTimer;
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
      preload: path.join(__dirname, '../../preload/preload-modular.cjs'),
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

  // Use debounced save for frequent events (move/resize)
  let saveTimeout = null;
  const debouncedSave = () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      saveWindowState(mainWindow).catch(err => {
        debugLog?.error('Error in debounced window state save', {
          module: 'app-setup',
          function: 'setupWindowStateSaving',
          error: err.message
        });
      });
    }, 500); // Wait 500ms after last event before saving
  };

  // Save window state after resize completes
  mainWindow.on('resized', () => {
    debugLog?.debug('Window resized event triggered', { 
      module: 'app-setup', 
      function: 'setupWindowStateSaving'
    });
    debouncedSave();
  });

  // Save window state after move completes
  mainWindow.on('moved', () => {
    debugLog?.debug('Window moved event triggered', { 
      module: 'app-setup', 
      function: 'setupWindowStateSaving'
    });
    debouncedSave();
  });

  // Save window state when maximized
  mainWindow.on('maximize', () => {
    saveWindowState(mainWindow).catch(err => {
      debugLog?.error('Error saving on maximize', { module: 'app-setup', error: err.message });
    });
  });

  // Save window state when unmaximized
  mainWindow.on('unmaximize', () => {
    saveWindowState(mainWindow).catch(err => {
      debugLog?.error('Error saving on unmaximize', { module: 'app-setup', error: err.message });
    });
  });

  // Save window state when entering fullscreen
  mainWindow.on('enter-full-screen', () => {
    saveWindowState(mainWindow).catch(err => {
      debugLog?.error('Error saving on enter-fullscreen', { module: 'app-setup', error: err.message });
    });
  });

  // Save window state when leaving fullscreen
  mainWindow.on('leave-full-screen', () => {
    saveWindowState(mainWindow).catch(err => {
      debugLog?.error('Error saving on leave-fullscreen', { module: 'app-setup', error: err.message });
    });
  });

  // Save window state when minimized (for completeness)
  mainWindow.on('minimize', () => {
    saveWindowState(mainWindow).catch(err => {
      debugLog?.error('Error saving on minimize', { module: 'app-setup', error: err.message });
    });
  });

  // Save window state when restored from minimize
  mainWindow.on('restore', () => {
    saveWindowState(mainWindow).catch(err => {
      debugLog?.error('Error saving on restore', { module: 'app-setup', error: err.message });
    });
  });

  // Save window state on close (non-blocking)
  mainWindow.on('close', async (_event) => {
    debugLog?.info('Window closing, saving window state...', {
      module: 'app-setup',
      function: 'setupWindowStateSaving'
    });
    
    try {
      // Clear any pending debounced saves
      if (saveTimeout) clearTimeout(saveTimeout);
      
      // Save window state (let renderer handle profile state via beforeunload)
      await saveWindowState(mainWindow);
      
      debugLog?.info('Window state saved on close', {
        module: 'app-setup',
        function: 'setupWindowStateSaving'
      });
    } catch (err) {
      debugLog?.error('Error saving window state on close', {
        module: 'app-setup',
        function: 'setupWindowStateSaving',
        error: err.message
      });
    }
  });

}

/**
 * Save complete window state to store
 * Includes position, size, maximized state, fullscreen state, and display ID
 * Saves to profile-specific preferences when a profile is active
 */
async function saveWindowState(window) {
  if (!window || window.isDestroyed()) {
    debugLog?.warn('Cannot save window state - missing dependencies', { 
      module: 'app-setup', 
      function: 'saveWindowState',
      hasWindow: !!window,
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

    // Check if a profile is active
    const mainModule = await import('../index-modular.js');
    const currentProfile = mainModule.getCurrentProfile();
    
    if (currentProfile && profileManager) {
      // Save to profile-specific preferences
      await profileManager.saveProfilePreferences(currentProfile, {
        ...await profileManager.loadProfilePreferences(currentProfile),
        window_state: state,
        browser_width: state.width,
        browser_height: state.height
      });
      
      debugLog?.debug('Window state saved to profile preferences', { 
        module: 'app-setup', 
        function: 'saveWindowState',
        profile: currentProfile,
        state: state
      });
    } else if (store) {
      // Fallback to global store if no profile active
      store.set('browser_width', state.width);
      store.set('browser_height', state.height);
      store.set('window_state', state);
      
      debugLog?.debug('Window state saved to global store (no profile)', { 
        module: 'app-setup', 
        function: 'saveWindowState',
        state: state
      });
    }
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
 * Loads from profile-specific preferences when a profile is active
 */
async function loadWindowState(storeInstance = store, currentProfile = null) {
  try {
    log.info('loadWindowState called', {
      module: 'app-setup',
      function: 'loadWindowState',
      hasCurrentProfile: !!currentProfile,
      currentProfile: currentProfile,
      hasProfileManager: !!profileManager,
      hasStore: !!storeInstance
    });
    
    // Check if a profile is active
    if (currentProfile && profileManager) {
      log.info('Loading window state from profile preferences', { 
        module: 'app-setup', 
        function: 'loadWindowState',
        profile: currentProfile
      });
      
      const preferences = await profileManager.loadProfilePreferences(currentProfile);
      log.info('Profile preferences loaded', {
        module: 'app-setup',
        function: 'loadWindowState',
        hasPreferences: !!preferences,
        hasWindowState: !!preferences?.window_state,
        windowState: preferences?.window_state
      });
      
      const state = preferences?.window_state;
      
      if (state && typeof state === 'object') {
        log.info('Window state loaded from profile successfully', { 
          module: 'app-setup', 
          function: 'loadWindowState',
          profile: currentProfile,
          state: state
        });
        return state;
      } else {
        log.info('No window state found in profile, trying global fallback', { 
          module: 'app-setup', 
          function: 'loadWindowState',
          profile: currentProfile,
          preferencesType: typeof preferences,
          stateType: typeof state
        });
      }
    } else {
      log.info('Skipping profile-specific window state', {
        module: 'app-setup',
        function: 'loadWindowState',
        reason: !currentProfile ? 'no currentProfile' : 'no profileManager'
      });
    }
    
    // Fallback to global store if no profile or no profile state
    if (!storeInstance) {
      log.warn('Cannot load window state - store not available', { 
        module: 'app-setup', 
        function: 'loadWindowState'
      });
      return null;
    }

    log.info('Loading window state from global store', { 
      module: 'app-setup', 
      function: 'loadWindowState',
      storePath: storeInstance.path
    });
    
    const state = storeInstance.get('window_state');
    if (state && typeof state === 'object') {
      log.info('Window state loaded from global store successfully', { 
        module: 'app-setup', 
        function: 'loadWindowState',
        state: state
      });
      return state;
    } else {
      log.info('No window state found in global store', { 
        module: 'app-setup', 
        function: 'loadWindowState',
        foundState: state
      });
    }
  } catch (error) {
    log.error('Failed to load window state', { 
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
          label: "Soundboard Mode",
          accelerator: "CommandOrControl+B",
          id: "toggle_soundboard_mode",
          type: "checkbox",
          click: (menuItem) => {
            if (mainWindow) {
              mainWindow.webContents.send('view:toggle-soundboard-mode');
            }
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
          label: "Log Out",
          enabled: getCurrentProfile ? getCurrentProfile() !== 'Default User' : true,
          click: () => {
            // Send message to renderer to handle logout (switch to Default Profile)
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('menu:logout');
            }
          },
        },
        { type: "separator" },
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
          enabled: getCurrentProfile ? getCurrentProfile() !== 'Default User' : true,
          click: () => {
            // Send message to renderer to handle current profile deletion
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('menu:delete-current-profile');
            }
          },
        },
        { type: "separator" },
        {
          label: "Create Backup Now",
          click: () => {
            // Send message to renderer to handle backup creation
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('menu:create-backup');
            }
          },
        },
        {
          label: "Restore from Backup...",
          click: () => {
            // Send message to renderer to handle backup restore
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('menu:restore-backup');
            }
          },
        },
        {
          label: "Backup Settings...",
          click: () => {
            // Send message to renderer to handle backup settings
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('menu:backup-settings');
            }
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
        sandbox: false, // Required for preload script
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
    
    // View toggle handler
    ipcMain.on('view:toggle-soundboard-mode', () => {
      if (mainWindow) {
        mainWindow.webContents.send('view:toggle-soundboard-mode');
      }
    });
    
    // View menu state update handler
    ipcMain.on('view:update-menu-state', (event, currentView) => {
      updateViewMenuState(currentView);
    });

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

function updateViewMenuState(currentView) {
  try {
    const menu = Menu.getApplicationMenu();
    if (menu) {
      const soundboardMenuItem = menu.getMenuItemById('toggle_soundboard_mode');
      if (soundboardMenuItem) {
        soundboardMenuItem.checked = currentView === 'soundboard';
        debugLog?.info('Updated view menu state', {
          module: 'app-setup',
          function: 'updateViewMenuState',
          currentView,
          checked: soundboardMenuItem.checked
        });
      }
    }
  } catch (error) {
    debugLog?.error('Error updating view menu state', {
      module: 'app-setup',
      function: 'updateViewMenuState',
      error: error.message
    });
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
  
  // Stop backup timer before quit
  app.on('before-quit', () => {
    if (autoBackupTimer) {
      autoBackupTimer.stopAutoBackupTimer();
      debugLog?.info('Stopped auto-backup timer on app quit', {
        module: 'app-setup',
        function: 'setupAppLifecycle'
      });
    }
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
      website: 'https://mxvoice.app/',
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