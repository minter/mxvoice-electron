/**
 * File Operations - Core File I/O Functions
 * 
 * Handles opening and saving of hotkey and holding tank files
 * with fallback support for both modern electronAPI and legacy ipcRenderer
 */

/**
 * Opens a hotkey file using the modern electronAPI with fallback to legacy ipcRenderer
 */
export function openHotkeyFile() {
  if (window.electronAPI) {
    window.electronAPI.openHotkeyFile().catch(error => {
      console.warn('Modern API failed, falling back to legacy:', error);
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
      console.warn('Modern API failed, falling back to legacy:', error);
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
  console.log("Renderer starting saveHotkeyFile");
  var hotkeyArray = [];
  
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
      console.warn('Modern API failed, falling back to legacy:', error);
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
  console.log("Renderer starting saveHoldingTankFile");
  var holdingTankArray = [];
  
  // Collect song IDs from all active holding tank items
  $(".holding_tank.active .list-group-item").each(function () {
    holdingTankArray.push($(this).attr("songid"));
  });
  
  // Save using modern API with fallback
  if (window.electronAPI) {
    window.electronAPI.saveHoldingTankFile(holdingTankArray).catch(error => {
      console.warn('Modern API failed, falling back to legacy:', error);
      ipcRenderer.send("save-holding-tank-file", holdingTankArray);
    });
  } else {
    ipcRenderer.send("save-holding-tank-file", holdingTankArray);
  }
} 