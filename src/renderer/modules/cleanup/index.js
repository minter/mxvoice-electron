/**
 * Cleanup Module
 * 
 * Handles cleanup of resources when the window is closing.
 * While profile switching uses app.exit(0) which cleans up the process,
 * this module ensures proper cleanup for normal quit scenarios and
 * follows best practices for resource management.
 */

import sharedState from '../shared-state.js';

let debugLog = null;
let eventCoordination = null;

/**
 * Initialize the cleanup module
 * @param {Object} dependencies - Module dependencies
 * @param {Object} dependencies.debugLog - Debug logger instance
 * @param {Object} dependencies.eventCoordination - Event coordination instance
 */
function initializeCleanup(dependencies = {}) {
  debugLog = dependencies.debugLog || window.debugLog || null;
  eventCoordination = dependencies.eventCoordination || window.eventCoordination || null;
  
  debugLog?.info('Cleanup module initializing', {
    module: 'cleanup',
    function: 'initializeCleanup'
  });
  
  // Register cleanup handler for window unload
  window.addEventListener('beforeunload', handleBeforeUnload);
  
  debugLog?.info('Cleanup module initialized successfully', {
    module: 'cleanup',
    function: 'initializeCleanup'
  });
  
  return {
    cleanup: performCleanup
  };
}

/**
 * Handle beforeunload event
 * @param {Event} event - The beforeunload event
 */
function handleBeforeUnload(event) {
  debugLog?.info('Window closing, performing cleanup', {
    module: 'cleanup',
    function: 'handleBeforeUnload'
  });
  
  performCleanup();
}

/**
 * Perform cleanup of all resources
 * Can be called manually or automatically on beforeunload
 */
function performCleanup() {
  try {
    // 1. Cancel any active animation frames
    cleanupAnimationFrames();
    
    // 2. Unload audio resources
    cleanupAudio();
    
    // 3. Cleanup event listeners
    cleanupEventListeners();
    
    debugLog?.info('Cleanup completed successfully', {
      module: 'cleanup',
      function: 'performCleanup'
    });
  } catch (error) {
    debugLog?.error('Error during cleanup', {
      module: 'cleanup',
      function: 'performCleanup',
      error: error.message
    });
  }
}

/**
 * Cancel any active requestAnimationFrame callbacks
 */
function cleanupAnimationFrames() {
  try {
    const animationId = sharedState.get('globalAnimation');
    if (animationId) {
      cancelAnimationFrame(animationId);
      sharedState.set('globalAnimation', null);
      
      debugLog?.info('Animation frame canceled', {
        module: 'cleanup',
        function: 'cleanupAnimationFrames',
        animationId: animationId
      });
    }
  } catch (error) {
    debugLog?.warn('Failed to cleanup animation frames', {
      module: 'cleanup',
      function: 'cleanupAnimationFrames',
      error: error.message
    });
  }
}

/**
 * Unload audio resources (Howler.js sound instances)
 */
function cleanupAudio() {
  try {
    const sound = sharedState.get('sound');
    if (sound && typeof sound.unload === 'function') {
      // Remove any fade event listeners
      if (typeof sound.off === 'function') {
        sound.off('fade');
      }
      
      // Unload the sound
      sound.unload();
      sharedState.set('sound', null);
      
      debugLog?.info('Audio resources unloaded', {
        module: 'cleanup',
        function: 'cleanupAudio'
      });
    }
  } catch (error) {
    debugLog?.warn('Failed to cleanup audio resources', {
      module: 'cleanup',
      function: 'cleanupAudio',
      error: error.message
    });
  }
}

/**
 * Cleanup event listeners through event coordination
 */
function cleanupEventListeners() {
  try {
    // Try to get event coordination from multiple sources
    const coordination = eventCoordination || window.eventCoordination;
    
    if (coordination?.eventDelegator?.cleanup) {
      coordination.eventDelegator.cleanup();
      
      debugLog?.info('Event listeners cleaned up', {
        module: 'cleanup',
        function: 'cleanupEventListeners'
      });
    } else {
      debugLog?.debug('Event coordination cleanup not available', {
        module: 'cleanup',
        function: 'cleanupEventListeners'
      });
    }
  } catch (error) {
    debugLog?.warn('Failed to cleanup event listeners', {
      module: 'cleanup',
      function: 'cleanupEventListeners',
      error: error.message
    });
  }
}

/**
 * Manually trigger cleanup
 * Useful for testing or explicit cleanup scenarios
 */
export function cleanup() {
  performCleanup();
}

// Export initialization function
export { initializeCleanup };

// Default export
export default {
  initializeCleanup,
  cleanup
};

