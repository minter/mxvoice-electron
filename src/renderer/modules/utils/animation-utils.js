/**
 * Animation Utilities
 * 
 * Provides CSS animation utilities for the MxVoice Electron application
 */

/**
 * Animate CSS class on an element
 * 
 * @param {HTMLElement|string} element - The element to animate (can be element or selector string)
 * @param {string} animation - The CSS animation class name
 * @param {string} speed - Animation speed (optional)
 * @param {string} prefix - The CSS prefix (default: 'animate__')
 * @returns {Promise} - Promise that resolves when animation completes
 */
export function animateCSS(element, animation, speed = "", prefix = 'animate__') {
  return new Promise((resolve, reject) => {
    const animationName = `${prefix}${animation} ${speed}`.trim();
    
    // Handle both element objects and selector strings
    const node = typeof element === 'string' ? document.querySelector(element) : element;
    if (!node) {
      resolve("No element found");
      return;
    }

    node.classList.add(`${prefix}animated`, animationName);

    function handleAnimationEnd() {
      node.classList.remove(`${prefix}animated`, animationName);
      node.removeEventListener('animationend', handleAnimationEnd);
      resolve("Animation ended");
    }

    node.addEventListener('animationend', handleAnimationEnd, { once: true });
  });
}

// Default export for module loading
export default {
  animateCSS
}; 