/**
 * App Setup Module
 * 
 * Handles application setup, window creation, and lifecycle management
 * for the MxVoice Electron application.
 */

import { app, BrowserWindow, Menu, dialog, shell } from 'electron';
import path from 'path';
import os from 'os';

// Dependencies that will be injected
let mainWindow;
let store;
let autoUpdater;
let fileOperations;

// Initialize the module with dependencies
function initializeAppSetup(dependencies) {
  mainWindow = dependencies.mainWindow;
  store = dependencies.store;
  autoUpdater = dependencies.autoUpdater;
  fileOperations = dependencies.fileOperations;
}

// Create the main window
function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: store ? store.get('browser_width') : 1280,
    height: store ? store.get('browser_height') : 1024,
    minWidth: 1000,
    minHeight: 660,
    webPreferences: {
      contextIsolation: false, // Temporarily disable for testing
      nodeIntegration: true,   // Temporarily enable for testing
      preload: path.join(__dirname, '../../preload/preload-modular.js')
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

  // mainWindow.$ = mainWindow.jQuery = require('jquery');
  // mainWindow.Bootstrap = require('bootstrap');

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
  var application_menu = [
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
          click: () => {
            mainWindow.openDevTools();
          }
        },
        {
          type: 'separator'
        },
        {
          label: 'Quit',
          accelerator: 'Command+Q',
          click: () => { app.quit(); }
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
          label: 'Exit',
          click: () => { app.quit(); }
        }
      ]
    })

    application_menu.push({
      label: 'Help',
      role: 'help',
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
          label: 'Developer Tools',
          click: () => {
            mainWindow.openDevTools();
          }
        }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(application_menu);
  Menu.setApplicationMenu(menu);
}

// UI operation functions
function increaseFontSize() {
  console.log('Increasing font size');
  if (mainWindow) {
    mainWindow.webContents.send("increase_font_size");
  }
}

function decreaseFontSize() {
  console.log("Decreasing font size");
  if (mainWindow) {
    mainWindow.webContents.send("decrease_font_size");
  }
}

function toggleWaveform() {
  console.log("Toggling waveform");
  if (mainWindow) {
    mainWindow.webContents.send("toggle_wave_form");
  }
}

function toggleAdvancedSearch() {
  console.log("Toggling advanced search");
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
  console.log('Sending delete_selected_song message');
  if (mainWindow) {
    mainWindow.webContents.send('delete_selected_song');
  }
}

function sendEditSong() {
  console.log('Sending edit_selected_song message');
  if (mainWindow) {
    mainWindow.webContents.send('edit_selected_song');
  }
}

function manageCategories() {
  console.log('Sending manage_categories message');
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
  console.log('Testing App Setup...');
  console.log('✅ App setup module loaded');
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