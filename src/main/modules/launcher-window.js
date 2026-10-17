/**
 * Profile Launcher Window Module
 * 
 * Handles the profile launcher window that shows on startup.
 * Allows users to select/create/delete profiles before launching the main app.
 */

import electron from 'electron';

// Destructure from electron (handles both named and default exports)
const { BrowserWindow, ipcMain, app } = electron;
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES6 modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let debugLog = null;
let profileManager = null;
let launcherWindow = null;
let mainAppLauncher = null;
let onSwitchPick = null;
let onSwitchCancel = null;
let profileSelected = false;
// 'startup': no main window yet, closing quits. 'switch': the main window is
// hidden behind the picker, closing returns to it.
let launcherMode = 'startup';

/**
 * Initialize the launcher window module. Registers the launcher IPC handlers,
 * so call it exactly once per process.
 * @param {Object} dependencies - Module dependencies
 */
function initializeLauncherWindow(dependencies) {
  debugLog = dependencies.debugLog;
  profileManager = dependencies.profileManager;
  mainAppLauncher = dependencies.mainAppLauncher;
  onSwitchPick = dependencies.onSwitchPick || null;
  onSwitchCancel = dependencies.onSwitchCancel || null;
  
  debugLog?.info('Launcher window module initialized', { 
    module: 'launcher-window',
    function: 'initializeLauncherWindow' 
  });
  
  // Register IPC handlers for launcher
  registerLauncherHandlers();
}

/**
 * Create and show the launcher window
 * @param {{ mode?: 'startup'|'switch' }} [options]
 * @returns {Promise<BrowserWindow>} The launcher window
 */
async function createLauncherWindow({ mode = 'startup' } = {}) {
  if (launcherWindow) {
    launcherWindow.focus();
    return launcherWindow;
  }
  
  // Reset the profile selected flag for new launcher sessions
  profileSelected = false;
  launcherMode = mode;
  
  debugLog?.info('Creating launcher window', { 
    module: 'launcher-window',
    function: 'createLauncherWindow',
    mode
  });
  
  launcherWindow = new BrowserWindow({
    width: 550,
    height: 650,
    show: process.env.APP_TEST_MODE !== '1',
    resizable: false,
    center: true,
    titleBarStyle: 'hiddenInset',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '..', '..', 'preload', 'launcher-preload.cjs')
    }
  });
  
  // Load the launcher HTML
  const launcherHtmlPath = path.join(__dirname, '..', '..', 'launcher.html');
  await launcherWindow.loadFile(launcherHtmlPath);
  
  // Open DevTools in development (disabled by default)
  // Uncomment to enable DevTools for debugging the launcher
  // if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
  //   launcherWindow.webContents.openDevTools({ mode: 'detach' });
  // }
  
  // Clean up on close
  launcherWindow.on('closed', () => {
    debugLog?.info('Launcher window closed', { 
      module: 'launcher-window',
      function: 'createLauncherWindow',
      mode: launcherMode,
      profileSelected
    });
    
    launcherWindow = null;
    if (profileSelected) return;

    if (launcherMode === 'switch') {
      // Cancelled a switch: go back to the session that is still running
      Promise.resolve(onSwitchCancel?.()).catch((error) => {
        debugLog?.error('Launcher: failed to return to the main window', {
          module: 'launcher-window',
          function: 'createLauncherWindow',
          error: error?.message
        });
      });
    } else {
      // Initial launch without a choice: nothing to return to
      app.quit();
    }
  });
  
  return launcherWindow;
}

/**
 * Close the launcher window
 */
function closeLauncherWindow() {
  if (launcherWindow) {
    launcherWindow.close();
    launcherWindow = null;
  }
}

/**
 * Register IPC handlers for launcher operations
 */
function registerLauncherHandlers() {
  // Get all profiles
  ipcMain.handle('launcher:get-profiles', async () => {
    try {
      const profiles = await profileManager.getAvailableProfiles();
      
      debugLog?.info('Launcher: Retrieved profiles', { 
        module: 'launcher-window',
        function: 'launcher:get-profiles',
        count: profiles.length 
      });
      
      return { success: true, profiles };
    } catch (error) {
      debugLog?.error('Launcher: Failed to get profiles', { 
        module: 'launcher-window',
        function: 'launcher:get-profiles',
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  });
  
  // Create new profile
  ipcMain.handle('launcher:create-profile', async (event, name, description) => {
    try {
      debugLog?.info('Launcher: Creating profile', { 
        module: 'launcher-window',
        function: 'launcher:create-profile',
        name 
      });
      
      const result = await profileManager.createProfile(name, description);
      
      if (result.success) {
        debugLog?.info('Launcher: Profile created', { 
          module: 'launcher-window',
          function: 'launcher:create-profile',
          name 
        });
      }
      
      return result;
    } catch (error) {
      debugLog?.error('Launcher: Failed to create profile', { 
        module: 'launcher-window',
        function: 'launcher:create-profile',
        name,
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  });
  
  // Delete profile
  ipcMain.handle('launcher:delete-profile', async (event, name) => {
    try {
      debugLog?.info('Launcher: Deleting profile', { 
        module: 'launcher-window',
        function: 'launcher:delete-profile',
        name 
      });
      
      const result = await profileManager.deleteProfile(name);
      
      if (result.success) {
        debugLog?.info('Launcher: Profile deleted', { 
          module: 'launcher-window',
          function: 'launcher:delete-profile',
          name 
        });
      }
      
      return result;
    } catch (error) {
      debugLog?.error('Launcher: Failed to delete profile', { 
        module: 'launcher-window',
        function: 'launcher:delete-profile',
        name,
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  });
  
  // Launch main app with profile
  ipcMain.handle('launcher:launch-app', async (event, profileName) => {
    try {
      debugLog?.info('Launcher: Launching app with profile', { 
        module: 'launcher-window',
        function: 'launcher:launch-app',
        profileName 
      });
      
      // Update profile last used
      profileManager.updateProfileLastUsed(profileName);

      // Launch main app with profile context (or switch the running one)
      const launch = launcherMode === 'switch' ? onSwitchPick : mainAppLauncher;
      if (launch) {
        await launch(profileName);
        
        // Mark that a profile was successfully selected
        profileSelected = true;
        
        // Close launcher window after main app launches with a delay
        // This allows the main window to be created and detected by tests
        setTimeout(() => {
          closeLauncherWindow();
        }, 200);
        
        return { success: true };
      } else {
        throw new Error('Main app launcher not configured');
      }
    } catch (error) {
      debugLog?.error('Launcher: Failed to launch app', { 
        module: 'launcher-window',
        function: 'launcher:launch-app',
        profileName,
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  });
}

export {
  initializeLauncherWindow,
  createLauncherWindow,
  closeLauncherWindow
};

