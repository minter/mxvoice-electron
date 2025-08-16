/**
 * Controls Module
 * 
 * Handles UI control functions including font size adjustments, waveform display,
 * and advanced search toggles.
 * 
 * @module controls
 */

import Dom from '../dom-utils/index.js';
import { animateCSS, scaleScrollable } from '../utils/index.js';

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
 * Initialize the Controls module
 * @param {Object} options - Configuration options
 * @param {Object} options.electronAPI - Electron API reference
 * @param {Object} options.db - Database reference
 * @param {Object} options.store - Store reference
 * @returns {Object} Controls interface
 */
function initializeControls(options = {}) {
  const { electronAPI } = options;
  let fontSize = 11; // Default font size
  
  /**
   * Increase font size
   */
  function increaseFontSize() {
    if (fontSize < 25) {
      fontSize++;
      document.querySelectorAll('.song').forEach(el => { el.style.fontSize = fontSize + 'px'; });
      if (electronAPI && electronAPI.store) {
        electronAPI.store.set("font-size", fontSize).catch(error => {
          debugLog?.warn('Failed to save font size', { 
            module: 'ui-controls',
            function: 'increaseFontSize',
            error: error
          });
        });
      }
    }
  }
  
  /**
   * Decrease font size
   */
  function decreaseFontSize() {
    if (fontSize > 5) {
      fontSize--;
      document.querySelectorAll('.song').forEach(el => { el.style.fontSize = fontSize + 'px'; });
      if (electronAPI && electronAPI.store) {
        electronAPI.store.set("font-size", fontSize).catch(error => {
          debugLog?.warn('Failed to save font size', { 
            module: 'ui-controls',
            function: 'decreaseFontSize',
            error: error
          });
        });
      }
    }
  }
  
  /**
   * Toggle waveform display
   */
  function toggleWaveform() {
    if (!Dom.$('#waveform')) return;
    if (Dom.hasClass('#waveform', 'hidden')) {
      Dom.removeClass('#waveform', 'hidden');
      Dom.addClass('#waveform_button', 'active');
      animateCSS('#waveform', 'fadeInUp').then(() => {
        // Create WaveSurfer when waveform becomes visible
        if (window.sharedState && window.sharedState.get('createWaveSurfer')) {
          window.sharedState.get('createWaveSurfer')();
        }
      });
    } else {
      Dom.removeClass('#waveform_button', 'active');
      animateCSS('#waveform', 'fadeOutDown').then(() => {
        Dom.addClass('#waveform', 'hidden');
      });
    }
  }
  
  /**
   * Toggle advanced search display
   */
  function toggleAdvancedSearch() {
    try {
      debugLog?.info("toggleAdvancedSearch called", { 
        module: 'ui-controls',
        function: 'toggleAdvancedSearch'
      });
      
      const adv = Dom.$('#advanced-search');
      if (adv) {
        const display = adv ? getComputedStyle(adv).display : '';
        debugLog?.info("Advanced search display: " + display, { 
        module: 'ui-controls',
        function: 'toggleAdvancedSearch'
        });
      }

      if (Dom.isVisible('#advanced-search')) {
        debugLog?.info("Hiding advanced search", { 
          module: 'ui-controls',
          function: 'toggleAdvancedSearch'
        });
        // Toggle icon classes manually
        const icon = Dom.$('#advanced-search-icon');
        if (icon) {
          if (Dom.hasClass(icon, 'fa-plus')) { Dom.removeClass(icon, 'fa-plus'); Dom.addClass(icon, 'fa-minus'); }
          else { Dom.removeClass(icon, 'fa-minus'); Dom.addClass(icon, 'fa-plus'); }
        }
        Dom.hide('#title-search');
        Dom.show('#omni_search');
        Dom.$('#omni_search')?.focus();
        animateCSS('#advanced-search', 'fadeOutUp').then(() => {
          Dom.hide('#advanced-search');
          scaleScrollable();
        });
      } else {
        debugLog?.info("Showing advanced search", { 
          module: 'ui-controls',
          function: 'toggleAdvancedSearch'
        });
        const icon = Dom.$('#advanced-search-icon');
        if (icon) {
          if (Dom.hasClass(icon, 'fa-plus')) { Dom.removeClass(icon, 'fa-plus'); Dom.addClass(icon, 'fa-minus'); }
          else { Dom.removeClass(icon, 'fa-minus'); Dom.addClass(icon, 'fa-plus'); }
        }
        Dom.show('#advanced-search');
        Dom.show('#title-search');
        Dom.$('#title-search')?.focus();
        Dom.hide('#omni_search');
        scaleScrollable();
        animateCSS('#advanced-search', 'fadeInDown').then(() => {});
      }
    } catch (error) {
      debugLog?.error("Error in toggleAdvancedSearch", { 
        module: 'ui-controls',
        function: 'toggleAdvancedSearch',
        error: error
      });
    }
  }
  
  return {
    increaseFontSize,
    decreaseFontSize,
    toggleWaveform,
    toggleAdvancedSearch
  };
}

export {
  initializeControls
};

// Default export for module loading
export default initializeControls; 