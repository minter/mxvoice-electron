/**
 * Soundboard UI Module
 * 
 * Handles UI-related functionality for soundboard including:
 * - Tab management
 * - Drag-drop handlers
 * - Visual updates
 */

let debugLog = null;
try {
  if (window.debugLog) {
    debugLog = window.debugLog;
  }
} catch (error) {
  // Debug logger not available
}

let soundboardModuleRef = null;

/**
 * Handle dropping songs into soundboard buttons
 * Following the same pattern as hotkeyDrop in hotkey-ui.js
 * @param {Event} event - The drop event
 * @param {Object} options - Additional options (for compatibility)
 */
function soundboardButtonDrop(event, options = {}) {
  event.preventDefault();
  const songId = event.dataTransfer.getData('text');
  const target = event.currentTarget;
  
  if (!songId || songId === 'null' || songId === 'undefined') {
    debugLog?.warn('soundboardButtonDrop aborted: no valid song ID', {
      module: 'soundboard-ui',
      function: 'soundboardButtonDrop'
    });
    return;
  }
  
  // Remove drop target styling
  target.classList.remove('drop-target');
  
  // Save function to call after setLabelFromSongId completes
  // Use 'this' when bound to SoundboardModule instance, fallback to window
  const saveFunction = () => {
    if (this && this.saveSoundboardToStore) {
      this.saveSoundboardToStore();
    } else if (window.saveSoundboardToStore) {
      window.saveSoundboardToStore();
    }
  };
  
  // Use the module instance's setLabelFromSongId method if available (when bound to SoundboardModule)
  // Otherwise fall back to global function
  if (this && this.setLabelFromSongId) {
    const result = this.setLabelFromSongId(songId, target);
    if (result && result instanceof Promise) {
      result.then(() => saveFunction()).catch(() => saveFunction());
    } else {
      setTimeout(saveFunction, 100);
    }
  } else if (window.setLabelFromSongId) {
    const result = window.setLabelFromSongId(songId, target);
    if (result && result instanceof Promise) {
      result.then(() => saveFunction()).catch(() => saveFunction());
    } else {
      setTimeout(saveFunction, 100);
    }
  }
}

/**
 * Allow dropping into soundboard buttons
 * @param {Event} event - The dragover event
 */
function allowSoundboardButtonDrop(event) {
  event.preventDefault();
  event.currentTarget.classList.add('drop-target');
}

/**
 * Switch to a specific soundboard tab
 * @param {number} tab - Tab number to switch to
 */
function switchToSoundboardTab(tab) {
  try {
    import('../ui/bootstrap-adapter.js')
      .then(({ showTab }) => showTab(`#soundboard_tabs li:nth-child(${tab}) a`))
      .catch(() => {});
  } catch {}
}

/**
 * Rename the active soundboard tab
 */
async function renameSoundboardTab() {
  const currentName = document.querySelector('#soundboard_tabs .nav-link.active')?.textContent || '';
  
  // Use customPrompt if available
  let newName;
  if (typeof window.customPrompt === 'function') {
    newName = await window.customPrompt(
      'Enter a new name for this tab:',
      currentName,
      'Rename Soundboard Tab'
    );
  } else {
    // Fallback to prompt
    newName = prompt('Enter a new name for this tab:', currentName);
  }
  
  if (newName && newName.trim() !== '') {
    const link = document.querySelector('#soundboard_tabs .nav-link.active');
    if (link) {
      link.textContent = newName.trim();
      
      // Save after renaming
      const soundboard = window.moduleRegistry?.soundboard;
      if (soundboard && typeof soundboard.saveSoundboardToStore === 'function') {
        await soundboard.saveSoundboardToStore();
      }
      
      return { success: true, newName: newName.trim() };
    }
  }
  
  return { success: false };
}

/**
 * Reinitialize with dependencies
 */
async function reinitializeSoundboardUI(deps) {
  if (deps.debugLog) {
    debugLog = deps.debugLog;
  }
  if (deps.soundboardModule) {
    soundboardModuleRef = deps.soundboardModule;
  }
}

export {
  soundboardButtonDrop,
  allowSoundboardButtonDrop,
  switchToSoundboardTab,
  renameSoundboardTab,
  reinitializeSoundboardUI
};

