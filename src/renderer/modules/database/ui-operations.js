/**
 * UI Operations
 * 
 * Provides UI-related functions for the database module
 */

import { scaleScrollable } from '../utils/index.js';

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

// Default export for module loading
export default {
  scaleScrollable
}; 