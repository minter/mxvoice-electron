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
} catch (error) {
  // Debug logger not available
}

// Store module references for auto-save
let hotkeysModuleRef = null;
let holdingTankModuleRef = null;

/**
 * Extract all hotkey tabs state
 * @returns {Array} Array of hotkey tab states
 */
function extractHotkeyTabs() {
  const tabs = [];
  
  debugLog?.info('[PROFILE-STATE] Starting hotkey tabs extraction', {
    module: 'profile-state',
    function: 'extractHotkeyTabs'
  });
  
  // Iterate through all 5 hotkey tabs
  for (let tabNum = 1; tabNum <= 5; tabNum++) {
    const tabContent = document.getElementById(`hotkeys_list_${tabNum}`);
    const tabLink = document.querySelector(`#hotkey_tabs .nav-item:nth-child(${tabNum}) a`);
    
    debugLog?.info(`[PROFILE-STATE] Checking hotkey tab ${tabNum}`, {
      module: 'profile-state',
      function: 'extractHotkeyTabs',
      tabNum,
      hasTabContent: !!tabContent,
      hasTabLink: !!tabLink,
      tabContentId: tabContent?.id
    });
    
    if (!tabContent || !tabLink) {
      debugLog?.warn(`[PROFILE-STATE] Missing hotkey tab elements for tab ${tabNum}`, {
        module: 'profile-state',
        function: 'extractHotkeyTabs',
        tabNum,
        hasTabContent: !!tabContent,
        hasTabLink: !!tabLink
      });
      continue;
    }
    
    const hotkeys = {};
    let hasData = false;
    
    // Extract all 12 hotkeys from this tab
    for (let key = 1; key <= 12; key++) {
      const element = tabContent.querySelector(`#f${key}_hotkey`);
      if (element) {
        const songId = element.getAttribute('songid');
        if (songId) {
          hotkeys[`f${key}`] = songId;
          hasData = true;
          debugLog?.info(`[PROFILE-STATE] Found hotkey data: f${key} = ${songId}`, {
            module: 'profile-state',
            function: 'extractHotkeyTabs',
            tabNum,
            key: `f${key}`,
            songId
          });
        } else {
          debugLog?.info(`[PROFILE-STATE] No songId attribute on f${key}`, {
            module: 'profile-state',
            function: 'extractHotkeyTabs',
            tabNum,
            key: `f${key}`,
            hasElement: !!element,
            elementId: element.id
          });
        }
      } else {
        debugLog?.warn(`[PROFILE-STATE] Hotkey element not found: f${key}`, {
          module: 'profile-state',
          function: 'extractHotkeyTabs',
          tabNum,
          key: `f${key}`,
          selector: `#f${key}_hotkey`
        });
      }
    }
    
    // Get tab name (if customized, otherwise it's just the number)
    const tabName = tabLink.textContent.trim();
    const isCustomName = !/^\d$/.test(tabName); // Not just a number
    
    debugLog?.info(`[PROFILE-STATE] Extracted tab ${tabNum}`, {
      module: 'profile-state',
      function: 'extractHotkeyTabs',
      tabNum,
      tabName,
      isCustomName,
      hotkeyCount: Object.keys(hotkeys).length,
      hasData
    });
    
    tabs.push({
      tabNumber: tabNum,
      tabName: isCustomName ? tabName : null,
      hotkeys: hasData ? hotkeys : {}
    });
  }
  
  debugLog?.info('[PROFILE-STATE] Hotkey extraction complete', {
    module: 'profile-state',
    function: 'extractHotkeyTabs',
    totalTabs: tabs.length,
    tabsWithData: tabs.filter(t => Object.keys(t.hotkeys).length > 0).length
  });
  
  return tabs;
}

/**
 * Extract all soundboard tabs state
 * @returns {Array} Array of soundboard tab states
 */
