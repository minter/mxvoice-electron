/**
 * Drag & Drop Functions
 * 
 * Core functions for handling drag and drop operations
 */

// Database functions will be loaded dynamically to avoid import failures
let addToHoldingTank, setLabelFromSongId;

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
export function hotkeyDrop(event) {
  event.preventDefault();
  const song_id_raw = event.dataTransfer.getData("text");
  const song_id = (song_id_raw && song_id_raw !== 'null' && song_id_raw !== 'undefined') ? song_id_raw : '';
  if (!song_id) {
    debugLog?.warn('hotkeyDrop aborted: no valid song ID on dataTransfer', {
      module: 'drag-drop-functions',
      function: 'hotkeyDrop'
    });
    return;
  }
  const target = event.currentTarget;
  if (target && target.setAttribute) target.setAttribute('songid', song_id);
  
  // Try to use setLabelFromSongId if available, otherwise fallback
  if (typeof setLabelFromSongId === 'function') {
    setLabelFromSongId(song_id, target);
  } else if (typeof window.setLabelFromSongId === 'function') {
    window.setLabelFromSongId(song_id, target);
  } else {
    debugLog?.warn('setLabelFromSongId function not available', { 
      module: 'drag-drop-functions',
      function: 'hotkeyDrop'
    });
  }
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
  
  const songIdRaw = event.dataTransfer.getData("text");
  const songId = (songIdRaw && songIdRaw !== 'null' && songIdRaw !== 'undefined') ? songIdRaw : '';
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
    songId: songId
  });
  
  // Try to use addToHoldingTank if available, otherwise fallback
  if (typeof addToHoldingTank === 'function') {
    addToHoldingTank(songId, event.target).then(result => {
      if (result && result.success) {
        debugLog?.info('Successfully added song to holding tank', { 
          module: 'drag-drop-functions',
          function: 'holdingTankDrop',
          songId: songId,
          title: result.title
        });
      } else {
        debugLog?.error('Failed to add song to holding tank', { 
          module: 'drag-drop-functions',
          function: 'holdingTankDrop',
          songId: songId,
          error: result ? result.error : 'Unknown error'
        });
      }
    }).catch(error => {
      debugLog?.error('Error adding song to holding tank', { 
        module: 'drag-drop-functions',
        function: 'holdingTankDrop',
        songId: songId,
        error: error.message
      });
    });
  } else if (typeof window.addToHoldingTank === 'function') {
    window.addToHoldingTank(songId, event.target);
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
export function allowHotkeyDrop(event) {
  event.preventDefault();
}

/**
 * Handles dragging songs
 * 
 * @param {Event} event - The dragstart event
 */
export function songDrag(event) {
  const sourceElement = (event.currentTarget instanceof Element)
    ? event.currentTarget
    : (event.target instanceof Element ? event.target : null);
  const withSongId = sourceElement?.hasAttribute?.('songid')
    ? sourceElement
    : sourceElement?.closest?.('[songid]') || null;
  const songId = withSongId?.getAttribute?.('songid') || '';

  debugLog?.info('Starting drag for song ID', { 
    module: 'drag-drop-functions',
    function: 'songDrag',
    songId: songId
  });

  if (!songId) {
    debugLog?.warn('songDrag aborted: no songid on source element', {
      module: 'drag-drop-functions',
      function: 'songDrag'
    });
    return;
  }

  event.dataTransfer.setData("text", songId);
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