/**
 * Shared State Manager
 * 
 * Provides a centralized state management system for the MxVoice application.
 * This replaces the need for global variables scattered across modules.
 */

class SharedState {
  constructor() {
    this.state = {
      // Audio state
      sound: null,
      globalAnimation: null,
      wavesurfer: null,
      autoplay: false,
      loop: false,
      
      // UI state
      holdingTankMode: "storage", // 'storage' or 'playlist'
      fontSize: 11,
      
      // Data state
      categories: {},
      
      // Legacy database reference (for fallback)
      db: null
    };
    
    this.listeners = new Map();
  }

  /**
   * Get a state value
   * 
   * @param {string} key - The state key to get
   * @returns {*} - The state value
   */
  get(key) {
    return this.state[key];
  }

  /**
   * Set a state value
   * 
   * @param {string} key - The state key to set
   * @param {*} value - The value to set
   */
  set(key, value) {
    this.state[key] = value;
    this.notifyListeners(key, value);
  }

  /**
   * Subscribe to state changes
   * 
   * @param {string} key - The state key to listen to
   * @param {Function} callback - The callback function
   * @returns {Function} - Unsubscribe function
   */
  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(key);
      if (callbacks) {
        callbacks.delete(callback);
      }
    };
  }

  /**
   * Notify listeners of state changes
   * 
   * @param {string} key - The state key that changed
   * @param {*} value - The new value
   */
  notifyListeners(key, value) {
    const callbacks = this.listeners.get(key);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(value);
        } catch (error) {
          console.error(`Error in state listener for ${key}:`, error);
        }
      });
    }
  }

  /**
   * Get all state
   * 
   * @returns {Object} - The complete state object
   */
  getAll() {
    return { ...this.state };
  }

  /**
   * Reset state to defaults
   */
  reset() {
    this.state = {
      sound: null,
      globalAnimation: null,
      wavesurfer: null,
      autoplay: false,
      loop: false,
      holdingTankMode: "storage",
      fontSize: 11,
      categories: {},
      db: null
    };
  }
}

// Create and export a singleton instance
const sharedState = new SharedState();

// Export the singleton and individual methods for convenience
export default sharedState;

// Also export individual methods for direct access
export const getState = (key) => sharedState.get(key);
export const setState = (key, value) => sharedState.set(key, value);
export const subscribe = (key, callback) => sharedState.subscribe(key, callback);
export const getAllState = () => sharedState.getAll();
export const resetState = () => sharedState.reset(); 