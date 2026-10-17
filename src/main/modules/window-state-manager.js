import { withTimeout, TimeoutError } from './with-timeout.js';

function createWindowStateManager({
  mainWindow: initialWindow = null,
  getMainWindow = () => initialWindow,
  store,
  debugLog,
  screen,
  profileManager,
  getCurrentProfile,
  log,
  isQuitting,
  // Closing the window quits the app, so a close that isn't part of an
  // explicit quit (Cmd-Q, File > Quit) is confirmed first: (window) => Promise<boolean>
  confirmClose = async () => true,
  // A hung page must not block closing or quitting: give up on its flush
  flushTimeoutMs = 5000
}) {
  let windowStateSaveTimeout = null;
  let closePreparationPromise = null;
  // Set only at the moment the app is really closing the window itself
  // (Electron's before-quit-for-update, Windows session end): there is nothing
  // to confirm, and a preventDefault would cancel the install or shutdown.
  // Never set ahead of time: an install that doesn't quit must leave the
  // confirmation and the close-time flush in place.
  let closeWithoutConfirm = false;
  // While the switcher applies another profile's bounds, the resize,
  // maximize and fullscreen events it causes must not save interim bounds
  // into that profile (they describe the old layout mid-transition)
  let suppressSavesUntil = 0;
  let settledSaveTimer = null;
  const savesSuppressed = () => Date.now() < suppressSavesUntil;

function setupWindowStateSaving() {
  const mainWindow = getMainWindow();
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
  const debouncedSave = () => {
    if (windowStateSaveTimeout) clearTimeout(windowStateSaveTimeout);
    windowStateSaveTimeout = setTimeout(() => {
      windowStateSaveTimeout = null;
      if (savesSuppressed()) return;
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
    if (savesSuppressed()) return;
    saveWindowState(mainWindow).catch(err => {
      debugLog?.error('Error saving on maximize', { module: 'app-setup', error: err.message });
    });
  });

  // Save window state when unmaximized
  mainWindow.on('unmaximize', () => {
    if (savesSuppressed()) return;
    saveWindowState(mainWindow).catch(err => {
      debugLog?.error('Error saving on unmaximize', { module: 'app-setup', error: err.message });
    });
  });

  // Save window state when entering fullscreen
  mainWindow.on('enter-full-screen', () => {
    if (savesSuppressed()) return;
    saveWindowState(mainWindow).catch(err => {
      debugLog?.error('Error saving on enter-fullscreen', { module: 'app-setup', error: err.message });
    });
  });

  // Save window state when leaving fullscreen
  mainWindow.on('leave-full-screen', () => {
    if (savesSuppressed()) return;
    saveWindowState(mainWindow).catch(err => {
      debugLog?.error('Error saving on leave-fullscreen', { module: 'app-setup', error: err.message });
    });
  });

  // Save window state when minimized (for completeness)
  mainWindow.on('minimize', () => {
    if (savesSuppressed()) return;
    saveWindowState(mainWindow).catch(err => {
      debugLog?.error('Error saving on minimize', { module: 'app-setup', error: err.message });
    });
  });

  // Save window state when restored from minimize
  mainWindow.on('restore', () => {
    if (savesSuppressed()) return;
    saveWindowState(mainWindow).catch(err => {
      debugLog?.error('Error saving on restore', { module: 'app-setup', error: err.message });
    });
  });

  // Windows shutdown, restart or log off: the session is ending and the
  // window will be closed for us. Asking "Quit?" would block the shutdown
  // ("Mx. Voice is preventing shutdown"), so let it close, and save now.
  // (Not on query-session-end: that shutdown can still be cancelled.)
  mainWindow.on('session-end', () => {
    closeWithoutConfirm = true;
    prepareMainWindowForClose().catch((err) => {
      debugLog?.error('Error saving state at session end', { module: 'app-setup', function: 'setupWindowStateSaving', error: err.message });
    });
  });

  let closeSaveComplete = false;
  let closeInProgress = false;
  mainWindow.on('close', async (event) => {
    // An explicit quit was already confirmed by asking for it
    if (isQuitting() || closeSaveComplete || closeWithoutConfirm) return;
    event.preventDefault();
    // Already asking, or already closing: one dialog, one save
    if (closeInProgress) return;
    closeInProgress = true;

    let confirmed = true;
    try {
      confirmed = await confirmClose(mainWindow);
    } catch (err) {
      // Never trap the user in a window they asked to close
      debugLog?.error('Close confirmation failed; closing anyway', {
        module: 'app-setup',
        function: 'setupWindowStateSaving',
        error: err.message
      });
    }
    if (!confirmed) {
      closeInProgress = false;
      debugLog?.info('Window close cancelled', { module: 'app-setup', function: 'setupWindowStateSaving' });
      return;
    }

    debugLog?.info('Window closing, saving window state...', {
      module: 'app-setup',
      function: 'setupWindowStateSaving'
    });
    
    try {
      await prepareMainWindowForClose();
      
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
    } finally {
      closeSaveComplete = true;
      if (!mainWindow.isDestroyed()) mainWindow.close();
    }
  });

}

/**
 * Flush renderer state and persist the main window state before it closes.
 * Reuses an in-flight preparation so close and quit events cannot overlap saves.
 */
function prepareMainWindowForClose() {
  if (closePreparationPromise) return closePreparationPromise;

  const preparation = (async () => {
    if (windowStateSaveTimeout) {
      clearTimeout(windowStateSaveTimeout);
      windowStateSaveTimeout = null;
    }

    const mainWindow = getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed()) return;

    if (!mainWindow.webContents.isDestroyed()) {
      try {
        await withTimeout(
          mainWindow.webContents.executeJavaScript('window.profileStateAPI?.flushProfileState?.()'),
          flushTimeoutMs,
          `Page did not flush its state within ${flushTimeoutMs}ms`
        );
      } catch (error) {
        if (!(error instanceof TimeoutError)) throw error;
        debugLog?.warn('Page did not flush its state in time; closing without it', {
          module: 'app-setup',
          function: 'prepareMainWindowForClose',
          timeoutMs: flushTimeoutMs
        });
      }
    }
    await saveWindowState(mainWindow);
  })();
  closePreparationPromise = preparation;
  const clearPreparation = () => {
    if (closePreparationPromise === preparation) closePreparationPromise = null;
  };
  preparation.then(clearPreparation, clearPreparation);

  return preparation;
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
    const currentProfile = getCurrentProfile?.();
    
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

  /**
   * Ignore event-driven saves for the next `ms` (macOS fullscreen exits
   * animate), then save the window's actual state once. That final save is
   * what counts: it records the settled layout even if a transition outlasted
   * the window, and keeps a resize the user made meanwhile.
   */
  function suppressSaves(ms) {
    suppressSavesUntil = Math.max(suppressSavesUntil, Date.now() + ms);
    clearTimeout(settledSaveTimer);
    settledSaveTimer = setTimeout(() => {
      settledSaveTimer = null;
      const window = getMainWindow();
      if (!window || window.isDestroyed()) return;
      saveWindowState(window).catch((err) => {
        debugLog?.error('Error saving settled window state', { module: 'app-setup', function: 'suppressSaves', error: err.message });
      });
    }, Math.max(0, suppressSavesUntil - Date.now()));
  }

  return {
    suppressSaves,
    allowUnconfirmedClose: () => { closeWithoutConfirm = true; },
    loadWindowState,
    prepareMainWindowForClose,
    saveWindowState,
    setupWindowStateSaving
  };
}

export { createWindowStateManager };
export default createWindowStateManager;
