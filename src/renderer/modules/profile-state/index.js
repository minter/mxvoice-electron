/**
 * Profile State Persistence Module
 * 
 * Automatically saves and restores profile-specific UI state:
 * - All hotkey tabs (song IDs + custom tab names)
 * - All holding tank tabs (song IDs + custom tab names)
 * 
 * State is saved to profile directory as state.json
 * Loaded on app start and saved on quit/profile switch
 */

let debugLog = null;
try {
  if (window.debugLog) {
    debugLog = window.debugLog;
  }
} catch (_error) {
  // Debug logger not available
}

// Debounce timer for save operations
let saveDebounceTimer = null;
let pendingSaveResolvers = [];

// Store module references for auto-save
let _hotkeysModuleRef = null;
let _holdingTankModuleRef = null;

/**
 * Extract complete profile state
 * @returns {Object} Complete state object
 */
export function extractProfileState() {
  debugLog?.info('[PROFILE-STATE] === STARTING COMPLETE STATE EXTRACTION ===', { 
    module: 'profile-state',
    function: 'extractProfileState'
  });
  
  const hotkeySnapshot = _hotkeysModuleRef?.getHotkeySnapshot?.();
  const holdingTankSnapshot = _holdingTankModuleRef?.getHoldingTankSnapshot?.();
  const state = {
    version: '1.0.0',
    timestamp: Date.now(),
    hotkeys: hotkeySnapshot || [],
    holdingTank: holdingTankSnapshot || []
  };
  
  // Calculate actual data counts for debugging
  const hotkeyCount = state.hotkeys.reduce((sum, tab) => sum + Object.keys(tab.hotkeys).length, 0);
  const holdingTankCount = state.holdingTank.reduce((sum, tab) => sum + tab.songIds.length, 0);
  
  debugLog?.info('[PROFILE-STATE] Extracted profile state - SUMMARY', { 
    module: 'profile-state',
    function: 'extractProfileState',
    hotkeyTabs: state.hotkeys.length,
    holdingTankTabs: state.holdingTank.length,
    totalHotkeys: hotkeyCount,
    totalHoldingTankSongs: holdingTankCount,
    detailedHotkeys: state.hotkeys.map(tab => ({
      tabNumber: tab.tabNumber,
      tabName: tab.tabName,
      hotkeyCount: Object.keys(tab.hotkeys).length,
      hotkeys: tab.hotkeys
    })),
    detailedHoldingTank: state.holdingTank.map(tab => ({
      tabNumber: tab.tabNumber,
      tabName: tab.tabName,
      songCount: tab.songIds.length,
      songIds: tab.songIds
    }))
  });
  
  // Log warning if state is empty but we expected data
  if (hotkeyCount === 0 && holdingTankCount === 0) {
    debugLog?.warn('[PROFILE-STATE] Extracted state is empty - models may not be initialized or data may have been cleared', {
      module: 'profile-state',
      function: 'extractProfileState'
    });
  }
  
  debugLog?.info('[PROFILE-STATE] === STATE EXTRACTION COMPLETE ===', { 
    module: 'profile-state',
    function: 'extractProfileState',
    timestamp: new Date(state.timestamp).toISOString()
  });
  
  return state;
}

/**
 * Save profile state to file
 * 
 * IMPORTANT: This function takes no parameters. It serializes the initialized collection models.
 * 
 * CRITICAL DATA PROTECTION:
 * - Will NOT save if restoration is in progress (extended lock covers full app init)
 * - Creates backup of existing state before overwriting
 * 
 * @returns {Promise<Object>} Result with success status
 */
export function saveProfileState() {
  return new Promise((resolve) => {
    pendingSaveResolvers.push(resolve);
    if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
    saveDebounceTimer = setTimeout(() => {
      saveDebounceTimer = null;
      const resolvers = pendingSaveResolvers.splice(0);
      _saveProfileStateImmediate().then(result => {
        resolvers.forEach(r => r(result));
      });
    }, 300);
  });
}

