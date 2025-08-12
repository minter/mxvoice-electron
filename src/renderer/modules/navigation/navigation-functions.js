/**
 * Navigation Functions
 * 
 * Core functions for handling navigation operations
 */

/**
 * Sends selected song to hotkeys
 * 
 * @returns {boolean} - Returns false to prevent default behavior
 */
export function sendToHotkeys() {
  if (document.getElementById('selected_row')?.tagName === 'SPAN') {
    return false;
  }
  const target = Array.from(document.querySelectorAll('.hotkeys.active li')).find(li => !li.getAttribute('songid'));
  const songId = document.getElementById('selected_row')?.getAttribute('songid');
  if (document.querySelector(`.hotkeys.active li[songid="${songId}"]`)) {
    return false;
  }
  if (target && songId) {
    target.setAttribute('songid', songId);
    if (typeof window.setLabelFromSongId === 'function') {
      window.setLabelFromSongId(songId, target);
    } else if (window.moduleRegistry?.hotkeys?.setLabelFromSongId) {
      window.moduleRegistry.hotkeys.setLabelFromSongId(songId, target);
    }
  }
  return false;
}

/**
 * Sends selected song to holding tank
 * 
 * @returns {boolean} - Returns false to prevent default behavior
 */
export function sendToHoldingTank() {
  const target = document.querySelector('.holding_tank.active');
  const songId = document.getElementById('selected_row')?.getAttribute('songid');
  if (songId) {
    if (typeof window.addToHoldingTank === 'function') {
      window.addToHoldingTank(songId, target);
    } else if (window.moduleRegistry?.holdingTank?.addToHoldingTank) {
      window.moduleRegistry.holdingTank.addToHoldingTank(songId, target);
    }
  }
  return false;
}

/**
 * Selects next item in list
 */
export function selectNext() {
  const current = document.getElementById('selected_row');
  if (!current) return;
  current.removeAttribute('id');
  const next = current.nextElementSibling;
  if (next) next.id = 'selected_row';
}

/**
 * Selects previous item in list
 */
export function selectPrev() {
  const current = document.getElementById('selected_row');
  if (!current) return;
  current.removeAttribute('id');
  const prev = current.previousElementSibling;
  if (prev) prev.id = 'selected_row';
} 