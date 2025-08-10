/**
 * Utility functions for debug logging
 * @module debug-log-utils
 */

/**
 * Safely stringify an object, handling circular references
 * @param {*} obj - Object to stringify
 * @returns {string} Safe string representation
 */
export function safeStringify(obj) {
  try {
    return JSON.stringify(obj);
  } catch (error) {
    if (error.message.includes('circular')) {
      // Handle circular references by creating a simplified representation
      const seen = new WeakSet();
      const replacer = (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) {
            return '[Circular Reference]';
          }
          seen.add(value);
        }
        return value;
      };
      
      try {
        return JSON.stringify(obj, replacer);
      } catch (secondError) {
        return '[Object with circular references]';
      }
    }
    return '[Object that cannot be stringified]';
  }
}

/**
 * Safely get a string representation of any value
 * @param {*} value - Value to convert to string
 * @returns {string} Safe string representation
 */
export function safeToString(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'function') return '[Function]';
  if (typeof value === 'object') {
    return safeStringify(value);
  }
  return String(value);
}

export default {
  safeStringify,
  safeToString
};
