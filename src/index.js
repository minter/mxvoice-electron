const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const { is } = require('electron-util');
const os = require('os');
const fs = require('fs');
const readlines = require('n-readlines');
const Store = require('electron-store');
const log = require('electron-log');
const { Octokit } = require("@octokit/rest");
const octokit = new Octokit();
var md = require('markdown-it')();
console.log = log.log;

const defaults = {
  browser_width: 1280,
  browser_height: 1024,
  music_directory: path.join(app.getPath('userData'), 'mp3'),
  hotkey_directory: path.join(app.getPath('userData'), 'hotkeys'),
  database_directory: app.getPath('userData'),
  fade_out_seconds: 2,
  first_run_completed: false
}
const store = new Store({
  defaults: defaults
});

// Uncomment this to view contents of store
//store.openInEditor();

const { autoUpdater } = require("electron-updater")
autoUpdater.logger = require("electron-log")
autoUpdater.logger.transports.file.level = "info"

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

  migrateOldPreferences();
  checkFirstRun();


  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: store.get('browser_width'),
    height: store.get('browser_height'),
    minWidth: 1000,
    minHeight: 660,
    webPreferences: {
      enableRemoteModule: true,
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
    store.set('browser_width', newBounds.width);
    store.set('browser_height', newBounds.height);
  });

  mainWindow.on('ready-to-show', () => {
    autoUpdater.checkForUpdatesAndNotify();
  });

  triggerGoogleAnalytics();

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
app.setAppLogsPath();

if (process.platform == 'darwin') {
  app.setAboutPanelOptions({
    applicationName: app.name,
    applicationVersion: app.getVersion(),
    copyright: 'Copyright 2021',
    authors: [
      'Wade Minter',
      'Andrew Berkowitz'
    ],
    website: 'https://mrvoice.net/',
    credits: "Wade Minter\nAndrew Berkowitz"
  })
}

ipcMain.handle('get-app-path', async (event) => {
  const result = await app.getAppPath();
  return result
})

ipcMain.handle('show-directory-picker', async (event, defaultPath) => {
  let path = dialog.showOpenDialogSync({
    defaultPath: defaultPath,
    properties: ['openDirectory']
  });
  return path
})

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

