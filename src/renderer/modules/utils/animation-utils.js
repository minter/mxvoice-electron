/**
 * Animation Utilities Module
 * 
 * This module contains utility functions for handling CSS animations
 * in the MxVoice Electron application.
 */

/**
 * Animate an element using CSS animations
 * 
 * @param {jQuery|HTMLElement} element - The element to animate
 * @param {string} animation - The animation name (without prefix)
 * @param {string} speed - The animation speed (optional)
 * @param {string} prefix - The CSS class prefix (default: "animate__")
 * @returns {Promise} - Promise that resolves when animation completes
 */
const animateCSS = (element, animation, speed = "", prefix = "animate__") =>
  // We create a Promise and return it
  new Promise((resolve, reject) => {
    const animationName = `${prefix}${animation} ${speed}`;
    const node = element;

    node.addClass(`${prefix}animated ${animationName}`);

    // When the animation ends, we clean the classes and resolve the Promise
    function handleAnimationEnd() {
      node.removeClass(`${prefix}animated ${animationName}`);
      node.off("animationend", handleAnimationEnd);

      resolve("Animation ended");
    }

    node.on("animationend", handleAnimationEnd);
  });

// Export the animation utilities
module.exports = {
  animateCSS
}; 