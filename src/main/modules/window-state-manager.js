function createWindowStateManager({
  mainWindow,
  store,
  debugLog,
  screen,
  profileManager,
  getCurrentProfile,
  log,
  isQuitting
}) {
  let windowStateSaveTimeout = null;
  let closePreparationPromise = null;

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
  const debouncedSave = () => {
    if (windowStateSaveTimeout) clearTimeout(windowStateSaveTimeout);
    windowStateSaveTimeout = setTimeout(() => {
      windowStateSaveTimeout = null;
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

  let closeSaveComplete = false;
  mainWindow.on('close', async (event) => {
    if (isQuitting() || closeSaveComplete) return;
    event.preventDefault();
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

    if (!mainWindow || mainWindow.isDestroyed()) return;

    if (!mainWindow.webContents.isDestroyed()) {
      await mainWindow.webContents.executeJavaScript(
        'window.moduleRegistry?.profileState?.flushProfileState?.()'
      );
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

  return {
    loadWindowState,
    prepareMainWindowForClose,
    saveWindowState,
    setupWindowStateSaving
  };
}

export { createWindowStateManager };
export default createWindowStateManager;