ipcMain.on('restart-and-install-new-version', (event, arg) => {
  autoUpdater.quitAndInstall();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

// Menus
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
          addFileDialog();
        },
      },
      {
        label: "Add All Songs In Directory",
        click: () => {
          addDirectoryDialog();
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
          loadHotkeysFile();
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
          require('electron').shell.openExternal(`https://github.com/minter/mxvoice-electron/releases/tag/v${app.getVersion()}`);
        }
      },
      {
        label: 'Release Notes For All Versions',
        click: () => {
          require('electron').shell.openExternal(`https://github.com/minter/mxvoice-electron/releases/`);
        }
      },
      {
        type: 'separator'
      },
      {
        label: 'Preferences',
        click: () => {
          mainWindow.webContents.send('show_preferences');
          // preferences.show();
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
        //preferences.show();
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
          require('electron').shell.openExternal(`https://github.com/minter/mxvoice-electron/releases/tag/v${app.getVersion()}`);
        }
      },
      {
        label: 'Release Notes For All Versions',
        click: () => {
          require('electron').shell.openExternal(`https://github.com/minter/mxvoice-electron/releases/`);
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

menu = Menu.buildFromTemplate(application_menu);
Menu.setApplicationMenu(menu);

autoUpdater.on('update-available', (updateInfo) => {
  console.log(`Triggering update-available action with info ${updateInfo.releaseNotes}`);
  mainWindow.webContents.send('display_release_notes', updateInfo.releaseName, `<h1>Version ${updateInfo.releaseName}</h1>` + updateInfo.releaseNotes);
  console.log(`display_release_notes call done`);
});


   function loadHotkeysFile() {
     var fkey_mapping = [];
     console.log("Loading hotkeys file");
     dialog.showOpenDialog(mainWindow, {
       buttonLabel: 'Open',
       filters: [
         { name: 'Mx. Voice Hotkey Files', extensions: ['mrv'] }
       ],
       defaultPath: store.get('hotkey_directory'),
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
       defaultPath: store.get('hotkey_directory'),
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
       defaultPath: store.get('hotkey_directory'),
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
         defaultPath: store.get('hotkey_directory'),
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
             { name: 'Audio Files', extensions: ['mp3', 'mp4', 'm4a', 'wav', 'ogg'] }
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

    function increaseFontSize() {
      console.log('Increasing font size');
      mainWindow.webContents.send("increase_font_size");
    }

    function decreaseFontSize() {
      console.log("Decreasing font size");
      mainWindow.webContents.send("decrease_font_size");
    }

    function toggleWaveform() {
      console.log("Toggling waveform");
      mainWindow.webContents.send("toggle_wave_form");
    }

    function toggleAdvancedSearch() {
      console.log("Toggling advanced search");
      mainWindow.webContents.send("toggle_advanced_search");
    }

    function closeAllTabs() {
      mainWindow.webContents.send("close_all_tabs");
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

    function migrateOldPreferences() {
      old_prefs_path = path.resolve(app.getPath('userData'), 'preferences.json');
      if (fs.existsSync(old_prefs_path)) {
        // There is an old preferences file we need to migrate
        console.log('Migrating old preferences.json to new config.json file');
        let rawdata = fs.readFileSync(old_prefs_path);
        let old_prefs = JSON.parse(rawdata);
        store.set('music_directory', old_prefs.locations.music_directory);
        store.set('hotkey_directory', old_prefs.locations.hotkey_directory);
        store.set('database_directory', old_prefs.locations.database_directory);
        store.set('browser_width', (old_prefs?.config?.browser_width || 1280));
        store.set('browser_height', (old_prefs?.config?.browser_height || 1024));
        store.set('fade_out_seconds', (old_prefs?.audio?.fade_out_seconds || 3));
        store.set('first_run_completed', (old_prefs?.system?.first_run_completed || true));

        fs.renameSync(old_prefs_path, `${old_prefs_path}.migrated`);
      }
    }
    // Handle first-time running
    function checkFirstRun() {
      console.log(`First run preference returns ${store.get('first_run_completed')}`)
      if (!store.get('first_run_completed')) {
        var oldConfig = checkOldConfig();
        console.log(`Old config function returned ${oldConfig}`)
        if (oldConfig) {
          console.log("Migrated old config settings, checking no further")
        } else {
          console.log("Preparing for first-time setup")
          fs.mkdirSync(store.get('music_directory'))
          fs.mkdirSync(store.get('hotkey_directory'))

          const initDb = require('better-sqlite3')(path.join(store.get('database_directory'), 'mxvoice.db'));
          initDb.exec(`CREATE TABLE IF NOT EXISTS 'categories' (   code varchar(8) NOT NULL,   description varchar(255) NOT NULL );
CREATE TABLE mrvoice (   id INTEGER PRIMARY KEY,   title varchar(255) NOT NULL,   artist varchar(255),   category varchar(8) NOT NULL,   info varchar(255),   filename varchar(255) NOT NULL,   time varchar(10),   modtime timestamp(6),   publisher varchar(16),   md5 varchar(32) );
CREATE UNIQUE INDEX 'category_code_index' ON categories(code);
CREATE UNIQUE INDEX 'category_description_index' ON categories(description);
INSERT INTO categories VALUES('UNC', 'Uncategorized');
INSERT INTO mrvoice (title, artist, category, filename, time, modtime) VALUES ('Rock Bumper', 'Patrick Short', 'UNC', 'PatrickShort-CSzRockBumper.mp3', '00:49', '${Math.floor(Date.now() / 1000)}');
`)
          fs.copyFileSync(path.join(__dirname, 'assets', 'music', 'CSz Rock Bumper.mp3'), path.join(store.get('music_directory'), 'PatrickShort-CSzRockBumper.mp3'))
          console.log(`mxvoice.db created at ${store.get('database_directory')}`)
          initDb.close()
          store.set('first_run_completed', true)
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
       store.set('database_directory', path.dirname(old_settings['db_file']));
       store.set('music_directory', old_settings['filepath']);
       store.set('hotkey_directory', old_settings['savedir']);
       store.set('first_run_completed', true)
       return true

       // Save renaming the old config file for final releases
       // fs.rename(config_path, config_path + '.converted', function(err) {
       //   if ( err ) console.log('RENAME ERROR: ' + err);
       // });
     } else {
       return false
     }
   };

   function triggerGoogleAnalytics() {
     const axios = require("axios");
     const { v4: uuidv4 } = require("uuid");
     if (!store.has('cid')) {
      store.set('cid', uuidv4());
     }
     const payload = new URLSearchParams({
       v: 1,
       cid: store.get('cid'),
       tid: "UA-207795804-1",
       t: "pageview",
       dp: "/mxvoice-main",
       dt: "Electron",
       ua: mainWindow.webContents.getUserAgent()
     }).toString();
     axios
       .post("https://www.google-analytics.com/collect", payload)
       .then((response) => {
         console.log(response.data);
       })
       .catch(function (error) {
         console.log(error);
       });
   }