async function _saveProfileStateImmediate() {
  try {
    // PROTECTION: Never save during restoration/initialization (race condition protection)
    if (window.isRestoringProfileState) {
      debugLog?.warn('[PROFILE-STATE] Refusing to save - restoration in progress', {
        module: 'profile-state',
        function: 'saveProfileState',
        reason: 'restoration_lock_active'
      });
      return { success: false, error: 'Restoration in progress', skipped: true };
    }
    
    const state = extractProfileState();
    
    // Calculate state contents for logging
    const hotkeyCount = state.hotkeys.reduce((sum, tab) => sum + Object.keys(tab.hotkeys).length, 0);
    const holdingTankCount = state.holdingTank.reduce((sum, tab) => sum + tab.songIds.length, 0);
    const hasData = hotkeyCount > 0 || holdingTankCount > 0;
    
    debugLog?.info('[PROFILE-STATE] Saving profile state', {
      module: 'profile-state',
      function: 'saveProfileState',
      hotkeyCount: hotkeyCount,
      holdingTankCount: holdingTankCount,
      hasData: hasData
    });
    
    const writeResult = await window.secureElectronAPI.profile.saveState(state);
    
    if (writeResult.success) {
      debugLog?.info('[PROFILE-STATE] Profile state saved successfully', { 
        module: 'profile-state',
        function: 'saveProfileState',
        profile: 'current',
        hotkeyCount: hotkeyCount,
        holdingTankCount: holdingTankCount,
        hasData: hasData
      });
      return { success: true };
    } else {
      throw new Error(writeResult.error || 'Failed to write state file');
    }
  } catch (error) {
    debugLog?.error('[PROFILE-STATE] Failed to save profile state', { 
      module: 'profile-state',
      function: 'saveProfileState',
      error: error.message
    });
    return { success: false, error: error.message };
  }
}

/**
 * Load and restore profile state
 * @param {Object} options - Options containing module instances
 * @param {Object} options.hotkeysModule - Hotkeys module instance
 * @param {Object} options.holdingTankModule - Holding tank module instance
 * @returns {Promise<Object>} Result with success status
 */
export async function loadProfileState(options = {}) {
  try {
    const { hotkeysModule, holdingTankModule } = options;
    
    // Set restoration lock to prevent lifecycle saves during initialization
    window.isRestoringProfileState = true;
    
    // Get current profile name for logging
    const currentProfileResult = await window.secureElectronAPI.profile.getCurrent();
    const currentProfile = currentProfileResult?.profile || 'unknown';
    
    debugLog?.info('[PROFILE-STATE] Starting profile state load (restoration lock enabled)', { 
      module: 'profile-state',
      function: 'loadProfileState',
      profile: currentProfile
    });
    
    const readResult = await window.secureElectronAPI.profile.loadState();
    if (!readResult.success) throw new Error(readResult.error || 'Failed to load profile state');
    if (!readResult.loaded) {
      window.isRestoringProfileState = false;
      debugLog?.info('[PROFILE-STATE] No state file found, starting fresh', { 
        module: 'profile-state',
        function: 'loadProfileState',
        profile: currentProfile,
        loaded: false
      });
      return { success: true, loaded: false };
    }
    
    // Handle empty or invalid state files
    if (!readResult.data || readResult.data.trim() === '') {
      window.isRestoringProfileState = false;
      debugLog?.warn('[PROFILE-STATE] State file is empty, treating as no state', {
        module: 'profile-state',
        function: 'loadProfileState',
        profile: currentProfile
      });
      return { success: true, loaded: false };
    }
    
    let state;
    try {
      state = JSON.parse(readResult.data);
    } catch (parseError) {
      window.isRestoringProfileState = false;
      debugLog?.error('[PROFILE-STATE] Failed to parse state JSON', {
        module: 'profile-state',
        function: 'loadProfileState',
        error: parseError.message,
        dataLength: readResult.data?.length || 0
      });
      return { success: true, loaded: false };
    }
    
    // Validate state structure
    if (!state || typeof state !== 'object') {
      window.isRestoringProfileState = false;
      debugLog?.error('[PROFILE-STATE] Invalid state structure - not an object', {
        module: 'profile-state',
        function: 'loadProfileState',
        stateType: typeof state
      });
      return { success: true, loaded: false };
    }
    
    // Ensure required arrays exist (even if empty)
    if (!Array.isArray(state.hotkeys)) {
      debugLog?.warn('[PROFILE-STATE] State missing hotkeys array, initializing empty', {
        module: 'profile-state',
        function: 'loadProfileState'
      });
      state.hotkeys = [];
    }
    
    if (!Array.isArray(state.holdingTank)) {
      debugLog?.warn('[PROFILE-STATE] State missing holdingTank array, initializing empty', {
        module: 'profile-state',
        function: 'loadProfileState'
      });
      state.holdingTank = [];
    }
    
    // Validate that state has some content (not completely empty)
    const hasHotkeys = state.hotkeys.some(tab => tab.hotkeys && Object.keys(tab.hotkeys).length > 0);
    const hasHoldingTank = state.holdingTank.some(tab => tab.songIds && tab.songIds.length > 0);
    
    if (!hasHotkeys && !hasHoldingTank) {
      debugLog?.warn('[PROFILE-STATE] State file exists but contains no data (empty profile)', {
        module: 'profile-state',
        function: 'loadProfileState',
        profile: currentProfile
      });
      // Still return success but mark as not loaded so UI shows empty state
      window.isRestoringProfileState = false;
      return { success: true, loaded: false };
    }
    
    debugLog?.info('[PROFILE-STATE] Loaded profile state', { 
      module: 'profile-state',
      function: 'loadProfileState',
      profile: currentProfile,
      version: state.version,
      timestamp: state.timestamp,
      hotkeyTabs: state.hotkeys?.length || 0,
      holdingTankTabs: state.holdingTank?.length || 0,
      hasHotkeys: hasHotkeys,
      hasHoldingTank: hasHoldingTank,
      statePreview: {
        hotkeys: state.hotkeys?.map(tab => ({
          tabNumber: tab.tabNumber,
          tabName: tab.tabName,
          hotkeyCount: Object.keys(tab.hotkeys || {}).length
        })),
        holdingTank: state.holdingTank?.map(tab => ({
          tabNumber: tab.tabNumber,
          tabName: tab.tabName,
          songCount: (tab.songIds || []).length
        }))
      }
    });
    
    // Restore hotkeys
    if (state.hotkeys && hotkeysModule) {
      debugLog?.info('[PROFILE-STATE] Restoring hotkeys from state', { 
        module: 'profile-state',
        function: 'loadProfileState',
        tabCount: state.hotkeys.length
      });
      await hotkeysModule.restoreHotkeySnapshot(state.hotkeys);
    } else {
      debugLog?.warn('[PROFILE-STATE] Skipping hotkey restore', {
        module: 'profile-state',
        function: 'loadProfileState',
        hasHotkeys: !!state.hotkeys,
        hasModule: !!hotkeysModule
      });
    }
    
    // Restore holding tank
    if (state.holdingTank && holdingTankModule) {
      debugLog?.info('[PROFILE-STATE] Restoring holding tank from state', { 
        module: 'profile-state',
        function: 'loadProfileState',
        tabCount: state.holdingTank.length
      });
      await holdingTankModule.restoreHoldingTankSnapshot(state.holdingTank);
    } else {
      debugLog?.warn('[PROFILE-STATE] Skipping holding tank restore', {
        module: 'profile-state',
        function: 'loadProfileState',
        hasHoldingTank: !!state.holdingTank,
        hasModule: !!holdingTankModule
      });
    }
    
    debugLog?.info('[PROFILE-STATE] Profile state restoration complete', {
      module: 'profile-state',
      function: 'loadProfileState'
    });
    
    // DO NOT clear restoration lock here - it will be cleared after full app initialization
    // This prevents saves from happening before the song table is populated
    debugLog?.info('[PROFILE-STATE] Restoration complete, keeping lock active until app initialization finishes', {
      module: 'profile-state',
      function: 'loadProfileState',
      note: 'Restoration lock will be cleared by clearProfileRestorationLock() after full app init'
    });
    
    return { success: true, loaded: true };
  } catch (error) {
    // Clear restoration lock on error
    window.isRestoringProfileState = false;

    debugLog?.error('[PROFILE-STATE] Failed to load profile state', { 
      module: 'profile-state',
      function: 'loadProfileState',
      error: error.message
    });
    return { success: false, error: error.message };
  }
}

