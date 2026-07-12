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
} catch (_error) {
  // Debug logger not available
}

// Import secure adapters
import { secureFileDialog } from '../adapters/secure-adapter.js';

/**
 * Opens a hotkey file using the modern electronAPI with fallback to legacy ipcRenderer
 */
export function openHotkeyFile() {
  debugLog?.info("Opening hotkey file", { module: 'file-operations', function: 'openHotkeyFile' });
  
  // Hide any visible tooltips before opening file dialog
  if (window.hideAllTooltips) {
    window.hideAllTooltips();
  }
  
  // Mark the button as having been clicked to suppress tooltips for longer duration
  // This covers the file dialog + hotkey loading process
  const loadBtn = document.getElementById('hotkey-load-btn');
  if (loadBtn) {
    loadBtn.dataset.tooltipSuppressUntil = Date.now() + 5000; // Suppress for 5 seconds
  }
  
  // Also suppress tooltips on all file operation buttons during this process
  const fileButtons = ['hotkey-load-btn', 'hotkey-save-btn', 'holding-tank-load-btn', 'holding-tank-save-btn'];
  fileButtons.forEach(btnId => {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.dataset.tooltipSuppressUntil = Date.now() + 5000;
    }
  });
  
  return secureFileDialog.openHotkeyFile();
}

/**
 * Opens a holding tank file using the modern electronAPI with fallback to legacy ipcRenderer
 */
export function openHoldingTankFile() {
  debugLog?.info("Opening holding tank file", { module: 'file-operations', function: 'openHoldingTankFile' });
  
  // Hide any visible tooltips before opening file dialog
  if (window.hideAllTooltips) {
    window.hideAllTooltips();
  }
  
  // Mark the button as having been clicked to suppress tooltips
  const loadBtn = document.getElementById('holding-tank-load-btn');
  if (loadBtn) {
    loadBtn.dataset.tooltipSuppressUntil = Date.now() + 3000; // Suppress for 3 seconds
  }
  
  return secureFileDialog.openHoldingTankFile();
}

/**
 * Saves the current hotkey configuration to a file
 * Delegates model-backed export to the hotkeys module
 */
export function saveHotkeyFile() {
  debugLog?.info('Renderer starting saveHotkeyFile', { 
    module: 'file-operations',
    function: 'saveHotkeyFile'
  });
  
  // Hide any visible tooltips before saving file
  if (window.hideAllTooltips) {
    window.hideAllTooltips();
  }
  
  // Mark the button as having been clicked to suppress tooltips
  const saveBtn = document.getElementById('hotkey-save-btn');
  if (saveBtn) {
    saveBtn.dataset.tooltipSuppressUntil = Date.now() + 2000; // Suppress for 2 seconds
  }
  
  const hotkeys = window.moduleRegistry?.hotkeys;
  if (!hotkeys?.saveHotkeyFile) throw new Error('Hotkeys module is unavailable');
  return hotkeys.saveHotkeyFile();
}

/**
 * Saves the current holding tank configuration to a file
 * Delegates model-backed export to the holding-tank module
 */
export function saveHoldingTankFile() {
  debugLog?.info('Renderer starting saveHoldingTankFile', { 
    module: 'file-operations',
    function: 'saveHoldingTankFile'
  });
  
  // Hide any visible tooltips before saving file
  if (window.hideAllTooltips) {
    window.hideAllTooltips();
  }
  
  // Mark the button as having been clicked to suppress tooltips
  const saveBtn = document.getElementById('holding-tank-save-btn');
  if (saveBtn) {
    saveBtn.dataset.tooltipSuppressUntil = Date.now() + 2000; // Suppress for 2 seconds
  }
  const holdingTank = window.moduleRegistry?.holdingTank;
  if (!holdingTank?.saveHoldingTankFile) throw new Error('Holding tank module is unavailable');
  return holdingTank.saveHoldingTankFile();
}
