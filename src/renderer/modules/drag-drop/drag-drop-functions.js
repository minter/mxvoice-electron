/**
 * Drag & Drop Functions
 * 
 * Core functions for handling drag and drop operations
 */

/**
 * Handles dropping songs into hotkey containers
 * 
 * @param {Event} event - The drop event
 */
export function hotkeyDrop(event) {
  event.preventDefault();
  var song_id = event.dataTransfer.getData("text");
  var target = $(event.currentTarget);
  target.attr("songid", song_id);
  setLabelFromSongId(song_id, target);
}

/**
 * Handles dropping songs into holding tank
 * 
 * @param {Event} event - The drop event
 */
export function holdingTankDrop(event) {
  console.log('🔍 holdingTankDrop called');
  console.log('🔍 Event target:', event.target);
  console.log('🔍 Event currentTarget:', event.currentTarget);
  
  event.preventDefault();
  
  const songId = event.dataTransfer.getData("text");
  console.log('🔍 Song ID from data transfer:', songId);
  
  if (!songId) {
    console.warn('❌ No song ID found in data transfer');
    return;
  }
  
  console.log('🔍 Calling addToHoldingTank with songId:', songId);
  console.log('🔍 addToHoldingTank function available:', typeof window.addToHoldingTank);
  
  if (window.addToHoldingTank) {
    addToHoldingTank(songId, $(event.target));
  } else {
    console.error('❌ addToHoldingTank function not available');
  }
}

/**
 * Allows dropping into hotkey containers
 * 
 * @param {Event} event - The dragover event
 */
export function allowHotkeyDrop(event) {
  event.preventDefault();
}

/**
 * Handles dragging songs
 * 
 * @param {Event} event - The dragstart event
 */
export function songDrag(event) {
  console.log("Starting drag for ID " + event.target.getAttribute("songid"));
  event.dataTransfer.setData("text", event.target.getAttribute("songid"));
}

/**
 * Handles dragging columns
 * 
 * @param {Event} event - The dragstart event
 */
export function columnDrag(event) {
  console.log("Starting drag for column ID " + event.target.getAttribute("id"));
  event.dataTransfer.setData(
    "application/x-moz-node",
    event.target.getAttribute("id")
  );
} 