/**
 * Clear the profile restoration lock
 * MUST be called after full app initialization is complete (including song table population)
 * This allows profile state saves to proceed normally after the app is fully loaded
 */
export function clearProfileRestorationLock() {
  if (window.isRestoringProfileState) {
    window.isRestoringProfileState = false;
    debugLog?.info('[PROFILE-STATE] Restoration lock cleared - app initialization complete', {
      module: 'profile-state',
      function: 'clearProfileRestorationLock'
    });
  } else {
    debugLog?.warn('[PROFILE-STATE] clearProfileRestorationLock called but lock was not set', {
      module: 'profile-state',
      function: 'clearProfileRestorationLock'
    });
  }
}

/**
 * Switch profiles with state saving
 * Extracts and saves current state before switching profiles
 * @returns {Promise<Object>} Result with success status
 */
export async function switchProfileWithSave() {
  try {
    debugLog?.info('[PROFILE-STATE] Switching profile with state save', {
      module: 'profile-state',
      function: 'switchProfileWithSave'
    });
    
    // PROTECTION: Never extract/save during restoration/initialization
    if (window.isRestoringProfileState) {
      debugLog?.warn('[PROFILE-STATE] Skipping state save during profile switch - restoration in progress', {
        module: 'profile-state',
        function: 'switchProfileWithSave',
        reason: 'restoration_lock_active'
      });
      // Continue with switch - don't block the switch
      await window.secureElectronAPI.profile.switchProfile();
      return { success: true, skipped: true };
    }
    
    // Extract current state
    const state = extractProfileState();
    
    // Calculate state contents for logging
    const hotkeyCount = state.hotkeys.reduce((sum, tab) => sum + Object.keys(tab.hotkeys).length, 0);
    const holdingTankCount = state.holdingTank.reduce((sum, tab) => sum + tab.songIds.length, 0);
    
    debugLog?.info('[PROFILE-STATE] State extracted, saving before switch', {
      module: 'profile-state',
      function: 'switchProfileWithSave',
      hotkeyTabs: state.hotkeys?.length || 0,
      holdingTankTabs: state.holdingTank?.length || 0,
      hotkeyCount: hotkeyCount,
      holdingTankCount: holdingTankCount
    });
    
    // Get current profile name for explicit saving
    const currentProfileResult = await window.secureElectronAPI.profile.getCurrent();
    const currentProfile = currentProfileResult?.profile || 'unknown';

    // Save state explicitly before switching
    const saveResult = await window.secureElectronAPI.profile.saveStateBeforeSwitch(state, currentProfile);

    if (!saveResult.success) {
      debugLog?.error('[PROFILE-STATE] Failed to save state before switch', {
        module: 'profile-state',
        function: 'switchProfileWithSave',
        profile: currentProfile,
        error: saveResult.error
      });
      // Continue with switch anyway - better to switch than to block
    } else {
      debugLog?.info('[PROFILE-STATE] State saved successfully before switch', {
        module: 'profile-state',
        function: 'switchProfileWithSave',
        profile: currentProfile
      });
    }
    
    // Now switch profiles (this will close the window and relaunch)
    await window.secureElectronAPI.profile.switchProfile();
    window.secureElectronAPI?.analytics?.trackEvent?.('profile_switched');

    return { success: true };
  } catch (error) {
    debugLog?.error('[PROFILE-STATE] Error during profile switch', {
      module: 'profile-state',
      function: 'switchProfileWithSave',
      error: error.message
    });
    return { success: false, error: error.message };
  }
}

