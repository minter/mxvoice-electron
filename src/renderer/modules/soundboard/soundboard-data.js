/**
 * Soundboard Data Module
 * 
 * Handles data operations for soundboard including:
 * - Save/load from profile state
 * - File import/export operations
 * - Button assignment and label management
 */

let debugLog = null;
try {
  if (window.debugLog) {
    debugLog = window.debugLog;
  }
} catch (error) {
  // Debug logger not available
}

let electronAPI = null;
let soundboardModuleRef = null;

// Import secure adapters
import { secureFileDialog, secureDatabase } from '../adapters/secure-adapter.js';

/**
 * Extract all soundboard tabs state from DOM
 * @returns {Array} Array of soundboard tab states
 */
function extractSoundboardTabs() {
  const tabs = [];
  
  debugLog?.info('Starting soundboard tabs extraction', {
    module: 'soundboard-data',
    function: 'extractSoundboardTabs'
  });
  
  // Iterate through all 5 soundboard tabs
  for (let tabNum = 1; tabNum <= 5; tabNum++) {
    const tabContent = document.getElementById(`soundboard_list_${tabNum}`);
    const tabLink = document.querySelector(`#soundboard_tabs .nav-item:nth-child(${tabNum}) a`);
    const gridContainer = document.getElementById(`soundboard-grid-${tabNum}`);
    
    if (!tabContent || !tabLink || !gridContainer) {
      debugLog?.warn('Missing soundboard tab elements', {
        module: 'soundboard-data',
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
    
    tabs.push({
      tabNumber: tabNum,
      tabName: isCustomName ? tabName : null,
      buttons: hasData ? buttons : {}
    });
  }
  
  debugLog?.info('Soundboard extraction complete', {
    module: 'soundboard-data',
    function: 'extractSoundboardTabs',
    totalTabs: tabs.length,
    tabsWithData: tabs.filter(t => Object.keys(t.buttons).length > 0).length
  });
  
  return tabs;
}

/**
 * Restore soundboard tabs from state
 * @param {Array} tabs - Array of tab states
 */
async function restoreSoundboardTabs(tabs) {
  if (!tabs || !Array.isArray(tabs)) {
    debugLog?.warn('Invalid soundboard tabs data', {
      module: 'soundboard-data',
      function: 'restoreSoundboardTabs'
    });
    return;
  }
  
  debugLog?.info('Restoring soundboard tabs', {
    module: 'soundboard-data',
    function: 'restoreSoundboardTabs',
    tabCount: tabs.length
  });
  
  for (const tab of tabs) {
    const tabContent = document.getElementById(`soundboard_list_${tab.tabNumber}`);
    const tabLink = document.querySelector(`#soundboard_tabs .nav-item:nth-child(${tab.tabNumber}) a`);
    
    if (!tabContent || !tabLink) {
      continue;
    }
    
    // Restore tab name
    if (tab.tabName) {
      tabLink.textContent = tab.tabName;
    }
    
    // Restore buttons
    // Get grid container to calculate button index
    const gridContainer = document.getElementById(`soundboard-grid-${tab.tabNumber}`);
    if (!gridContainer) {
      debugLog?.warn(`Grid container not found for tab ${tab.tabNumber}`, {
        module: 'soundboard-data',
        function: 'restoreSoundboardTabs',
        tabNumber: tab.tabNumber
      });
      continue;
    }
    
    // Get current column count to calculate button index from position
    const columns = parseInt(gridContainer.style.getPropertyValue('--grid-columns')) || 6;
    
    for (const [position, songId] of Object.entries(tab.buttons || {})) {
      // Validate song exists in database using secureDatabase
      const result = await secureDatabase.query(
        'SELECT * FROM mrvoice WHERE id = ?',
        [songId]
      );
      
      if (!result.success || !result.data || result.data.length === 0) {
        debugLog?.warn('Song not found in database, skipping', {
          module: 'soundboard-data',
          function: 'restoreSoundboardTabs',
          songId,
          position
        });
        continue;
      }
      
      // Find button by position - position is stored as "row-col" or as index
      let buttonIndex;
      if (position.includes('-')) {
        // Position is in "row-col" format
        const [row, col] = position.split('-').map(Number);
        buttonIndex = row * columns + col;
      } else {
        // Position is already an index
        buttonIndex = parseInt(position, 10);
      }
      
      const button = gridContainer.querySelector(`.soundboard-button[data-button-index="${buttonIndex}"]`);
      if (button) {
        button.setAttribute('songid', songId);
        // Use the bound method from the module instance
        if (this && typeof this.setLabelFromSongId === 'function') {
          await this.setLabelFromSongId(songId, button);
        } else {
          // Fallback to direct call if not bound
          const soundboard = window.moduleRegistry?.soundboard;
          if (soundboard && typeof soundboard.setLabelFromSongId === 'function') {
            await soundboard.setLabelFromSongId(songId, button);
          }
        }
      } else {
        debugLog?.warn(`Button not found at index ${buttonIndex} for position ${position}`, {
          module: 'soundboard-data',
          function: 'restoreSoundboardTabs',
          tabNumber: tab.tabNumber,
          position,
          buttonIndex,
          columns
        });
      }
    }
  }
}

/**
 * Set label from song ID
 * Updates button label with song information
 * @param {string} songId - Song ID
 * @param {HTMLElement} button - Button element to update
 */
async function setLabelFromSongId(songId, button) {
  // Get electronAPI from the module instance or window
  const api = this?.electronAPI || electronAPI || window.secureElectronAPI;
  
  if (!api?.database) {
    debugLog?.warn('Database not available for setLabelFromSongId', {
      module: 'soundboard-data',
      function: 'setLabelFromSongId'
    });
    return;
  }
  
  try {
    const result = await api.database.query(
      'SELECT * FROM mrvoice WHERE id = ?',
      [songId]
    );
    
    if (result.success && result.data && result.data.length > 0) {
      const row = result.data[0];
      const title = row.title || '[Unknown Title]';
      const artist = row.artist || '[Unknown Artist]';
      const time = row.time || '[??:??]';
      
      // Update button
      button.setAttribute('songid', songId);
      
      // Update button content
      const placeholder = button.querySelector('.soundboard-button-placeholder');
      const songInfo = button.querySelector('.soundboard-button-info');
      
      if (placeholder) {
        placeholder.style.display = 'none';
      }
      
      if (songInfo) {
        songInfo.style.display = 'block';
        songInfo.innerHTML = `
          <div class="soundboard-button-title">${title}</div>
          <div class="soundboard-button-artist">${artist}</div>
          <div class="soundboard-button-time">${time}</div>
        `;
      }
      
      // Save state after assignment
      const soundboard = window.moduleRegistry?.soundboard;
      if (soundboard && typeof soundboard.saveSoundboardToStore === 'function') {
        await soundboard.saveSoundboardToStore();
      }
    } else {
      debugLog?.warn('Song not found in database', {
        module: 'soundboard-data',
        function: 'setLabelFromSongId',
        songId
      });
    }
  } catch (error) {
    debugLog?.error('Error setting label from song ID', {
      module: 'soundboard-data',
      function: 'setLabelFromSongId',
      songId,
      error: error.message
    });
  }
}

/**
 * Save soundboard to store (profile state)
 */
async function saveSoundboardToStore() {
  // Skip save if currently restoring profile state
  if (window.isRestoringProfileState) {
    debugLog?.info('Skipping soundboard save - restoring profile state', {
      module: 'soundboard-data',
      function: 'saveSoundboardToStore'
    });
    return;
  }
  
  // When profiles are active, save to profile state
  if (window.moduleRegistry?.profileState) {
    debugLog?.info('Saving soundboard to profile state', {
      module: 'soundboard-data',
      function: 'saveSoundboardToStore'
    });
    try {
      await window.moduleRegistry.profileState.saveProfileState();
      debugLog?.info('Soundboard saved to profile state successfully', {
        module: 'soundboard-data',
        function: 'saveSoundboardToStore'
      });
    } catch (err) {
      debugLog?.error('Failed to save profile state from soundboard', {
        module: 'soundboard-data',
        function: 'saveSoundboardToStore',
        error: err.message
      });
    }
    return;
  }
}

/**
 * Load soundboard from store
 */
function loadSoundboardFromStore() {
  // When profiles are active, profile-state module handles loading
  // This is a no-op when profile system is active
  const api = window.secureElectronAPI || window.electronAPI || electronAPI;
  if (api && api.profile && typeof api.profile.getCurrent === 'function') {
    debugLog?.info('Profile API detected - skipping legacy soundboard store load', {
      module: 'soundboard-data',
      function: 'loadSoundboardFromStore'
    });
    return;
  }
  
  // Legacy store loading would go here if needed
}

/**
 * Open soundboard file
 * Note: The actual file loading is handled by IPC event 'soundboard_load'
 * This function just triggers the file dialog
 */
async function openSoundboardFile() {
  debugLog?.info('Opening soundboard file dialog', {
    module: 'soundboard-data',
    function: 'openSoundboardFile'
  });
  
  // Hide any visible tooltips before opening file dialog
  if (window.hideAllTooltips) {
    window.hideAllTooltips();
  }
  
  try {
    const result = await secureFileDialog.openSoundboardFile();
    // The main process will send 'soundboard_load' event with the data
    // which is handled by the IPC listener in renderer.js
    if (result && result.success) {
      debugLog?.info('Soundboard file dialog completed', {
        module: 'soundboard-data',
        function: 'openSoundboardFile',
        canceled: result.canceled || false
      });
    }
    return result;
  } catch (error) {
    debugLog?.error('Error opening soundboard file', {
      module: 'soundboard-data',
      function: 'openSoundboardFile',
      error: error.message
    });
    return { success: false, error: error.message };
  }
}

/**
 * Save soundboard file
 */
async function saveSoundboardFile() {
  debugLog?.info('Saving soundboard file', {
    module: 'soundboard-data',
    function: 'saveSoundboardFile'
  });
  
  // Extract current soundboard state
  const tabs = extractSoundboardTabs();
  
  // Build JSON structure
  const soundboardData = {
    version: '1.0.0',
    created: new Date().toISOString(),
    pages: tabs.map(tab => ({
      pageNumber: tab.tabNumber,
      tabName: tab.tabName,
      buttons: tab.buttons
    })),
    metadata: {
      description: '',
      lastModified: new Date().toISOString()
    }
  };
  
  // Use secureFileDialog to save
  try {
    await secureFileDialog.saveSoundboardFile(soundboardData);
    debugLog?.info('Soundboard file saved', {
      module: 'soundboard-data',
      function: 'saveSoundboardFile'
    });
  } catch (error) {
    debugLog?.error('Error saving soundboard file', {
      module: 'soundboard-data',
      function: 'saveSoundboardFile',
      error: error.message
    });
  }
}

/**
 * Clear soundboard (active tab)
 */
function clearSoundboard() {
  // Find the active tab's grid
  const activeTab = document.querySelector('#soundboard_tabs .nav-link.active');
  if (!activeTab) {
    return;
  }

  const href = activeTab.getAttribute('href');
  if (!href || !href.startsWith('#')) {
    return;
  }

  const tabId = href.substring(1);
  const tabNumber = parseInt(tabId.replace('soundboard_list_', ''), 10);
  if (isNaN(tabNumber)) {
    return;
  }

  const gridContainer = document.getElementById(`soundboard-grid-${tabNumber}`);
  if (!gridContainer) {
    return;
  }
  
  const buttons = gridContainer.querySelectorAll('.soundboard-button');
  buttons.forEach(button => {
    button.removeAttribute('songid');
    const placeholder = button.querySelector('.soundboard-button-placeholder');
    const songInfo = button.querySelector('.soundboard-button-info');
    
    if (placeholder) {
      placeholder.style.display = 'block';
    }
    if (songInfo) {
      songInfo.style.display = 'none';
      songInfo.innerHTML = '';
    }
  });
  
  // Save after clearing
  const soundboard = window.moduleRegistry?.soundboard;
  if (soundboard && typeof soundboard.saveSoundboardToStore === 'function') {
    soundboard.saveSoundboardToStore();
  }
}

/**
 * Reinitialize with dependencies
 */
async function reinitializeSoundboardData(deps) {
  if (deps.electronAPI) {
    electronAPI = deps.electronAPI;
  }
  if (deps.debugLog) {
    debugLog = deps.debugLog;
  }
  if (deps.soundboardModule) {
    soundboardModuleRef = deps.soundboardModule;
  }
}

export {
  extractSoundboardTabs,
  restoreSoundboardTabs,
  setLabelFromSongId,
  saveSoundboardToStore,
  loadSoundboardFromStore,
  openSoundboardFile,
  saveSoundboardFile,
  clearSoundboard,
  reinitializeSoundboardData
};

