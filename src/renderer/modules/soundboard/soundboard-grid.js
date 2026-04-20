/**
 * Soundboard Grid Module
 * 
 * Handles grid layout and button management for the soundboard view.
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

// Grid configuration
const MIN_BUTTON_WIDTH = 120;
const MIN_BUTTON_HEIGHT = 80;
const BUTTON_GAP = 12;
const GRID_PADDING = 20;
const MAX_COLUMNS = 6;

/**
 * Calculate grid columns based on available width
 * @param {number} availableWidth - Available width in pixels
 * @returns {number} Number of columns
 */
function calculateColumns(availableWidth) {
  const buttonWidth = MIN_BUTTON_WIDTH;
  const totalGap = BUTTON_GAP * (MAX_COLUMNS - 1);
  const totalPadding = GRID_PADDING * 2;
  const maxColumns = Math.floor((availableWidth - totalPadding) / (buttonWidth + BUTTON_GAP));
  return Math.min(Math.max(1, maxColumns), MAX_COLUMNS);
}

/**
 * Initialize the soundboard grid
 */
function initializeGrid() {
  debugLog?.info('Initializing soundboard grid', {
    module: 'soundboard-grid',
    function: 'initializeGrid'
  });

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setupGrid();
    });
  } else {
    setupGrid();
  }
}

/**
 * Setup grid after DOM is ready
 */
function setupGrid() {
  // Initialize all 5 tab grids
  for (let tabNum = 1; tabNum <= 5; tabNum++) {
    const gridContainer = document.getElementById(`soundboard-grid-${tabNum}`);
    if (gridContainer) {
      // Create initial empty grid for this tab
      ensureGridButtonsForTab(tabNum);
    } else {
      debugLog?.warn(`Soundboard grid container ${tabNum} not found`, {
        module: 'soundboard-grid',
        function: 'setupGrid',
        tabNum
      });
    }
  }

  // Update layout for active tab
  updateGridLayout();

  // Listen for window resize
  window.addEventListener('resize', () => {
    updateGridLayout();
  });

  // Listen for tab changes
  const tabLinks = document.querySelectorAll('#soundboard_tabs .nav-link');
  tabLinks.forEach(link => {
    link.addEventListener('shown.bs.tab', () => {
      updateGridLayout();
    });
  });
}

/**
 * Update grid layout based on current window size
 */
function updateGridLayout() {
  // Find the active tab's grid
  const activeTab = document.querySelector('#soundboard_tabs .nav-link.active');
  if (!activeTab) {
    return;
  }

  const href = activeTab.getAttribute('href');
  if (!href || !href.startsWith('#')) {
    return;
  }

  const tabId = href.substring(1);
  const tabNumber = parseInt(tabId.replace('soundboard_list_', ''), 10);
  if (isNaN(tabNumber)) {
    return;
  }

  const gridContainer = document.getElementById(`soundboard-grid-${tabNumber}`);
  if (!gridContainer) {
    return;
  }

  const availableWidth = gridContainer.clientWidth - (GRID_PADDING * 2);
  const columns = calculateColumns(availableWidth);
  const buttonWidth = Math.floor((availableWidth - (BUTTON_GAP * (columns - 1))) / columns);

  debugLog?.debug('Updating grid layout', {
    module: 'soundboard-grid',
    function: 'updateGridLayout',
    tabNumber,
    columns,
    buttonWidth,
    availableWidth
  });

  // Set CSS custom properties for grid
  gridContainer.style.setProperty('--grid-columns', columns);
  gridContainer.style.setProperty('--button-width', `${buttonWidth}px`);
  gridContainer.style.setProperty('--button-gap', `${BUTTON_GAP}px`);
  gridContainer.style.setProperty('--grid-padding', `${GRID_PADDING}px`);

  // Ensure we have enough buttons for the grid
  ensureGridButtonsForTab(tabNumber, columns);
}

/**
 * Ensure grid has enough buttons for a specific tab
 * @param {number} tabNumber - Tab number (1-5)
 * @param {number} columns - Number of columns (optional, will calculate if not provided)
 */
function ensureGridButtonsForTab(tabNumber, columns = null) {
  const gridContainer = document.getElementById(`soundboard-grid-${tabNumber}`);
  if (!gridContainer) {
    return;
  }

  // Calculate columns if not provided
  if (columns === null) {
    const availableWidth = gridContainer.clientWidth - (GRID_PADDING * 2);
    columns = calculateColumns(availableWidth);
  }

  // Calculate how many buttons we need (columns * 5 rows minimum)
  const minButtons = columns * 5;
  const currentButtons = gridContainer.querySelectorAll('.soundboard-button').length;

  if (currentButtons < minButtons) {
    // Add more buttons
    for (let i = currentButtons; i < minButtons; i++) {
      const button = createGridButton(i);
      gridContainer.appendChild(button);
    }
  }
}

/**
 * Create a grid button element
 * @param {number} index - Button index
 * @returns {HTMLElement} Button element
 */
function createGridButton(index) {
  const button = document.createElement('button');
  button.className = 'soundboard-button';
  button.setAttribute('data-button-index', index);
  button.setAttribute('draggable', 'true');
  button.setAttribute('tabindex', '0');
  
  // Add placeholder content
  const placeholder = document.createElement('span');
  placeholder.className = 'soundboard-button-placeholder';
  placeholder.textContent = 'Drop song here';
  button.appendChild(placeholder);

  // Add song info container (hidden initially)
  const songInfo = document.createElement('div');
  songInfo.className = 'soundboard-button-info';
  button.appendChild(songInfo);

  return button;
}

/**
 * Get button position from index
 * @param {number} index - Button index
 * @param {number} columns - Number of columns
 * @returns {Object} Position object with row and col
 */
function getButtonPosition(index, columns) {
  const row = Math.floor(index / columns);
  const col = index % columns;
  return { row, col };
}

/**
 * Get button index from position
 * @param {number} row - Row number
 * @param {number} col - Column number
 * @param {number} columns - Number of columns
 * @returns {number} Button index
 */
function getButtonIndex(row, col, columns) {
  return row * columns + col;
}

/**
 * Reinitialize with dependencies
 */
async function reinitializeSoundboardGrid(deps) {
  if (deps.electronAPI) {
    electronAPI = deps.electronAPI;
  }
  if (deps.debugLog) {
    debugLog = deps.debugLog;
  }
}

export {
  initializeGrid,
  setupGrid,
  updateGridLayout,
  ensureGridButtonsForTab,
  createGridButton,
  getButtonPosition,
  getButtonIndex,
  calculateColumns,
  reinitializeSoundboardGrid
};

