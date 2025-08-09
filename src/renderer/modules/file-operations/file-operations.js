/**
 * File Operations - Core File I/O Functions
 * 
 * Handles opening and saving of hotkey and holding tank files
 * with secure adapter support and fallback compatibility
 */

// Import debug logger
let debugLog = null;
try {
  // Try to get debug logger from global scope
  if (window.debugLog) {
    debugLog = window.debugLog;
  }
} catch (error) {
  // Debug logger not available
}

// Import secure adapters
import { secureFileSystem } from '../adapters/secure-adapter.js';

/**
 * Opens a hotkey file using the modern electronAPI with fallback to legacy ipcRenderer
 */
export function openHotkeyFile() {
  if (window.electronAPI) {
    window.electronAPI.openHotkeyFile().catch(error => {
      debugLog?.warn('Modern API failed, falling back to legacy', { 
        module: 'file-operations',
        function: 'openHotkeyFile',
        error: error.message
      });
      ipcRenderer.send("open-hotkey-file");
    });
  } else {
    ipcRenderer.send("open-hotkey-file");
  }
}

/**
 * Opens a holding tank file using the modern electronAPI with fallback to legacy ipcRenderer
 */
export function openHoldingTankFile() {
  if (window.electronAPI) {
    window.electronAPI.openHoldingTankFile().catch(error => {
      debugLog?.warn('Modern API failed, falling back to legacy', { 
        module: 'file-operations',
        function: 'openHoldingTankFile',
        error: error.message
      });
      ipcRenderer.send("open-holding-tank-file");
    });
  } else {
    ipcRenderer.send("open-holding-tank-file");
  }
}

/**
 * Saves the current hotkey configuration to a file
 * Collects song IDs from all active hotkey elements and saves them
 */
export function saveHotkeyFile() {
  debugLog?.info('Renderer starting saveHotkeyFile', { 
    module: 'file-operations',
    function: 'saveHotkeyFile'
  });
  const hotkeyArray = [];
  
  // Collect song IDs from all hotkey elements (F1-F12)
  for (let key = 1; key <= 12; key++) {
    hotkeyArray.push($(`.hotkeys.active li#f${key}_hotkey`).attr("songid"));
  }
  
  // Add the active tab name if it's not a numeric tab
  if (!/^\d$/.test($("#hotkey_tabs li a.active").text())) {
    hotkeyArray.push($("#hotkey_tabs li a.active").text());
  }
  
  // Save using modern API with fallback
  if (window.electronAPI) {
    window.electronAPI.saveHotkeyFile(hotkeyArray).catch(error => {
      debugLog?.warn('Modern API failed, falling back to legacy', { 
        module: 'file-operations',
        function: 'saveHotkeyFile',
        error: error.message
      });
      ipcRenderer.send("save-hotkey-file", hotkeyArray);
    });
  } else {
    ipcRenderer.send("save-hotkey-file", hotkeyArray);
  }
}

/**
 * Saves the current holding tank configuration to a file
 * Collects song IDs from all active holding tank elements and saves them
 */
export function saveHoldingTankFile() {
  debugLog?.info('Renderer starting saveHoldingTankFile', { 
    module: 'file-operations',
    function: 'saveHoldingTankFile'
  });
  const holdingTankArray = [];
  
  // Collect song IDs from all active holding tank items
  $(".holding_tank.active .list-group-item").each(function () {
    holdingTankArray.push($(this).attr("songid"));
  });
  
  // Save using modern API with fallback
  if (window.electronAPI) {
    window.electronAPI.saveHoldingTankFile(holdingTankArray).catch(error => {
      debugLog?.warn('Modern API failed, falling back to legacy', { 
        module: 'file-operations',
        function: 'saveHoldingTankFile',
        error: error.message
      });
      ipcRenderer.send("save-holding-tank-file", holdingTankArray);
    });
  } else {
    ipcRenderer.send("save-holding-tank-file", holdingTankArray);
  }
} 