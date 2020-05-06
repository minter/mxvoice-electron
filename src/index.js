const { app, BrowserWindow, Menu, ipcMain, dialog, autoUpdater } = require('electron');
const path = require('path');
const { is } = require('electron-util');
const os = require('os');
const fs = require('fs');
const readlines = require('n-readlines');
const ElectronPreferences = require('electron-preferences');
const isDev = require('electron-is-dev');
require('update-electron-app')()

let mainWindow;

// Enable live reload
if (isDev) {
  require("electron-reload")(__dirname);
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
}

const createWindow = () => {

  checkFirstRun();

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: (preferences.value('config.browser_width') || 1280),
    height: (preferences.value('config.browser_height') || 1024),
    minWidth: 800,
    minHeight: 600,
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

  mainWindow.on('will-resize', (_event, newBounds) => {
    preferences.value('config.browser_width', newBounds.width);
    preferences.value('config.browser_height', newBounds.height);
  });

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

// Removes a deprecation warning when building
app.allowRendererProcessReuse = true;

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
    credits: "Wade Minter\nAndrew Berkowitz"
  })
}

ipcMain.on('open-hotkey-file', (event, arg) => {
  console.log("Main process starting hotkey open");
  loadHotkeysFile();
});

ipcMain.on('save-hotkey-file', (event, arg) => {
  console.log("Main process starting hotkey save");
  console.log(`Arg is ${arg}`);
  console.log(`First element is ${arg[0]}`);
  saveHotkeysFile(arg);
});

ipcMain.on('open-holding-tank-file', (event, arg) => {
  console.log("Main process starting holding tank open");
  loadHoldingTankFile();
});

ipcMain.on('save-holding-tank-file', (event, arg) => {
  console.log("Main process starting holding tank save");
  console.log(`Arg is ${arg}`);
  console.log(`First element is ${arg[0]}`);
  saveHoldingTankFile(arg);
});


// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

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
        label: 'Add Song',
        click: () => {
          addFileDialog();
        }
      },
      {
        label: 'Add All Songs In Directory',
        click: () => {
          addDirectoryDialog();
        }
      },
      {
        label: 'Edit Selected Song',
        click: () => {
          sendEditSong();
        }
      },
      {
        label: 'Delete Selected Song',
        click: () => {
          sendDeleteSong();
        }
      }
    ]
  },
  {
    label: 'Hotkeys',
    submenu: [
      {
        label: 'Open Hotkeys File',
        accelerator: 'CommandOrControl+O',
        click: () => {
          loadHotkeysFile();
        }
      },
      {
        label: 'Save Hotkeys To File',
        accelerator: 'CommandOrControl+S',
        click: () => {
          mainWindow.webContents.send('start_hotkey_save');
        }
      }
    ]
  },
  {
    label: 'Categories',
    submenu: [
      {
        label: 'Manage Categories',
        click: () => {
          manageCategories();
        }
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
} else {
  application_menu[0].submenu.push(
    {
      type: 'separator'
    },
    {
      label: 'Preferences',
      click: () => {
        preferences.show();
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
      'music_directory': path.join(app.getPath('userData'), 'mp3'),
      'hotkey_directory': path.join(app.getPath('userData'), 'hotkeys'),
      'database_directory': app.getPath('userData')
    },
    'config': {
      'browser_width': 1280,
      'browser_height': 1024
    },
    'audio': {
      'fade_out_seconds': 2
    }
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
                    'help': 'The location to store your mxvoice.db file'
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
        },
        {
          'id': 'audio',
          'label': 'Sound Configuration',
          /**
           * See the list of available icons below.
           */
          'icon': 'bell-53',
          'form': {
            'groups': [
              {
                /**
                * Group heading is optional.
                */
                'fields': [
                  {
                    'label': 'Fade Out Time (seconds)',
                      'key': 'fade_out_seconds',
                      'type': 'text',
                      'help': 'How long (in seconds) to perform a fade-out'
                  }
                ]
              }
            ]
          }
        }
      ]
  });

   function loadHotkeysFile() {
     var fkey_mapping = [];
     console.log("Loading hotkeys file");
     dialog.showOpenDialog(mainWindow, {
       buttonLabel: 'Open',
       filters: [
         { name: 'Mx. Voice Hotkey Files', extensions: ['mrv'] }
       ],
       defaultPath: preferences.value('locations.hotkey_directory'),
       message: 'Select your Mx. Voice hotkey file',
       properties: ['openFile']
     }).then(result => {
       if (result.canceled == true) {
         console.log('Silently exiting hotkey load');
         return;
       }
       else {
         var filename = result.filePaths[0];
         console.log(`Processing file ${filename}`);
         const line_reader = new readlines(filename);
         var title

         while (line = line_reader.next()) {
           [key, val] = line.toString().trim().split('::');
           if (/^\D\d+$/.test(key)) {
             fkey_mapping[key] = val;
           } else {
             title = val.replace('_', ' ')
           }
         }
         mainWindow.webContents.send('fkey_load', fkey_mapping, title);
       }
     }).catch(err => {
       console.log(err)
     })
   }

   function loadHoldingTankFile() {
     var song_ids = [];
     console.log("Loading holding tank file");
     dialog.showOpenDialog(mainWindow, {
       buttonLabel: 'Open',
       filters: [
         { name: 'Mx. Voice Holding Tank Files', extensions: ['hld'] }
       ],
       defaultPath: preferences.value('locations.hotkey_directory'),
       message: 'Select your Mx. Voice holding tank file',
       properties: ['openFile']
     }).then(result => {
       if (result.canceled == true) {
         console.log('Silently exiting holding tank load');
         return;
       }
       else {
         var filename = result.filePaths[0];
         console.log(`Processing file ${filename}`);
         const line_reader = new readlines(filename);

         while (line = line_reader.next()) {
           song_ids.push(line.toString().trim());
         }
         mainWindow.webContents.send('holding_tank_load', song_ids);
       }
     }).catch(err => {
       console.log(err)
     })
   }


   function saveHotkeysFile(hotkeyArray) {
     dialog.showSaveDialog(mainWindow, {
       buttonLabel: 'Save',
       filters: [
         { name: 'Mx. Voice Hotkey Files', extensions: ['mrv'] }
       ],
       defaultPath: preferences.value('locations.hotkey_directory'),
       message: 'Save your Mx. Voice hotkey file'
     }).then(result => {
       if (result.canceled == true) {
         console.log('Silently exiting hotkey save');
         return;
       }
       else {
         var filename = result.filePath;
         console.log(`Processing file ${filename}`);
         var file = fs.createWriteStream(filename);
         for(let i = 0; i < hotkeyArray.length; i++){
           var keyId = `f${i + 1}`;
           console.log(`Hotkey array ${i} is ${hotkeyArray[i]}`)
           if (hotkeyArray[i] === undefined || /^\d+$/.test(hotkeyArray[i])) {
             file.write([keyId, hotkeyArray[i]].join('::') + '\n');
           } else {
             file.write(['tab_name', hotkeyArray[i].replace(' ', '_')].join('::') + '\n')
           }
         }
         file.end();
       }
      }).catch(err => {
       console.log(err)
      })
     }

     function saveHoldingTankFile(holdingTankArray) {
       dialog.showSaveDialog(mainWindow, {
         buttonLabel: 'Save',
         filters: [
           { name: 'Mx. Voice Holding Tank Files', extensions: ['hld'] }
         ],
         defaultPath: preferences.value('locations.hotkey_directory'),
         message: 'Save your Mx. Voice holding tank file'
       }).then(result => {
         if (result.canceled == true) {
           console.log('Silently exiting holding tank save');
           return;
         }
         else {
           var filename = result.filePath;
           console.log(`Processing file ${filename}`);
           var file = fs.createWriteStream(filename);
           for(let i = 0; i < holdingTankArray.length; i++){
             file.write(holdingTankArray[i] + '\n');
           }
           file.end();
         }
        }).catch(err => {
         console.log(err)
        })
       }

       function addDirectoryDialog() {
         console.log("Adding directory of songs");
         dialog.showOpenDialog(mainWindow, {
           buttonLabel: 'Add All',
           message: 'Choose directory of music to add',
           properties: ['openDirectory']
         }).then(result => {
           if (result.canceled == true) {
             console.log('Silently exiting add file');
             return;
           } else {
             var dirname = result.filePaths[0];
             console.log(`Processing directory ${dirname}`);
             mainWindow.webContents.send('bulk_add_dialog_load', dirname);
           }
         }).catch(err => {
           console.log(err)
         })
       }

       function addFileDialog() {
         console.log("Adding new file");
         dialog.showOpenDialog(mainWindow, {
           buttonLabel: 'Add',
           filters: [
             { name: 'Audio Files', extensions: ['mp3', 'mp4', 'm4a', 'wav'] }
           ],
           message: 'Choose audio file to add to Mx. Voice',
           properties: ['openFile']
         }).then(result => {
           if (result.canceled == true) {
             console.log('Silently exiting add file');
             return;
           }
           else {
             var filename = result.filePaths[0];
             console.log(`Processing file ${filename}`);
             mainWindow.webContents.send('add_dialog_load', filename);
           }
         }).catch(err => {
           console.log(err)
         })
       }

    function sendDeleteSong() {
      console.log('Sending delete_selected_song message');
      mainWindow.webContents.send('delete_selected_song');
    }

    function sendEditSong() {
      console.log('Sending edit_selected_song message');
      mainWindow.webContents.send('edit_selected_song');
    }

    function manageCategories() {
      console.log('Sending manage_categories message');
      mainWindow.webContents.send('manage_categories');
    }

    // Handle first-time running
    function checkFirstRun() {
      console.log(`First run preference returns ${preferences.value('system.first_run_completed')}`)
      if (!preferences.value('system.first_run_completed')) {
        var oldConfig = checkOldConfig();
        console.log(`Old config function returned ${oldConfig}`)
        if (oldConfig) {
          console.log("Migrated old config settings, checking no further")
        } else {
          console.log("Preparing for first-time setup")
          fs.mkdirSync(preferences.value('locations.music_directory'))
          fs.mkdirSync(preferences.value('locations.hotkey_directory'))

          const initDb = require('better-sqlite3')(path.join(preferences.value('locations.database_directory'), 'mxvoice.db'));
          initDb.exec(`CREATE TABLE IF NOT EXISTS 'categories' (   code varchar(8) NOT NULL,   description varchar(255) NOT NULL );
CREATE TABLE mrvoice (   id INTEGER PRIMARY KEY,   title varchar(255) NOT NULL,   artist varchar(255),   category varchar(8) NOT NULL,   info varchar(255),   filename varchar(255) NOT NULL,   time varchar(10),   modtime timestamp(6),   publisher varchar(16),   md5 varchar(32) );
CREATE UNIQUE INDEX 'category_code_index' ON categories(code);
INSERT INTO categories VALUES('UNC', 'Uncategorized');
INSERT INTO mrvoice (title, artist, category, filename, time, modtime) VALUES ('Rock Bumper', 'Patrick Short', 'UNC', 'PatrickShort-CSzRockBumper.mp3', '00:49', '${Math.floor(Date.now() / 1000)}');
`)
          fs.copyFileSync(path.join(__dirname, 'assets', 'music', 'CSz Rock Bumper.mp3'), path.join(preferences.value('locations.music_directory'), 'PatrickShort-CSzRockBumper.mp3'))
          console.log(`mxvoice.db created at ${preferences.value('locations.database_directory')}`)
          initDb.close()
          preferences.value('system.first_run_completed', true)
        }
      }
    }

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
       console.log("Found old Mr. Voice 2 config file at " + config_path);
       old_settings = [];

       const line_reader = new readlines(config_path);

       while (line = line_reader.next()) {
         [key, val] = line.toString().trim().split('::');
         old_settings[key] = val;
       }
       preferences.value('locations.database_directory', path.dirname(old_settings['db_file']));
       preferences.value('locations.music_directory', old_settings['filepath']);
       preferences.value('locations.hotkey_directory', old_settings['savedir']);
       preferences.value('system.first_run_completed', true)
       return true

       // Save renaming the old config file for final releases
       // fs.rename(config_path, config_path + '.converted', function(err) {
       //   if ( err ) console.log('RENAME ERROR: ' + err);
       // });
     } else {
       return false
     }
   };
