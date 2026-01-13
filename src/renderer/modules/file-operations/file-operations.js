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
import { secureFileSystem, secureFileDialog } from '../adapters/secure-adapter.js';

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
 * Opens a soundboard file using the modern electronAPI with fallback to legacy ipcRenderer
 */
export function openSoundboardFile() {
  debugLog?.info("Opening soundboard file", { module: 'file-operations', function: 'openSoundboardFile' });
  
  // Hide any visible tooltips before opening file dialog
  if (window.hideAllTooltips) {
    window.hideAllTooltips();
  }
  
  return secureFileDialog.openSoundboardFile();
}

/**
 * Saves a soundboard file using the modern electronAPI with fallback to legacy ipcRenderer
 */
export async function saveSoundboardFile() {
  debugLog?.info("Saving soundboard file", { module: 'file-operations', function: 'saveSoundboardFile' });
  
  // Hide any visible tooltips before opening file dialog
  if (window.hideAllTooltips) {
    window.hideAllTooltips();
  }
  
  // Get soundboard data from module
  if (window.moduleRegistry?.soundboard) {
    const soundboard = window.moduleRegistry.soundboard;
    if (typeof soundboard.saveSoundboardFile === 'function') {
      return await soundboard.saveSoundboardFile();
    }
  }
  
  debugLog?.warn('Soundboard module not available for save', { module: 'file-operations', function: 'saveSoundboardFile' });
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
 * Collects song IDs from all active hotkey elements and saves them
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
  
  // Find the active tab and its content
  const activeLink = document.querySelector('#hotkey_tabs li a.active');
  const activeText = activeLink ? (activeLink.textContent || '') : '';
  
  // Get the active tab content div
  let activeTabContent = null;
  if (activeLink) {
    const href = activeLink.getAttribute('href');
    if (href && href.startsWith('#')) {
      const tabId = href.substring(1);
      activeTabContent = document.getElementById(tabId);
      debugLog?.info("Found active tab content:", { 
        module: 'file-operations',
        function: 'saveHotkeyFile', 
        tabId: tabId,
        tabContent: !!activeTabContent
      });
    }
  }
  
  const hotkeyArray = [];
  
  // Collect song IDs from hotkey elements, prioritizing active tab content
  for (let key = 1; key <= 12; key++) {
    let element = null;
    let songId = null;
    
    if (activeTabContent) {
      // Look for hotkey element within the active tab content first
      element = activeTabContent.querySelector(`#f${key}_hotkey`);
      if (element) {
        songId = element.getAttribute('songid');
        debugLog?.info(`Hotkey ${key} found in active tab:`, { 
          module: 'file-operations',
          function: 'saveHotkeyFile', 
          key: key,
          songId: songId,
          foundInActiveTab: true
        });
      }
    }
    
    // Fallback to global search if not found in active tab
    if (!element) {
      element = document.getElementById(`f${key}_hotkey`);
      if (element) {
        songId = element.getAttribute('songid');
        debugLog?.info(`Hotkey ${key} found globally (fallback):`, { 
          module: 'file-operations',
          function: 'saveHotkeyFile', 
          key: key,
          songId: songId,
          foundInActiveTab: false
        });
      }
    }
    
    hotkeyArray.push(songId || null);
  }
  
  // Add the active tab name if it's not a numeric tab
  if (!/^\d$/.test(activeText)) {
    hotkeyArray.push(activeText);
  }
  
  // Save using modern API with fallback
  return secureFileDialog.saveHotkeyFile(hotkeyArray);
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
  
  // Hide any visible tooltips before saving file
  if (window.hideAllTooltips) {
    window.hideAllTooltips();
  }
  
  // Mark the button as having been clicked to suppress tooltips
  const saveBtn = document.getElementById('holding-tank-save-btn');
  if (saveBtn) {
    saveBtn.dataset.tooltipSuppressUntil = Date.now() + 2000; // Suppress for 2 seconds
  }
  const holdingTankArray = [];
  
  // Collect song IDs from all active holding tank items
  document.querySelectorAll('.holding_tank.active .list-group-item').forEach(li => {
    holdingTankArray.push(li.getAttribute('songid'));
  });
  
  // Save using modern API with fallback
  return secureFileDialog.saveHoldingTankFile(holdingTankArray);
} 