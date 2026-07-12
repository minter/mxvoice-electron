function buildApplicationMenu({
  app,
  Menu,
  shell,
  mainWindow,
  fileOperations,
  getCurrentProfile,
  showAboutDialog,
  debugLog,
  logService,
  rendererCommands
}) {
  const application_menu = [
    {
      label: "File",
      submenu: [
        {
          label: "Export Library...",
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('menu:export-library');
            }
          },
        },
        {
          label: "Import Library...",
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('menu:import-library');
            }
          },
        },
      ],
    },
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
            rendererCommands.increaseFontSize();
          },
        },
        {
          label: "Decrease Font Size",
          accelerator: "CommandOrControl+-",
          click: () => {
            rendererCommands.decreaseFontSize();
          },
        },
        { type: "separator" },
        {
          label: "Show/Hide Waveform",
          accelerator: "CommandOrControl+W",
          click: () => {
            rendererCommands.toggleWaveform();
          },
        },
        {
          label: "Show/Hide Advanced Search",
          accelerator: "CommandOrControl+M",
          id: "toggle_advanced_search",
          click: () => {
            rendererCommands.toggleAdvancedSearch();
          },
        },
        { type: "separator" },
        {
          label: "Start a New Session",
          click: () => {
            rendererCommands.closeAllTabs();
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
            rendererCommands.editSelectedSong();
          },
        },
        {
          label: "Delete Selected Song",
          click: () => {
            rendererCommands.deleteSelectedSong();
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
            rendererCommands.manageCategories();
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
          label: 'Documentation',
          click: () => {
            shell.openExternal('https://mxvoice.app/docs/');
          }
        },
        {
          label: 'Release Notes',
          click: () => {
            shell.openExternal(`https://github.com/minter/mxvoice-electron/releases/`);
          }
        },
        {
          label: "What's New",
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('menu:whats-new');
            }
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
              await logService?.exportLogs({ days: 7 });
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
    // Add Preferences to Edit menu on Windows/Linux
    const editMenu = application_menu.find(m => m.label === 'Edit');
    if (editMenu) {
      editMenu.submenu.push(
        { type: 'separator' },
        {
          label: 'Preferences',
          click: () => {
            mainWindow.webContents.send('show_preferences');
          }
        }
      );
    }

    // Add quit to the File menu on Windows/Linux
    const fileMenu = application_menu.find(m => m.label === 'File');
    if (fileMenu) {
      fileMenu.submenu.push(
        { type: 'separator' },
        { role: 'quit' }
      );
    }

    const name = app.name;
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
          label: 'Documentation',
          click: () => {
            shell.openExternal('https://mxvoice.app/docs/');
          }
        },
        {
          label: 'Release Notes',
          click: () => {
            shell.openExternal(`https://github.com/minter/mxvoice-electron/releases/`);
          }
        },
        {
          label: "What's New",
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('menu:whats-new');
            }
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
              await logService?.exportLogs({ days: 7 });
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
  return application_menu;
}


export { buildApplicationMenu };
export default buildApplicationMenu;