/**
 * Initialize profile state persistence
 * Sets up auto-save on window close
 * @param {Object} options - Initialization options
 * @param {Object} options.hotkeysModule - Reference to hotkeys module
 * @param {Object} options.holdingTankModule - Reference to holding tank module
 * @returns {Object} Module interface
 */
export function initializeProfileState({ hotkeysModule, holdingTankModule } = {}) {
  debugLog?.info('[PROFILE-STATE] Initializing profile state persistence', { 
    module: 'profile-state',
    function: 'initializeProfileState'
  });
  
  // Store module references for auto-save
  if (hotkeysModule) _hotkeysModuleRef = hotkeysModule;
  if (holdingTankModule) _holdingTankModuleRef = holdingTankModule;
  
  // Save state before window closes (for quit, not for profile switch)
  // Note: beforeunload cannot reliably delay window close for async operations in Electron
  // The main process will handle waiting for the save to complete
  window.addEventListener('beforeunload', (_event) => {
    debugLog?.info('[PROFILE-STATE] Window closing, extracting profile state for save', { 
      module: 'profile-state',
      function: 'beforeunload'
    });
    
    // PROTECTION: Never save during restoration/initialization
    if (window.isRestoringProfileState) {
      debugLog?.warn('[PROFILE-STATE] Skipping save on window close - restoration in progress', {
        module: 'profile-state',
        function: 'beforeunload',
        reason: 'restoration_lock_active'
      });
      return;
    }
    
    // Extract state immediately (synchronous) - this is fast
    const state = extractProfileState();
    
    // Store state for main process to save (main process will wait for save to complete)
    window._pendingProfileStateSave = state;
    
    // Send message to main process that we have state ready to save
    // Main process will wait for the save to complete before allowing window to close
    if (window.secureElectronAPI && window.secureElectronAPI.profile) {
      // Fire and forget - main process will handle waiting
      window.secureElectronAPI.profile.getCurrent().then(currentProfileResult => {
        const currentProfile = currentProfileResult?.profile || 'unknown';
        return window.secureElectronAPI.profile.saveState(state, currentProfile);
      }).catch(err => {
        debugLog?.error('[PROFILE-STATE] Failed to save state on quit', {
          module: 'profile-state',
          function: 'beforeunload',
          error: err.message
        });
      });
    }
  });
  
  return {
    extractProfileState,
    saveProfileState,
    loadProfileState,
    switchProfileWithSave,
    clearProfileRestorationLock
  };
}

export default {
  initializeProfileState,
  extractProfileState,
  saveProfileState,
  loadProfileState,
  switchProfileWithSave,
  clearProfileRestorationLock
};
