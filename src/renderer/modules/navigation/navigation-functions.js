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
  if ($("#selected_row").is("span")) {
    return;
  }
  target = $(".hotkeys.active li").not("[songid]").first();
  song_id = $("#selected_row").attr("songid");
  if ($(`.hotkeys.active li[songid=${song_id}]`).length) {
    return;
  }
  if (target && song_id) {
    target.attr("songid", song_id);
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
  target = $(".holding_tank.active");
  song_id = $("#selected_row").attr("songid");
  if (song_id) {
    addToHoldingTank(song_id, target);
  }
  return false;
}

/**
 * Selects next item in list
 */
export function selectNext() {
  $("#selected_row").removeAttr("id").next().attr("id", "selected_row");
}

/**
 * Selects previous item in list
 */
export function selectPrev() {
  $("#selected_row").removeAttr("id").prev().attr("id", "selected_row");
} 