function extractSoundboardTabs() {
  const tabs = [];
  
  debugLog?.info('[PROFILE-STATE] Starting soundboard tabs extraction', {
    module: 'profile-state',
    function: 'extractSoundboardTabs'
  });
  
  // Iterate through all 5 soundboard tabs
  for (let tabNum = 1; tabNum <= 5; tabNum++) {
    const tabContent = document.getElementById(`soundboard_list_${tabNum}`);
    const tabLink = document.querySelector(`#soundboard_tabs .nav-item:nth-child(${tabNum}) a`);
    const gridContainer = document.getElementById(`soundboard-grid-${tabNum}`);
    
    debugLog?.info(`[PROFILE-STATE] Checking soundboard tab ${tabNum}`, {
      module: 'profile-state',
      function: 'extractSoundboardTabs',
      tabNum,
      hasTabContent: !!tabContent,
      hasTabLink: !!tabLink,
      hasGridContainer: !!gridContainer
    });
    
    if (!tabContent || !tabLink || !gridContainer) {
      debugLog?.warn(`[PROFILE-STATE] Missing soundboard tab elements for tab ${tabNum}`, {
        module: 'profile-state',
        function: 'extractSoundboardTabs',
        tabNum,
        hasTabContent: !!tabContent,
        hasTabLink: !!tabLink,
        hasGridContainer: !!gridContainer
      });
      continue;
    }
    
    const buttons = {};
    let hasData = false;
    
    // Extract all buttons from this tab's grid
    const buttonElements = gridContainer.querySelectorAll('.soundboard-button');
    buttonElements.forEach((button) => {
      const songId = button.getAttribute('songid');
      if (songId) {
        const position = button.getAttribute('data-button-index');
        if (position !== null) {
          // Calculate row-col from index
          const index = parseInt(position, 10);
          const columns = parseInt(getComputedStyle(gridContainer).getPropertyValue('--grid-columns')) || 6;
          const row = Math.floor(index / columns);
          const col = index % columns;
          const key = `${row}-${col}`;
          buttons[key] = songId;
          hasData = true;
        }
      }
    });
    
    // Get tab name (if customized)
    const tabName = tabLink.textContent.trim();
    const isCustomName = !/^\d$/.test(tabName);
    
    debugLog?.info(`[PROFILE-STATE] Extracted soundboard tab ${tabNum}`, {
      module: 'profile-state',
      function: 'extractSoundboardTabs',
      tabNum,
      tabName,
      isCustomName,
      buttonCount: Object.keys(buttons).length,
      hasData
    });
    
    tabs.push({
      tabNumber: tabNum,
      tabName: isCustomName ? tabName : null,
      buttons: hasData ? buttons : {}
    });
  }
  
  debugLog?.info('[PROFILE-STATE] Soundboard extraction complete', {
    module: 'profile-state',
    function: 'extractSoundboardTabs',
    totalTabs: tabs.length,
    tabsWithData: tabs.filter(t => Object.keys(t.buttons).length > 0).length
  });
  
  return tabs;
}

/**
 * Extract all holding tank tabs state
 * @returns {Array} Array of holding tank tab states
 */
function extractHoldingTankTabs() {
  const tabs = [];
  
  // Iterate through all 5 holding tank tabs
  for (let tabNum = 1; tabNum <= 5; tabNum++) {
    const tabContent = document.getElementById(`holding_tank_${tabNum}`);
    const tabLink = document.querySelector(`#holding_tank_tabs .nav-item:nth-child(${tabNum}) a`);
    
    if (!tabContent || !tabLink) {
      debugLog?.warn('[PROFILE-STATE] Missing holding tank tab elements', {
        module: 'profile-state',
        function: 'extractHoldingTankTabs',
        tabNum: tabNum,
        hasContent: !!tabContent,
        hasLink: !!tabLink
      });
      continue;
    }
    
    const songIds = [];
    
    // Extract all songs from this tab
    const songElements = tabContent.querySelectorAll('li.list-group-item[songid]');
    
    debugLog?.info('[PROFILE-STATE] Extracting holding tank tab', {
      module: 'profile-state',
      function: 'extractHoldingTankTabs',
      tabNum: tabNum,
      songCount: songElements.length,
      contentId: tabContent.id
    });
    
    songElements.forEach(element => {
      const songId = element.getAttribute('songid');
      if (songId) {
        songIds.push(songId);
      }
    });
    
    // Get tab name (if customized)
    const tabName = tabLink.textContent.trim();
    const isCustomName = !/^\d$/.test(tabName);
    
    tabs.push({
      tabNumber: tabNum,
      tabName: isCustomName ? tabName : null,
      songIds: songIds
    });
  }
  
  return tabs;
}

/**
 * Extract complete profile state
 * @returns {Object} Complete state object
 */
