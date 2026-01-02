/**
 * Soundboard Events Module
 * 
 * Handles event handlers for soundboard buttons including:
 * - Click events (play song)
 * - Double-click events (edit assignment)
 * - Right-click events (context menu)
 * - Keyboard navigation
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
let audioModule = null;
let soundboardModuleRef = null;

/**
 * Play song from soundboard button
 * @param {string} songId - Song ID to play
 * @param {HTMLElement} button - Button element that was clicked
 */
function playSongFromButton(songId, button) {
  if (!songId) {
    debugLog?.warn('No song ID provided to playSongFromButton', {
      module: 'soundboard-events',
      function: 'playSongFromButton'
    });
    return;
  }
  
  debugLog?.info('Playing song from soundboard button', {
    module: 'soundboard-events',
    function: 'playSongFromButton',
    songId
  });
  
  // Use audio module to play song
  if (audioModule && typeof audioModule.playSongFromId === 'function') {
    audioModule.playSongFromId(songId);
  } else if (window.moduleRegistry?.audio && typeof window.moduleRegistry.audio.playSongFromId === 'function') {
    window.moduleRegistry.audio.playSongFromId(songId);
  } else if (typeof window.playSongFromId === 'function') {
    window.playSongFromId(songId);
  } else {
    debugLog?.error('No audio playback function available', {
      module: 'soundboard-events',
      function: 'playSongFromButton'
    });
  }
  
  // Update visual feedback - highlight playing button
  updatePlayingButton(button);
}

/**
 * Update visual feedback for playing button
 * @param {HTMLElement} button - Button element to highlight
 */
function updatePlayingButton(button) {
  // Remove playing class from all buttons
  const allButtons = document.querySelectorAll('.soundboard-button');
  allButtons.forEach(btn => btn.classList.remove('playing'));
  
  // Add playing class to current button
  if (button) {
    button.classList.add('playing');
  }
}

/**
 * Handle button click event
 * @param {Event} event - Click event
 */
function handleButtonClick(event) {
  const button = event.currentTarget;
  const songId = button.getAttribute('songid');
  
  if (songId) {
    playSongFromButton(songId, button);
  }
}

/**
 * Handle button double-click event
 * @param {Event} event - Double-click event
 */
function handleButtonDoubleClick(event) {
  const button = event.currentTarget;
  const songId = button.getAttribute('songid');
  
  // Double-click could be used for editing/reassigning
  // For now, just play if there's a song, or allow assignment if empty
  if (songId) {
    playSongFromButton(songId, button);
  } else {
    // Could open assignment dialog or focus for drag-drop
    debugLog?.info('Empty button double-clicked - could open assignment dialog', {
      module: 'soundboard-events',
      function: 'handleButtonDoubleClick'
    });
  }
}

/**
 * Handle keyboard navigation
 * @param {Event} event - Keyboard event
 */
function handleKeyboardNavigation(event) {
  const gridContainer = getActiveGridContainer();
  if (!gridContainer) {
    return;
  }
  
  const buttons = Array.from(gridContainer.querySelectorAll('.soundboard-button'));
  const currentButton = document.activeElement;
  const currentIndex = buttons.indexOf(currentButton);
  
  if (currentIndex === -1) {
    return;
  }
  
  let newIndex = currentIndex;
  const columns = parseInt(getComputedStyle(gridContainer).getPropertyValue('--grid-columns')) || 6;
  
  switch (event.key) {
    case 'ArrowUp':
      newIndex = Math.max(0, currentIndex - columns);
      break;
    case 'ArrowDown':
      newIndex = Math.min(buttons.length - 1, currentIndex + columns);
      break;
    case 'ArrowLeft':
      newIndex = Math.max(0, currentIndex - 1);
      break;
    case 'ArrowRight':
      newIndex = Math.min(buttons.length - 1, currentIndex + 1);
      break;
    case 'Enter':
    case ' ':
      event.preventDefault();
      if (currentButton) {
        handleButtonClick({ currentTarget: currentButton });
      }
      return;
    case 'Escape':
      currentButton?.blur();
      return;
      case 'Delete':
    case 'Backspace':
      event.preventDefault();
      if (currentButton && currentButton.getAttribute('songid')) {
        // Clear button
        currentButton.removeAttribute('songid');
        const placeholder = currentButton.querySelector('.soundboard-button-placeholder');
        const songInfo = currentButton.querySelector('.soundboard-button-info');
        if (placeholder) placeholder.style.display = 'block';
        if (songInfo) {
          songInfo.style.display = 'none';
          songInfo.innerHTML = '';
        }
        const soundboard = window.moduleRegistry?.soundboard;
        if (soundboard && typeof soundboard.saveSoundboardToStore === 'function') {
          soundboard.saveSoundboardToStore();
        }
      }
      return;
    default:
      return;
  }
  
  if (newIndex !== currentIndex && buttons[newIndex]) {
    event.preventDefault();
    buttons[newIndex].focus();
  }
}

/**
 * Get the active tab's grid container
 * @returns {HTMLElement|null} Active grid container
 */
function getActiveGridContainer() {
  const activeTab = document.querySelector('#soundboard_tabs .nav-link.active');
  if (!activeTab) {
    return null;
  }

  const href = activeTab.getAttribute('href');
  if (!href || !href.startsWith('#')) {
    return null;
  }

  const tabId = href.substring(1);
  const tabNumber = parseInt(tabId.replace('soundboard_list_', ''), 10);
  if (isNaN(tabNumber)) {
    return null;
  }

  return document.getElementById(`soundboard-grid-${tabNumber}`);
}

/**
 * NOTE: setupEventListeners is now a method of the SoundboardModule class
 * (following the same pattern as HotkeysModule.setupEventListeners)
 * This function is kept for backward compatibility but should not be used.
 */
function setupEventListeners() {
  debugLog?.warn('Standalone setupEventListeners called - this should be a class method', {
    module: 'soundboard-events',
    function: 'setupEventListeners'
  });
}

/**
 * Reinitialize with dependencies
 */
async function reinitializeSoundboardEvents(deps) {
  if (deps.electronAPI) {
    electronAPI = deps.electronAPI;
  }
  if (deps.audio) {
    audioModule = deps.audio;
  }
  if (deps.debugLog) {
    debugLog = deps.debugLog;
  }
  if (deps.soundboardModule) {
    soundboardModuleRef = deps.soundboardModule;
  }
}

export {
  playSongFromButton,
  updatePlayingButton,
  handleButtonClick,
  handleButtonDoubleClick,
  getActiveGridContainer,
  reinitializeSoundboardEvents
  // Note: setupEventListeners and handleKeyboardNavigation are now class methods in SoundboardModule
};

