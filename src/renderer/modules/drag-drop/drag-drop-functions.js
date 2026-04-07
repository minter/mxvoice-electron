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

  // Use the position captured by the last dragover indicator so the song
  // lands exactly where the blue line was shown, even if the cursor shifted
  // slightly between the last dragover and the drop event.
  const indication = getLastDropIndication();
  clearHoldingTankDropIndicators();
  let insertTarget;
  let insertPosition;
  if (indication.item && indication.position && indication.item.isConnected) {
    insertTarget = indication.item;
    insertPosition = indication.position;
  } else {
    // Fallback: calculate from the drop event directly
    const targetItem = event.target?.closest?.('.holding_tank li');
    if (targetItem) {
      const rect = targetItem.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      insertPosition = event.clientY < midY ? 'before' : 'after';
      insertTarget = targetItem;
    } else {
      insertTarget = event.target;
      insertPosition = 'append';
    }
  }

  if (typeof window.addToHoldingTank === 'function') {
    window.addToHoldingTank(songId, insertTarget, insertPosition).then(result => {
      if (result && result.success) {
        // Flash the newly added item to confirm placement
        const added = document.querySelector(`.holding_tank.active .list-group-item[songid="${songId}"]`);
        if (added) {
          added.classList.remove('holding-tank-flash');
          void added.offsetWidth;
          added.classList.add('holding-tank-flash');
        }
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

  // Capture the indicated position before clearing indicators
  const indication = getLastDropIndication();
  clearHoldingTankDropIndicators();

  const songId = event.dataTransfer.getData("text");
  const sourceTabId = event.dataTransfer.getData("application/x-holding-tank-reorder");
  if (!songId || !sourceTabId) return;

  // Find the source element in the source tab
  const sourceTab = document.getElementById(sourceTabId);
  if (!sourceTab) return;
  const draggedItem = sourceTab.querySelector(`li[songid="${songId}"]`);
  if (!draggedItem) return;

  // Use the stored indication from dragover, falling back to event.target
  const targetItem = (indication.item?.isConnected ? indication.item : null) || event.target?.closest?.('.holding_tank li');
  const targetList = (targetItem?.closest?.('.holding_tank')) || event.target?.closest?.('.holding_tank');

  if (!targetList) return;

  // If dropped on the same item, do nothing
  if (targetItem === draggedItem) return;

  if (targetItem) {
    // Use stored position from dragover indicator, or calculate from cursor
    const targetRect = targetItem.getBoundingClientRect();
    const insertBefore = indication.position
      ? indication.position === 'before'
      : event.clientY < (targetRect.top + targetRect.height / 2);

    if (insertBefore) {
      targetList.insertBefore(draggedItem, targetItem);
    } else {
      targetList.insertBefore(draggedItem, targetItem.nextSibling);
    }
  } else {
    // Dropped on empty area of the list — append to end
    targetList.appendChild(draggedItem);
  }

  // Flash the moved item to confirm placement
  draggedItem.classList.remove('holding-tank-flash');
  void draggedItem.offsetWidth;
  draggedItem.classList.add('holding-tank-flash');

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

// Track the last element that received a drop indicator to avoid querying the
// entire document on every dragover event (fires 60+ times per second).
// Also used by the drop handlers so the song lands exactly where the line was.
let _lastIndicatedItem = null;
let _lastIndicatedPosition = null; // 'before' | 'after'
// Snapshot preserved across clearHoldingTankDropIndicators() so the drop
// handler always sees the position even if dragleave fires first.
let _snapshotItem = null;
let _snapshotPosition = null;

/**
 * Handle dragover for holding tank — shows a visual drop indicator line.
 * Works for both internal reorder and external drops (from search).
 *
 * @param {DragEvent} event - The dragover event
 */
export function holdingTankReorderDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';

  const targetItem = event.target?.closest?.('.holding_tank li');
  if (!targetItem) return;

  // Determine above/below based on cursor position
  const rect = targetItem.getBoundingClientRect();
  const midY = rect.top + rect.height / 2;
  const above = event.clientY < midY;

  // Fast path: if indicator is already correct, skip DOM work
  if (
    _lastIndicatedItem === targetItem &&
    targetItem.classList.contains(above ? 'holding-tank-drop-above' : 'holding-tank-drop-below')
  ) {
    return;
  }

  // Clear previous indicator (targeted, not a full document query)
  clearHoldingTankDropIndicators();

  // Show indicator above or below based on cursor position
  if (above) {
    targetItem.classList.add('holding-tank-drop-above');
  } else {
    targetItem.classList.add('holding-tank-drop-below');
  }
  _lastIndicatedItem = targetItem;
  _lastIndicatedPosition = above ? 'before' : 'after';
  // Keep a snapshot so the drop handler can read the position even if
  // dragleave fires (and clears the live tracking vars) before drop.
  _snapshotItem = _lastIndicatedItem;
  _snapshotPosition = _lastIndicatedPosition;
}

/**
 * Return the last indicated drop target and position from dragover.
 * Used by drop handlers so the song lands exactly where the blue line was,
 * even if the cursor shifted slightly between the last dragover and the drop.
 *
 * @returns {{ item: Element|null, position: string|null }}
 */
export function getLastDropIndication() {
  // Prefer live tracking vars, but fall back to snapshot in case
  // dragleave cleared them before the drop handler ran.
  const item = _lastIndicatedItem || _snapshotItem;
  const position = _lastIndicatedPosition || _snapshotPosition;
  // Clear the snapshot now that the drop handler has consumed it
  _snapshotItem = null;
  _snapshotPosition = null;
  return { item, position };
}

/**
 * Clear all holding tank drop indicators.
 * Uses tracked element for fast removal; falls back to document query.
 */
export function clearHoldingTankDropIndicators() {
  if (_lastIndicatedItem) {
    _lastIndicatedItem.classList.remove('holding-tank-drop-above', 'holding-tank-drop-below');
    _lastIndicatedItem = null;
    _lastIndicatedPosition = null;
  } else {
    // Fallback: clear any stale indicators in the document
    document.querySelectorAll('.holding-tank-drop-above, .holding-tank-drop-below').forEach(el => {
      el.classList.remove('holding-tank-drop-above', 'holding-tank-drop-below');
    });
  }
} 