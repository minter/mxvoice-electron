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
      // Save to profile preferences (not global store)
      if (electronAPI && electronAPI.profile) {
        electronAPI.profile.setPreference("font_size", fontSize).catch(error => {
          debugLog?.warn('Failed to save font size to profile', { 
            module: 'ui-controls',
            function: 'increaseFontSize',
            error: error
          });
        });
      } else if (electronAPI && electronAPI.store) {
        // Fallback to global store if profile API not available
        electronAPI.store.set("font_size", fontSize).catch(error => {
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
      // Save to profile preferences (not global store)
      if (electronAPI && electronAPI.profile) {
        electronAPI.profile.setPreference("font_size", fontSize).catch(error => {
          debugLog?.warn('Failed to save font size to profile', { 
            module: 'ui-controls',
            function: 'decreaseFontSize',
            error: error
          });
        });
      } else if (electronAPI && electronAPI.store) {
        // Fallback to global store if profile API not available
        electronAPI.store.set("font_size", fontSize).catch(error => {
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
      debugLog?.info("toggleAdvancedSearch called", { module: 'ui-controls', function: 'toggleAdvancedSearch' });
  
      const panel = Dom.$('#advanced-search');         // panel container
      const btn   = Dom.$('#advanced_search_button');  // the button
      const icon  = btn ? btn.querySelector('i') : null; // the FA icon INSIDE the button
  
      if (!panel) return;
  
      const isOpen = Dom.isVisible('#advanced-search');
  
      if (isOpen) {
        debugLog?.info("Hiding advanced search", { module: 'ui-controls', function: 'toggleAdvancedSearch' });
  
        // Icon: set to PLUS when closed
        if (icon) {
          Dom.removeClass(icon, 'fa-minus');
          Dom.addClass(icon,   'fa-plus');
        }
        if (btn) btn.setAttribute('aria-expanded', 'false');
  
        Dom.hide('#title-search');
        Dom.show('#omni_search');
        Dom.$('#omni_search')?.focus();
  
        // Animate out, then hide
        animateCSS('#advanced-search', 'fadeOutUp').then(() => {
          Dom.hide('#advanced-search');
          scaleScrollable();
        });
      } else {
        debugLog?.info("Showing advanced search", { module: 'ui-controls', function: 'toggleAdvancedSearch' });
  
        // Icon: set to MINUS when open
        if (icon) {
          Dom.removeClass(icon, 'fa-plus');
          Dom.addClass(icon,   'fa-minus');
        }
        if (btn) btn.setAttribute('aria-expanded', 'true');
  
        Dom.show('#advanced-search');
        Dom.show('#title-search');
        Dom.$('#title-search')?.focus();
        Dom.hide('#omni_search');
  
        scaleScrollable();
        animateCSS('#advanced-search', 'fadeInDown').then(() => {});
      }
    } catch (error) {
      debugLog?.error("Error in toggleAdvancedSearch", { module: 'ui-controls', function: 'toggleAdvancedSearch', error });
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