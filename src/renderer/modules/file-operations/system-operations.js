/**
 * System Operations - Directory Picking and Update Installation
 * 
 * Handles system-level file operations like directory picking and update installation
 */

/**
 * Opens a directory picker dialog and updates the specified element with the selected path
 * 
 * @param {Event} event - The triggering event
 * @param {HTMLElement} element - The element to update with the selected path
 */
export function pickDirectory(event, element) {
  event.preventDefault();
  const defaultPath = $(element).val();
  ipcRenderer.invoke("show-directory-picker", defaultPath).then((result) => {
    if (result) $(element).val(result);
  });
}

/**
 * Installs an update using the modern electronAPI with fallback to legacy ipcRenderer
 * Triggers the application restart and update installation process
 */
export function installUpdate() {
  if (window.electronAPI) {
    window.electronAPI.restartAndInstall().catch(error => {
      console.warn('Modern API failed, falling back to legacy:', error);
      ipcRenderer.send("restart-and-install-new-version");
    });
  } else {
    ipcRenderer.send("restart-and-install-new-version");
  }
} 