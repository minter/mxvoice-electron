/**
 * Profile State Persistence Module
 *
 * Serializes the live layout and writes it to the show session's
 * crash-recovery record:
 * - All hotkey tabs (song IDs + custom tab names)
 * - All holding tank tabs (song IDs + custom tab names)
 * - The selected hotkey and holding tank tabs
 *
 * Saved shows are opened by the shows module at startup; nothing here
 * writes a saved show. A clean quit discards the record, a crash offers it
 * back.
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
 * Number of the active tab in a tab strip, from its link's href
 * ('#hotkeys_list_3' -> 3). 1 when it can't be read.
 */
function activeTabNumber(tabsSelector) {
  try {
    const href = globalThis.document?.querySelector?.(`${tabsSelector} a.nav-link.active`)?.getAttribute('href') || '';
    const number = Number(href.match(/_(\d+)$/)?.[1]);
    return Number.isInteger(number) && number >= 1 && number <= 5 ? number : 1;
  } catch {
    return 1;
  }
}

/**
 * Extract the live layout
 * @returns {{ hotkeys: Array, holdingTank: Array, selected: { hotkeyTab: number, holdingTankTab: number } }}
 */
export function extractLayout() {
  debugLog?.info('[PROFILE-STATE] === STARTING COMPLETE STATE EXTRACTION ===', { 
    module: 'profile-state',
    function: 'extractLayout'
  });
  
  const hotkeySnapshot = _hotkeysModuleRef?.getHotkeySnapshot?.();
  const holdingTankSnapshot = _holdingTankModuleRef?.getHoldingTankSnapshot?.();
  const state = {
    hotkeys: hotkeySnapshot || [],
    holdingTank: holdingTankSnapshot || [],
    selected: {
      hotkeyTab: activeTabNumber('#hotkey_tabs'),
      holdingTankTab: activeTabNumber('#holding_tank_tabs')
    }
  };
  
  // Calculate actual data counts for debugging
  const hotkeyCount = state.hotkeys.reduce((sum, tab) => sum + Object.keys(tab.hotkeys).length, 0);
  const holdingTankCount = state.holdingTank.reduce((sum, tab) => sum + tab.songIds.length, 0);
  
  debugLog?.info('[PROFILE-STATE] Extracted profile state - SUMMARY', { 
    module: 'profile-state',
    function: 'extractLayout',
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
      function: 'extractLayout'
    });
  }
  
  debugLog?.info('[PROFILE-STATE] === STATE EXTRACTION COMPLETE ===', { 
    module: 'profile-state',
    function: 'extractLayout',
    selected: state.selected
  });
  
  return state;
}

/**
 * Save the live layout to the crash-recovery record (debounced)
 * 
 * IMPORTANT: This function takes no parameters. It serializes the initialized collection models.
 * 
 * CRITICAL DATA PROTECTION:
 * - Will NOT save if restoration is in progress (the lock covers opening the show)
 * - The main process also refuses recovery writes until the show is ready
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

/** Flush any debounced collection save before a lifecycle transition. */
export async function flushProfileState() {
  if (saveDebounceTimer) {
    clearTimeout(saveDebounceTimer);
    saveDebounceTimer = null;
  }
  const resolvers = pendingSaveResolvers.splice(0);
  const result = await _saveProfileStateImmediate();
  resolvers.forEach(resolve => resolve(result));
  return result;
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
    
    const state = extractLayout();
    
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
    
    const writeResult = await window.secureElectronAPI.shows.saveRecovery(state);
    
    // { skipped } (session not ready) and { retired } (matches the saved
    // show) are successes too: a backup's pre-flush must not abort on them
    if (writeResult?.success) {
      debugLog?.info('[PROFILE-STATE] Profile state saved successfully', { 
        module: 'profile-state',
        function: 'saveProfileState',
        profile: 'current',
        hotkeyCount: hotkeyCount,
        holdingTankCount: holdingTankCount,
        hasData: hasData,
        outcome: writeResult.data?.skipped ? 'skipped' : (writeResult.data?.retired ? 'retired' : 'written')
      });
      return { success: true };
    } else {
      throw new Error(writeResult?.error || 'Failed to write the recovery record');
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
 * Clear the profile restoration lock
 * Called by the shows module once the show has been opened and reported
 * This allows recovery saves to proceed normally
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
 * Initialize profile state persistence
 * Stores the collection modules the layout is read from
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
  
  return {
    extractLayout,
    saveProfileState,
    flushProfileState,
    clearProfileRestorationLock
  };
}

export default {
  initializeProfileState,
  extractLayout,
  saveProfileState,
  flushProfileState,
  clearProfileRestorationLock
};
