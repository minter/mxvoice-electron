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
import { deleteProfileWithRecovery } from './profile-delete.js';

// Get __dirname equivalent for ES6 modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let debugLog = null;
let profileManager = null;
let launcherWindow = null;
let mainAppLauncher = null;
let boardSession = null;
let recoveryStore = null;
let getCurrentProfile = () => null;
let profileSelected = false;

// The window stays hidden until the page has sized it to its profile list,
// so it never appears at the default size first; this is the fallback if the
// page never reports (for example, profiles failed to load)
const REVEAL_FALLBACK_MS = 1500;
let revealFallbackTimer = null;

const LAUNCHER_WIDTH = 420;
const LAUNCHER_MIN_HEIGHT = 240;
const LAUNCHER_MAX_HEIGHT = 560;

/**
 * Initialize the launcher window module. Registers the launcher IPC handlers,
 * so call it exactly once per process.
 * @param {Object} dependencies - Module dependencies
 */
function initializeLauncherWindow(dependencies) {
  debugLog = dependencies.debugLog;
  profileManager = dependencies.profileManager;
  mainAppLauncher = dependencies.mainAppLauncher;
  boardSession = dependencies.boardSession || null;
  recoveryStore = dependencies.recoveryStore || null;
  getCurrentProfile = dependencies.getCurrentProfile || (() => null);
  
  debugLog?.info('Launcher window module initialized', { 
    module: 'launcher-window',
    function: 'initializeLauncherWindow' 
  });
  
  // Register IPC handlers for launcher
  registerLauncherHandlers();
}

/**
 * Create and show the startup launcher window. (Switch Profile later uses
 * the same picker in a dialog inside the main window.)
 * @returns {Promise<BrowserWindow>} The launcher window
 */
async function createLauncherWindow() {
  if (launcherWindow) {
    launcherWindow.focus();
    return launcherWindow;
  }
  
  // Reset the profile selected flag for new launcher sessions
  profileSelected = false;
  
  debugLog?.info('Creating launcher window', { 
    module: 'launcher-window',
    function: 'createLauncherWindow'
  });
  
  launcherWindow = new BrowserWindow({
    titleBarStyle: 'hiddenInset',
    width: LAUNCHER_WIDTH,
    height: 420,
    useContentSize: true,
    show: false,
    resizable: false,
    center: true,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '..', '..', 'preload', 'launcher-preload.cjs')
    }
  });
  
  // Load the launcher HTML
  const launcherHtmlPath = path.join(__dirname, '..', '..', 'launcher.html');
  const windowBeingLoaded = launcherWindow;
  clearTimeout(revealFallbackTimer);
  revealFallbackTimer = setTimeout(() => revealLauncherWindow(windowBeingLoaded), REVEAL_FALLBACK_MS);
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
      profileSelected
    });
    
    clearTimeout(revealFallbackTimer);
    launcherWindow = null;
    // Closed without choosing: there is no main window to go to
    if (!profileSelected) app.quit();
  });
  
  return launcherWindow;
}

/**
 * Show the launcher once it has its final size (tests keep it hidden)
 * @param {BrowserWindow} win
 */
function revealLauncherWindow(win) {
  if (!win || win.isDestroyed() || win.isVisible()) return;
  clearTimeout(revealFallbackTimer);
  if (process.env.APP_TEST_MODE === '1') return;
  win.show();
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
      
      const result = await deleteProfileWithRecovery(name, {
        profileManager, boardSession, recoveryStore, getCurrentProfile, debugLog
      });
      
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
  
  // Fit the window to the profile list (the page measures itself once)
  ipcMain.handle('launcher:fit-to-content', (event, height) => {
    if (!launcherWindow || launcherWindow.isDestroyed() || event.sender !== launcherWindow.webContents) {
      return { success: false, error: 'Launcher window not available' };
    }
    const requested = Number.isFinite(height) ? Math.round(height) : LAUNCHER_MIN_HEIGHT;
    const clamped = Math.min(LAUNCHER_MAX_HEIGHT, Math.max(LAUNCHER_MIN_HEIGHT, requested));
    launcherWindow.setContentSize(LAUNCHER_WIDTH, clamped);
    revealLauncherWindow(launcherWindow);
    return { success: true, height: clamped };
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

      // Launch main app with profile context
      if (mainAppLauncher) {
        await mainAppLauncher(profileName);
        
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

