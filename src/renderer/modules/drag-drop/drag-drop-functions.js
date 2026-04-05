/**
 * Drag & Drop Functions
 * 
 * Core functions for handling drag and drop operations
 */

// Database functions are accessed via window globals (registered by function-registry)

// Import debug logger
let debugLog = null;
try {
  // Try to get debug logger from global scope
  if (window.debugLog) {
    debugLog = window.debugLog;
  }
} catch (_error) {
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
  
  if (typeof window.setLabelFromSongId === 'function') {
    window.setLabelFromSongId(song_id, target);
  } else {
    debugLog?.warn('setLabelFromSongId function not available', { 
      module: 'drag-drop-functions',
      function: 'hotkeyDrop'
    });
  }
  
  // Save hotkeys state after assignment
  // First try to use the hotkeys module's save function
  if (window.moduleRegistry?.hotkeys?.saveHotkeysToStore) {
    debugLog?.info('Saving hotkeys via module registry', {
      module: 'drag-drop-functions',
      function: 'hotkeyDrop'
    });
    window.moduleRegistry.hotkeys.saveHotkeysToStore();
  } else if (typeof window.saveHotkeysToStore === 'function') {
    debugLog?.info('Saving hotkeys via window function', {
      module: 'drag-drop-functions',
      function: 'hotkeyDrop'
    });
    window.saveHotkeysToStore();
  } else {
    debugLog?.error('No saveHotkeysToStore function available', {
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
  
  if (typeof window.addToHoldingTank === 'function') {
    window.addToHoldingTank(songId, event.target).then(result => {
      if (result && result.success) {
        if (typeof window.saveHoldingTankToStore === 'function') {
          window.saveHoldingTankToStore();
        }
      }
    }).catch(err => { debugLog?.warn('Failed to add song to holding tank', { module: 'drag-drop-functions', function: 'holdingTankDrop', error: err?.message }); });
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

  // Mark holding tank items for internal reorder detection
  const holdingTankList = withSongId?.closest?.('.holding_tank');
  if (holdingTankList) {
    event.dataTransfer.setData("application/x-holding-tank-reorder", holdingTankList.id);
  }
}

/**
 * Handles reordering songs within the holding tank via drag and drop.
 * Moves the dragged item to the new position (before or after the drop target).
 *
 * @param {DragEvent} event - The drop event
 */
export function holdingTankReorderDrop(event) {
  event.preventDefault();
  clearHoldingTankDropIndicators();

  const songId = event.dataTransfer.getData("text");
  const sourceTabId = event.dataTransfer.getData("application/x-holding-tank-reorder");
  if (!songId || !sourceTabId) return;

  // Find the source element in the source tab
  const sourceTab = document.getElementById(sourceTabId);
  if (!sourceTab) return;
  const draggedItem = sourceTab.querySelector(`li[songid="${songId}"]`);
  if (!draggedItem) return;

  // Find the drop target <li> in the holding tank
  const targetItem = event.target?.closest?.('.holding_tank li');
  const targetList = event.target?.closest?.('.holding_tank');

  if (!targetList) return;

  // If dropped on the same item, do nothing
  if (targetItem === draggedItem) return;

  if (targetItem) {
    // Determine insert position based on cursor Y relative to target midpoint
    const rect = targetItem.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    if (event.clientY < midY) {
      targetList.insertBefore(draggedItem, targetItem);
    } else {
      targetList.insertBefore(draggedItem, targetItem.nextSibling);
    }
  } else {
    // Dropped on empty area of the list — append to end
    targetList.appendChild(draggedItem);
  }

  // Save the new order
  if (typeof window.saveHoldingTankToStore === 'function') {
    window.saveHoldingTankToStore();
  }

  debugLog?.info('Holding tank item reordered', {
    module: 'drag-drop-functions',
    function: 'holdingTankReorderDrop',
    songId
  });
}

/**
 * Handle dragover for holding tank reorder — shows a visual drop indicator.
 *
 * @param {DragEvent} event - The dragover event
 */
export function holdingTankReorderDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';

  const targetItem = event.target?.closest?.('.holding_tank li');
  if (!targetItem) return;

  // Clear previous indicators
  clearHoldingTankDropIndicators();

  // Show indicator above or below based on cursor position
  const rect = targetItem.getBoundingClientRect();
  const midY = rect.top + rect.height / 2;
  if (event.clientY < midY) {
    targetItem.classList.add('holding-tank-drop-above');
  } else {
    targetItem.classList.add('holding-tank-drop-below');
  }
}

/**
 * Clear all holding tank drop indicators.
 */
export function clearHoldingTankDropIndicators() {
  document.querySelectorAll('.holding-tank-drop-above, .holding-tank-drop-below').forEach(el => {
    el.classList.remove('holding-tank-drop-above', 'holding-tank-drop-below');
  });
} 