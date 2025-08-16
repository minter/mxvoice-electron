/**
 * Layout Utilities
 * 
 * Provides layout and positioning utilities for the MxVoice Electron application
 */

/**
 * Scale scrollable elements based on viewport and advanced search visibility
 * Adjusts the height of table wrapper elements to fit the available space
 */
export function scaleScrollable() {
  const advancedSearchHeight = document.getElementById('advanced-search')?.offsetParent !== null ? 38 : 0;
  const height = (window.innerHeight || document.documentElement.clientHeight) - 240 - advancedSearchHeight + 'px';
  
  document.querySelectorAll('.table-wrapper-scroll-y').forEach(el => { 
    el.style.height = height; 
  });
}

// Default export for module loading
export default {
  scaleScrollable
};
