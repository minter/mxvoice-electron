const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const { is } = require('electron-util');
const os = require('os');
const fs = require('fs');
const readlines = require('n-readlines');
const ElectronPreferences = require('electron-preferences');

let mainWindow;

// Enable live reload
if (is.development) {
  require("electron-reload")(__dirname);
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
}

const createWindow = () => {

  checkOldConfig();

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 1024,
    webPreferences: {
      preload: path.join(app.getAppPath(), 'src/preload.js')
    }
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Open the DevTools.
  //mainWindow.webContents.openDevTools();

  mainWindow.$ = mainWindow.jQuery = require('jquery');
  // mainWindow.Bootstrap = require('bootstrap');
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

app.on('closed', function() {
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

if (process.platform == 'darwin') {
  app.setAboutPanelOptions({
    applicationName: app.name,
    applicationVersion: app.getVersion(),
    copyright: 'Copyright 2020',
    authors: [
      'Wade Minter',
      'Andrew Berkowitz'
    ],
    website: 'https://mrvoice.net/',
    credits: "Wade Minter <wade@wademinter.com>\nAndrew Berkowitz<andrew@andrewberkowitz.com>"
  })
}


// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

// Menus
var application_menu = [
  {
    label: 'Edit',
    submenu: [
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
        label: 'Open Hotkeys File'
      },
      {
        label: 'Save Hotkeys To File'
      }
    ]
  }
]

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


// Preferences
const preferences = new ElectronPreferences({
    /**
     * Where should preferences be saved?
     */
    'dataStore': path.resolve(app.getPath('userData'), 'preferences.json'),
    /**
     * Default values.
     */
    'defaults': {
        'locations': {
          'music_directory': path.join(os.homedir(), 'mp3'),
          'hotkey_directory': path.join(os.homedir(), 'hotkeys'),
          'database_directory': os.homedir()
        }
        // 'notes': {
        //     'folder': path.resolve(os.homedir(), 'Notes')
        // },
        // 'markdown': {
        //     'auto_format_links': true,
        //     'show_gutter': false
        // },
        // 'preview': {
        //     'show': true
        // },
        // 'drawer': {
        //     'show': true
        // }
    },
    'onLoad': (preferences) => {
      return preferences;
    },
    'sections': [
        {
            'id': 'locations',
            'label': 'Data Locations',
            /**
             * See the list of available icons below.
             */
            'icon': 'archive-2',
            'form': {
                'groups': [
                    {
                        /**
                         * Group heading is optional.
                         */
                        'fields': [
                          {
                              'label': 'Database Directory',
                              'key': 'database_directory',
                              'type': 'directory',
                              'help': 'The location to store your mrvoice.db file'
                          },

                          {
                              'label': 'Music File Directory',
                              'key': 'music_directory',
                              'type': 'directory',
                              'help': 'The place to store the actual audio files'
                          },
                          {
                              'label': 'Hotkey Directory',
                              'key': 'hotkey_directory',
                              'type': 'directory',
                              'help': 'The place to store your saved hotkeys'
                          }
                        ]
                      }
                    ]
                  }
                }
              ]
   });

   // Config migration
   function checkOldConfig() {
     var config_path;
     if (process.platform == 'darwin') {
       config_path = path.join(app.getPath('home'), 'mrvoice.cfg');
     }
     else if (process.platform == 'win32') {
       config_path = path.join('C:', 'mrvoice.cfg');
     }

     if (fs.existsSync(config_path)) {
       // An old config file exists, we need to load the preferences
       console.log("Found old Mr. Voice config file at " + config_path);
       old_settings = [];

       const line_reader = new readlines(config_path);

       while (line = line_reader.next()) {
         [key, val] = line.toString().trim().split('::');
         old_settings[key] = val;
       }
       console.log('Preferences are ' + preferences);
       console.log('Current value of file path is ' + preferences.value('locations.music_directory'));
       console.log('Setting value of file path to ' + old_settings['filepath']);
       preferences.value('locations.database_directory', path.dirname(old_settings['db_file']));
       preferences.value('locations.music_directory', old_settings['filepath']);
       preferences.value('locations.hotkey_directory', old_settings['savedir']);

       fs.rename(config_path, config_path + '.converted', function(err) {
         if ( err ) console.log('RENAME ERROR: ' + err);
       });
     }
   };
