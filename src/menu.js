// Menus
var application_menu = [
  {
    label: 'Edit',
    submenu: [
      {
        label: 'Cut',
        role: 'cut'
      },
      {
        label: 'Copy',
        role: 'copy'
      },
      {
        label: 'Paste',
        role: 'paste'
      },
      {
        label: 'Paste And Match Style',
        role: 'pasteAndMatchStyle'
      },
      {
        label: 'Select All',
        role: 'selectAll'
      }
    ]
  },
  {
    label: 'Songs',
    submenu: [
      {
        label: 'Add Song'
      },
      {
        label: 'Edit Selected Song'
      }
    ]
  },
  {
    label: 'Hotkeys',
    submenu: [
      {
        label: 'Open Hotkeys File',
        click: () => {
          loadHotkeysFile();
        }
      },
      {
        label: 'Save Hotkeys To File'
      }
    ]
  }
]

if (platform == 'darwin') {
  const name = app.name;
  application_menu.unshift({
    label: name,
    submenu: [
      {
        label: 'About ' + name,
        role: 'about'
      },
      {
        type: 'separator'
      },
      {
        label: 'Preferences',
        click: () => {
          preferences.show();
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
}

menu = Menu.buildFromTemplate(application_menu);
Menu.setApplicationMenu(menu);
