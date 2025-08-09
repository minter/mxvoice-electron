/**
 * Drag & Drop Functions
 * 
 * Core functions for handling drag and drop operations
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

/**
 * Handles dropping songs into hotkey containers
 * 
 * @param {Event} event - The drop event
 */
function hotkeyDrop(event) {
  event.preventDefault();
  const song_id = event.dataTransfer.getData("text");
  const target = $(event.currentTarget);
  target.attr("songid", song_id);
  setLabelFromSongId(song_id, target);
}

/**
 * Handles dropping songs into holding tank
 * 
 * @param {Event} event - The drop event
 */
export function holdingTankDrop(event) {
  debugLog?.info('holdingTankDrop called', { 
    module: 'drag-drop-functions',
    function: 'holdingTankDrop',
    target: event.target,
    currentTarget: event.currentTarget
  });
  
  event.preventDefault();
  
  const songId = event.dataTransfer.getData("text");
  debugLog?.info('Song ID from data transfer', { 
    module: 'drag-drop-functions',
    function: 'holdingTankDrop',
    songId: songId
  });
  
  if (!songId) {
    debugLog?.warn('No song ID found in data transfer', { 
      module: 'drag-drop-functions',
      function: 'holdingTankDrop'
    });
    return;
  }
  
  debugLog?.info('Calling addToHoldingTank with songId', { 
    module: 'drag-drop-functions',
    function: 'holdingTankDrop',
    songId: songId,
    functionAvailable: typeof window.addToHoldingTank
  });
  
  if (window.addToHoldingTank) {
    addToHoldingTank(songId, $(event.target));
  } else {
    debugLog?.error('addToHoldingTank function not available', { 
      module: 'drag-drop-functions',
      function: 'holdingTankDrop'
    });
  }
}

/**
 * Allows dropping into hotkey containers
 * 
 * @param {Event} event - The dragover event
 */
function allowHotkeyDrop(event) {
  event.preventDefault();
}

/**
 * Handles dragging songs
 * 
 * @param {Event} event - The dragstart event
 */
export function songDrag(event) {
  debugLog?.info('Starting drag for song ID', { 
    module: 'drag-drop-functions',
    function: 'songDrag',
    songId: event.target.getAttribute("songid")
  });
  event.dataTransfer.setData("text", event.target.getAttribute("songid"));
}

/**
 * Handles dragging columns
 * 
 * @param {Event} event - The dragstart event
 */
export function columnDrag(event) {
  debugLog?.info('Starting drag for column ID', { 
    module: 'drag-drop-functions',
    function: 'columnDrag',
    columnId: event.target.getAttribute("id")
  });
  event.dataTransfer.setData(
    "application/x-moz-node",
    event.target.getAttribute("id")
  );
} 