export function extractProfileState() {
  debugLog?.info('[PROFILE-STATE] === STARTING COMPLETE STATE EXTRACTION ===', { 
    module: 'profile-state',
    function: 'extractProfileState'
  });
  
  const state = {
    version: '1.0.0',
    timestamp: Date.now(),
    hotkeys: extractHotkeyTabs(),
    holdingTank: extractHoldingTankTabs(),
    soundboard: extractSoundboardTabs()
  };
  
    // Calculate actual data counts for debugging
    const hotkeyCount = state.hotkeys.reduce((sum, tab) => sum + Object.keys(tab.hotkeys).length, 0);
    const holdingTankCount = state.holdingTank.reduce((sum, tab) => sum + tab.songIds.length, 0);
    const soundboardCount = state.soundboard.reduce((sum, tab) => sum + Object.keys(tab.buttons).length, 0);
  
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
    debugLog?.warn('[PROFILE-STATE] Extracted state is empty - DOM may not be ready or data may have been cleared', {
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
 * IMPORTANT: This function takes NO parameters. It always extracts state from the DOM.
 * Do not pass hotkeysModule or holdingTankModule - they are ignored.
 * 
 * CRITICAL DATA PROTECTION:
 * - Will NOT save if restoration is in progress (extended lock covers full app init)
 * - Creates backup of existing state before overwriting
 * 
 * @returns {Promise<Object>} Result with success status
 */
export async function saveProfileState() {
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
    
    // Get profile-specific directory
    const result = await window.secureElectronAPI.profile.getDirectory('state');
    if (!result.success) {
      throw new Error(result.error || 'Failed to get profile directory');
    }
    
    const stateDir = result.directory;
    const stateFileResult = await window.secureElectronAPI.path.join(stateDir, 'state.json');
    const stateFile = stateFileResult.success ? stateFileResult.data : null;
    
    if (!stateFile) {
      throw new Error('Failed to build state file path');
    }
    
    // Ensure directory exists
    await window.secureElectronAPI.fileSystem.mkdir(stateDir);
    
    // BACKUP: Always backup existing state before overwriting
    const existsResult = await window.secureElectronAPI.fileSystem.exists(stateFile);
    if (existsResult.success && existsResult.data) {
      const backupFileResult = await window.secureElectronAPI.path.join(stateDir, 'state.json.backup');
      if (backupFileResult.success) {
        const backupFile = backupFileResult.data;
        const readResult = await window.secureElectronAPI.fileSystem.read(stateFile);
        if (readResult.success && readResult.data) {
          await window.secureElectronAPI.fileSystem.write(backupFile, readResult.data);
          debugLog?.info('[PROFILE-STATE] Created backup of existing state', {
            module: 'profile-state',
            function: 'saveProfileState',
            backupFile: backupFile
          });
        }
      }
    }
    
    // Write state file
    const writeResult = await window.secureElectronAPI.fileSystem.write(
      stateFile,
      JSON.stringify(state, null, 2)
    );
    
    if (writeResult.success) {
      debugLog?.info('[PROFILE-STATE] Profile state saved successfully', { 
        module: 'profile-state',
        function: 'saveProfileState',
        stateFile: stateFile,
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
 * Restore hotkey tabs from state
 * @param {Array} hotkeyTabs - Array of hotkey tab states
 * @param {Object} hotkeysModule - Hotkeys module instance
 * @returns {Promise<void>}
 */
async function restoreHotkeyTabs(hotkeyTabs, hotkeysModule) {
  debugLog?.info('[PROFILE-STATE] restoreHotkeyTabs called', {
    module: 'profile-state',
    function: 'restoreHotkeyTabs',
    tabCount: hotkeyTabs?.length || 0
  });
  
  if (!hotkeyTabs || !Array.isArray(hotkeyTabs)) {
    debugLog?.warn('[PROFILE-STATE] Invalid hotkey tabs data', {
      module: 'profile-state',
      function: 'restoreHotkeyTabs'
    });
    return;
  }
  
  for (const tabState of hotkeyTabs) {
    const { tabNumber, tabName, hotkeys } = tabState;
    
    if (!hotkeys || Object.keys(hotkeys).length === 0) {
      debugLog?.info('[PROFILE-STATE] Skipping empty hotkey tab', {
        module: 'profile-state',
        function: 'restoreHotkeyTabs',
        tabNumber: tabNumber,
        tabName: tabName
      });
      continue;
    }
    
    debugLog?.info('[PROFILE-STATE] Restoring hotkey tab', {
      module: 'profile-state',
      function: 'restoreHotkeyTabs',
      tabNumber: tabNumber,
      tabName: tabName,
      hotkeyCount: Object.keys(hotkeys).length
    });
    
    // Switch to this tab
    const tabLink = document.querySelector(`#hotkey_tabs .nav-item:nth-child(${tabNumber}) a`);
    if (tabLink) {
      tabLink.click();
      
      // Wait a bit for tab to activate
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Set custom tab name if exists
      if (tabName) {
        tabLink.textContent = tabName;
      }
      
      // Restore each hotkey in this tab directly (without relying on .active class)
      for (const [key, songId] of Object.entries(hotkeys)) {
        debugLog?.info('[PROFILE-STATE] Restoring hotkey', {
          module: 'profile-state',
          function: 'restoreHotkeyTabs',
          tabNumber: tabNumber,
          key: key,
          songId: songId
        });
        try {
          // Validate that song still exists in database and get its info
          const songResult = await window.secureElectronAPI.database.query(
            'SELECT * FROM mrvoice WHERE id = ?',
            [songId]
          );
          
          if (songResult.success && songResult.data && songResult.data.length > 0) {
            const row = songResult.data[0];
            const title = row.title || '[Unknown Title]';
            const artist = row.artist || '[Unknown Artist]';
            const time = row.time || '[??:??]';
            
            // Find the element in this specific tab (not relying on .active)
            const tabContent = document.getElementById(`hotkeys_list_${tabNumber}`);
            const element = tabContent?.querySelector(`#${key}_hotkey`);
            
            if (element) {
              // Set the songid attribute
              element.setAttribute('songid', songId);
              
              // Set the label text directly
              const span = element.querySelector('span');
              if (span) {
                span.textContent = `${title} by ${artist} (${time})`;
              }
              
              debugLog?.info('[PROFILE-STATE] Hotkey restored successfully', {
                module: 'profile-state',
                function: 'restoreHotkeyTabs',
                tabNumber: tabNumber,
                key: key,
                songId: songId,
                title: title
              });
            } else {
              debugLog?.warn('[PROFILE-STATE] Hotkey element not found', {
                module: 'profile-state',
                function: 'restoreHotkeyTabs',
                tabNumber: tabNumber,
                key: key,
                elementId: `${key}_hotkey`,
                tabContentId: `hotkeys_list_${tabNumber}`
              });
            }
          } else {
            debugLog?.warn('[PROFILE-STATE] Skipping deleted song in hotkey restore', { 
              module: 'profile-state',
              function: 'restoreHotkeyTabs',
              songId: songId,
              key: key
            });
          }
        } catch (error) {
          debugLog?.error('[PROFILE-STATE] Error restoring hotkey', { 
            module: 'profile-state',
            function: 'restoreHotkeyTabs',
            key: key,
            songId: songId,
            error: error.message
          });
        }
      }
    }
  }
  
  // Switch back to first tab
  const firstTab = document.querySelector('#hotkey_tabs .nav-item:first-child a');
  if (firstTab) {
    firstTab.click();
  }
  
  debugLog?.info('[PROFILE-STATE] Hotkey restoration complete', {
    module: 'profile-state',
    function: 'restoreHotkeyTabs'
  });
}

/**
 * Restore holding tank tabs from state
 * @param {Array} holdingTankTabs - Array of holding tank tab states
 * @param {Object} holdingTankModule - Holding tank module instance
 * @returns {Promise<void>}
 */
async function restoreHoldingTankTabs(holdingTankTabs, holdingTankModule) {
  debugLog?.info('[PROFILE-STATE] restoreHoldingTankTabs called', {
    module: 'profile-state',
    function: 'restoreHoldingTankTabs',
    tabCount: holdingTankTabs?.length || 0
  });
  
  if (!holdingTankTabs || !Array.isArray(holdingTankTabs)) {
    debugLog?.warn('[PROFILE-STATE] Invalid holding tank tabs data', {
      module: 'profile-state',
      function: 'restoreHoldingTankTabs'
    });
    return;
  }
  
  for (const tabState of holdingTankTabs) {
    const { tabNumber, tabName, songIds } = tabState;
    
    if (!songIds || songIds.length === 0) continue;
    
    // Switch to this tab
    const tabLink = document.querySelector(`#holding_tank_tabs .nav-item:nth-child(${tabNumber}) a`);
    if (tabLink) {
      tabLink.click();
      
      // Wait a bit for tab to activate
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Set custom tab name if exists
      if (tabName) {
        tabLink.textContent = tabName;
      }
      
      // Clear current tab content
      const tabContent = document.getElementById(`holding_tank_${tabNumber}`);
      if (tabContent) {
        tabContent.innerHTML = '';
      }
      
      // Restore each song in order by building DOM directly (avoids triggering saves)
      for (const songId of songIds) {
        try {
          // Validate that song still exists in database and get its info
          const songResult = await window.secureElectronAPI.database.query(
            'SELECT * FROM mrvoice WHERE id = ?',
            [songId]
          );
          
          if (songResult.success && songResult.data && songResult.data.length > 0) {
            const row = songResult.data[0];
            const title = row.title || '[Unknown Title]';
            const artist = row.artist || '[Unknown Artist]';
            const time = row.time || '[??:??]';
            
            // Build DOM element directly (like addToHoldingTank but without the save)
            const song_row = document.createElement('li');
            song_row.style.fontSize = '11px';
            song_row.className = 'song list-group-item context-menu';
            song_row.setAttribute('draggable', 'true');
            song_row.setAttribute('songid', songId);
            song_row.textContent = `${title} by ${artist} (${time})`;
            
            // Add drag event listener
            song_row.addEventListener('dragstart', (e) => {
              e.dataTransfer.setData('text', songId);
            });
            
            // Append to tab content
            if (tabContent) {
              tabContent.appendChild(song_row);
            }
            
            debugLog?.info('[PROFILE-STATE] Holding tank song restored successfully', {
              module: 'profile-state',
              function: 'restoreHoldingTankTabs',
              tabNumber: tabNumber,
              songId: songId,
              title: title
            });
          } else {
            debugLog?.warn('[PROFILE-STATE] Skipping deleted song in holding tank restore', { 
              module: 'profile-state',
              function: 'restoreHoldingTankTabs',
              songId: songId
            });
          }
        } catch (error) {
          debugLog?.error('[PROFILE-STATE] Error restoring holding tank song', { 
            module: 'profile-state',
            function: 'restoreHoldingTankTabs',
            songId: songId,
            error: error.message
          });
        }
      }
    }
  }
  
  // Switch back to first tab
  const firstTab = document.querySelector('#holding_tank_tabs .nav-item:first-child a');
  if (firstTab) {
    firstTab.click();
  }
  
  debugLog?.info('[PROFILE-STATE] Holding tank restoration complete', {
    module: 'profile-state',
    function: 'restoreHoldingTankTabs'
  });
}

/**
 * Restore soundboard tabs from state
 * @param {Array} soundboardTabs - Array of soundboard tab states
 * @param {Object} soundboardModule - Soundboard module instance
 * @returns {Promise<void>}
 */
export async function restoreSoundboardTabs(soundboardTabs, soundboardModule) {
  if (!soundboardTabs || !Array.isArray(soundboardTabs)) {
    debugLog?.warn('[PROFILE-STATE] Invalid soundboard tabs data', {
      module: 'profile-state',
      function: 'restoreSoundboardTabs'
    });
    return;
  }
  
  debugLog?.info('[PROFILE-STATE] Restoring soundboard tabs', {
    module: 'profile-state',
    function: 'restoreSoundboardTabs',
    tabCount: soundboardTabs.length
  });
  
  for (const tab of soundboardTabs) {
    const tabNumber = tab.tabNumber;
    const tabContent = document.getElementById(`soundboard_list_${tabNumber}`);
    const tabLink = document.querySelector(`#soundboard_tabs .nav-item:nth-child(${tabNumber}) a`);
    const gridContainer = document.getElementById(`soundboard-grid-${tabNumber}`);
    
    if (!tabContent || !tabLink || !gridContainer) {
      debugLog?.warn('[PROFILE-STATE] Missing soundboard tab elements', {
        module: 'profile-state',
        function: 'restoreSoundboardTabs',
        tabNumber,
        hasTabContent: !!tabContent,
        hasTabLink: !!tabLink,
        hasGridContainer: !!gridContainer
      });
      continue;
    }
    
    // Set custom tab name if exists
    const tabName = tab.tabName;
    if (tabName) {
      tabLink.textContent = tabName;
    }
    
    // Restore each button in this tab
    for (const [position, songId] of Object.entries(tab.buttons || {})) {
      debugLog?.info('[PROFILE-STATE] Restoring soundboard button', {
        module: 'profile-state',
        function: 'restoreSoundboardTabs',
        tabNumber,
        position,
        songId
      });
      
      try {
        // Validate that song still exists in database
        const songResult = await window.secureElectronAPI.database.query(
          'SELECT * FROM mrvoice WHERE id = ?',
          [songId]
        );
        
        if (songResult.success && songResult.data && songResult.data.length > 0) {
          const row = songResult.data[0];
          
          // Find button by position
          const [rowNum, colNum] = position.split('-').map(Number);
          const columns = parseInt(getComputedStyle(gridContainer).getPropertyValue('--grid-columns')) || 6;
          const buttonIndex = rowNum * columns + colNum;
          const button = gridContainer.querySelector(`.soundboard-button[data-button-index="${buttonIndex}"]`);
          
          if (button && soundboardModule && typeof soundboardModule.setLabelFromSongId === 'function') {
            await soundboardModule.setLabelFromSongId(songId, button);
            
            debugLog?.info('[PROFILE-STATE] Soundboard button restored successfully', {
              module: 'profile-state',
              function: 'restoreSoundboardTabs',
              tabNumber,
              position,
              songId,
              title: row.title
            });
          } else {
            debugLog?.warn('[PROFILE-STATE] Soundboard button element not found or module method unavailable', {
              module: 'profile-state',
              function: 'restoreSoundboardTabs',
              tabNumber,
              position,
              buttonIndex,
              hasButton: !!button,
              hasModule: !!soundboardModule
            });
          }
        } else {
          debugLog?.warn('[PROFILE-STATE] Skipping deleted song in soundboard restore', { 
            module: 'profile-state',
            function: 'restoreSoundboardTabs',
            songId,
            position
          });
        }
      } catch (error) {
        debugLog?.error('[PROFILE-STATE] Error restoring soundboard button', { 
          module: 'profile-state',
          function: 'restoreSoundboardTabs',
          position,
          songId,
          error: error.message
        });
      }
    }
  }
  
  // Switch back to first tab
  const firstTab = document.querySelector('#soundboard_tabs .nav-item:first-child a');
  if (firstTab) {
    firstTab.click();
  }
  
  debugLog?.info('[PROFILE-STATE] Soundboard restoration complete', {
    module: 'profile-state',
    function: 'restoreSoundboardTabs'
  });
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
    
    // Set restoration lock to prevent saves during DOM restoration
    window.isRestoringProfileState = true;
    
    // Get current profile name for logging
    const currentProfileResult = await window.secureElectronAPI.profile.getCurrent();
    const currentProfile = currentProfileResult?.profile || 'unknown';
    
    debugLog?.info('[PROFILE-STATE] Starting profile state load (restoration lock enabled)', { 
      module: 'profile-state',
      function: 'loadProfileState',
      profile: currentProfile
    });
    
    // Get profile-specific directory
    const dirResult = await window.secureElectronAPI.profile.getDirectory('state');
    if (!dirResult.success) {
      window.isRestoringProfileState = false;
      debugLog?.info('[PROFILE-STATE] No profile directory found, skipping state load', { 
        module: 'profile-state',
        function: 'loadProfileState',
        profile: currentProfile
      });
      return { success: true, loaded: false };
    }
    
    const stateDir = dirResult.directory;
    debugLog?.info('[PROFILE-STATE] Profile directory found', { 
      module: 'profile-state',
      function: 'loadProfileState',
      profile: currentProfile,
      stateDir
    });
    
    const stateFileResult = await window.secureElectronAPI.path.join(stateDir, 'state.json');
    const stateFile = stateFileResult.success ? stateFileResult.data : null;
    
    if (!stateFile) {
      window.isRestoringProfileState = false;
      debugLog?.error('[PROFILE-STATE] Failed to build state file path', {
        module: 'profile-state',
        function: 'loadProfileState',
        profile: currentProfile,
        error: stateFileResult.error
      });
      return { success: false, error: 'Failed to build state file path' };
    }
    
    debugLog?.info('[PROFILE-STATE] Checking for state file', { 
      module: 'profile-state',
      function: 'loadProfileState',
      profile: currentProfile,
      stateFile
    });
    
    // Check if state file exists
    const existsResult = await window.secureElectronAPI.fileSystem.exists(stateFile);
    if (!existsResult.success || !existsResult.exists) {
      window.isRestoringProfileState = false;
      debugLog?.info('[PROFILE-STATE] No state file found, starting fresh', { 
        module: 'profile-state',
        function: 'loadProfileState',
        profile: currentProfile,
        stateFile: stateFile,
        existsResult: existsResult
      });
      return { success: true, loaded: false };
    }
    
    debugLog?.info('[PROFILE-STATE] State file exists, reading contents', { 
      module: 'profile-state',
      function: 'loadProfileState',
      profile: currentProfile,
      stateFile
    });
    
    // Read state file
    const readResult = await window.secureElectronAPI.fileSystem.read(stateFile);
    if (!readResult.success) {
      throw new Error(readResult.error || 'Failed to read state file');
    }
    
    // Handle empty or invalid state files
    if (!readResult.data || readResult.data.trim() === '') {
      window.isRestoringProfileState = false;
      debugLog?.warn('[PROFILE-STATE] State file is empty, treating as no state', {
        module: 'profile-state',
        function: 'loadProfileState',
        stateFile: stateFile
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
    
    // Ensure soundboard array exists
    if (!Array.isArray(state.soundboard)) {
      debugLog?.warn('[PROFILE-STATE] State missing soundboard array, initializing empty', {
        module: 'profile-state',
        function: 'loadProfileState'
      });
      state.soundboard = [];
    }
    
    // Validate that state has some content (not completely empty)
    const hasHotkeys = state.hotkeys.some(tab => tab.hotkeys && Object.keys(tab.hotkeys).length > 0);
    const hasHoldingTank = state.holdingTank.some(tab => tab.songIds && tab.songIds.length > 0);
    const hasSoundboard = state.soundboard.some(tab => tab.buttons && Object.keys(tab.buttons).length > 0);
    
    if (!hasHotkeys && !hasHoldingTank && !hasSoundboard) {
      debugLog?.warn('[PROFILE-STATE] State file exists but contains no data (empty profile)', {
        module: 'profile-state',
        function: 'loadProfileState',
        profile: currentProfile,
        stateFile
      });
      // Still return success but mark as not loaded so UI shows empty state
      window.isRestoringProfileState = false;
      return { success: true, loaded: false };
    }
    
    debugLog?.info('[PROFILE-STATE] Loaded profile state', { 
      module: 'profile-state',
      function: 'loadProfileState',
      profile: currentProfile,
      stateFile,
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
      await restoreHotkeyTabs(state.hotkeys, hotkeysModule);
    } else {
      debugLog?.warn('[PROFILE-STATE] Skipping hotkey restore', {
        module: 'profile-state',
        function: 'loadProfileState',
        hasHotkeys: !!state.hotkeys,
        hasModule: !!hotkeysModule
      });
    }
    
    // Restore soundboard
    if (state.soundboard && window.moduleRegistry?.soundboard) {
      debugLog?.info('[PROFILE-STATE] Restoring soundboard from state', { 
        module: 'profile-state',
        function: 'loadProfileState',
        tabCount: state.soundboard.length
      });
      await restoreSoundboardTabs(state.soundboard, window.moduleRegistry.soundboard);
    } else {
      debugLog?.warn('[PROFILE-STATE] Skipping soundboard restore', {
        module: 'profile-state',
        function: 'loadProfileState',
        hasSoundboard: !!state.soundboard,
        hasModule: !!window.moduleRegistry?.soundboard
      });
    }
    
    // Restore holding tank
    if (state.holdingTank && holdingTankModule) {
      debugLog?.info('[PROFILE-STATE] Restoring holding tank from state', { 
        module: 'profile-state',
        function: 'loadProfileState',
        tabCount: state.holdingTank.length
      });
      await restoreHoldingTankTabs(state.holdingTank, holdingTankModule);
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
  if (hotkeysModule) hotkeysModuleRef = hotkeysModule;
  if (holdingTankModule) holdingTankModuleRef = holdingTankModule;
  
  // Save state before window closes (for quit, not for profile switch)
  // Note: beforeunload cannot reliably delay window close for async operations in Electron
  // The main process will handle waiting for the save to complete
  window.addEventListener('beforeunload', (event) => {
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
    clearProfileRestorationLock,
    restoreSoundboardTabs
  };
}

export default {
  initializeProfileState,
  extractProfileState,
  saveProfileState,
  loadProfileState,
  switchProfileWithSave,
  clearProfileRestorationLock,
  restoreSoundboardTabs
};

