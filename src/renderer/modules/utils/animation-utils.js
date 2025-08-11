/**
 * Animation Utilities
 * 
 * Provides CSS animation utilities for the MxVoice Electron application
 */

/**
 * Animate CSS class on an element
 * 
 * @param {HTMLElement} element - The element to animate
 * @param {string} animation - The CSS animation class name
 * @param {string} prefix - The CSS prefix (default: 'animate__')
 * @returns {Promise} - Promise that resolves when animation completes
 */
export function animateCSS(element, animation, prefix = 'animate__') {
  return new Promise((resolve, reject) => {
    const animationName = `${prefix}${animation}`;
    const node = element;

    node.classList.add(`${prefix}animated`, animationName);

    function handleAnimationEnd(event) {
      event.stopPropagation();
      node.classList.remove(`${prefix}animated`, animationName);
      resolve('Animation ended');
    }

    node.addEventListener('animationend', handleAnimationEnd, { once: true });
  });
}

// Default export for module loading
export default {
  animateCSS
}; 