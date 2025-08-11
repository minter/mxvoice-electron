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
    return;
  }
  target = Array.from(document.querySelectorAll('.hotkeys.active li')).find(li => !li.getAttribute('songid'));
  song_id = document.getElementById('selected_row')?.getAttribute('songid');
  if (document.querySelector(`.hotkeys.active li[songid="${song_id}"]`)) {
    return;
  }
  if (target && song_id) {
    target.setAttribute('songid', song_id);
    setLabelFromSongId(song_id, target);
  }
  return false;
}

/**
 * Sends selected song to holding tank
 * 
 * @returns {boolean} - Returns false to prevent default behavior
 */
export function sendToHoldingTank() {
  target = document.querySelector('.holding_tank.active');
  song_id = document.getElementById('selected_row')?.getAttribute('songid');
  if (song_id) {
    addToHoldingTank(song_id, target);
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