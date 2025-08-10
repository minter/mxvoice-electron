/**
 * Event Coordination Module - Main Entry Point
 * 
 * This module coordinates all jQuery event handlers that were previously in renderer.js.
 * It provides a centralized way to manage DOM event handling and ensure proper
 * initialization order.
 * 
 * Phase 2 of the renderer.js modularization plan.
 */

import SearchEvents from './search-events.js';
import AudioControlEvents from './audio-control-events.js';
import UIInteractionEvents from './ui-interaction-events.js';
import DOMInitialization from './dom-initialization.js';
import EventDelegator from './event-delegator.js';

/**
 * Event Coordination Class
 * Manages all event handlers and their initialization
 */
class EventCoordination {
  constructor(dependencies = {}) {
    this.electronAPI = dependencies.electronAPI || window.electronAPI;
    this.db = null;
    this.store = null;
    this.debugLog = dependencies.debugLog || window.debugLog;
    this.moduleRegistry = dependencies.moduleRegistry || window.moduleRegistry;
    
    // Event handler modules
    this.searchEvents = null;
    this.audioControlEvents = null;
    this.uiInteractionEvents = null;
    this.domInitialization = null;
    this.eventDelegator = null;
    
    // Initialization state
    this.initialized = false;
    this.eventHandlersAttached = false;
  }

  /**
   * Initialize all event handlers
   * This replaces the jQuery event setup that was in renderer.js
   */
  async initialize() {
    try {
      if (this.initialized) {
        this.debugLog?.warn('Event coordination already initialized');
        return true;
      }

      this.debugLog?.info('Initializing event coordination module...');

      // Create event handler instances
      this.searchEvents = new SearchEvents({
        electronAPI: this.electronAPI,
        db: this.db,
        store: this.store,
        debugLog: this.debugLog,
        moduleRegistry: this.moduleRegistry
      });

      this.audioControlEvents = new AudioControlEvents({
        electronAPI: this.electronAPI,
        db: this.db,
        store: this.store,
        debugLog: this.debugLog,
        moduleRegistry: this.moduleRegistry
      });

      this.uiInteractionEvents = new UIInteractionEvents({
        electronAPI: this.electronAPI,
        db: this.db,
        store: this.store,
        debugLog: this.debugLog,
        moduleRegistry: this.moduleRegistry
      });

      this.domInitialization = new DOMInitialization({
        electronAPI: this.electronAPI,
        db: this.db,
        store: this.store,
        debugLog: this.debugLog,
        moduleRegistry: this.moduleRegistry
      });

      this.eventDelegator = new EventDelegator({
        electronAPI: this.electronAPI,
        db: this.db,
        store: this.store,
        debugLog: this.debugLog,
        moduleRegistry: this.moduleRegistry
      });

      this.initialized = true;
      this.debugLog?.info('Event coordination module initialized successfully');
      return true;

    } catch (error) {
      this.debugLog?.error('Failed to initialize event coordination module:', error);
      return false;
    }
  }

  /**
   * Attach all event handlers to the DOM
   * This should be called after DOM is ready
   */
  async attachEventHandlers() {
    try {
      if (this.eventHandlersAttached) {
        this.debugLog?.warn('Event handlers already attached');
        return true;
      }

      if (!this.initialized) {
        await this.initialize();
      }

      this.debugLog?.info('Attaching event handlers...');

      // Initialize DOM structure first
      await this.domInitialization.initializeDOMStructure();

      // Set up event delegation
      await this.eventDelegator.setupEventDelegation();

      // Attach specific event handlers
      await this.searchEvents.attachSearchEvents();
      await this.audioControlEvents.attachAudioControlEvents();
      await this.uiInteractionEvents.attachUIInteractionEvents();

      this.eventHandlersAttached = true;
      this.debugLog?.info('All event handlers attached successfully');
      return true;

    } catch (error) {
      this.debugLog?.error('Failed to attach event handlers:', error);
      return false;
    }
  }

  /**
   * Detach all event handlers (for cleanup/testing)
   */
  detachEventHandlers() {
    try {
      this.debugLog?.info('Detaching event handlers...');

      if (this.searchEvents) this.searchEvents.detachEvents();
      if (this.audioControlEvents) this.audioControlEvents.detachEvents();
      if (this.uiInteractionEvents) this.uiInteractionEvents.detachEvents();
      if (this.eventDelegator) this.eventDelegator.cleanup();

      this.eventHandlersAttached = false;
      this.debugLog?.info('All event handlers detached');

    } catch (error) {
      this.debugLog?.error('Failed to detach event handlers:', error);
    }
  }

  /**
   * Get module status for debugging
   */
  getStatus() {
    return {
      initialized: this.initialized,
      eventHandlersAttached: this.eventHandlersAttached,
      modules: {
        searchEvents: !!this.searchEvents,
        audioControlEvents: !!this.audioControlEvents,
        uiInteractionEvents: !!this.uiInteractionEvents,
        domInitialization: !!this.domInitialization,
        eventDelegator: !!this.eventDelegator
      }
    };
  }
}

// Function-based interface for backward compatibility
function initializeEventCoordination(dependencies = {}) {
  const eventCoordination = new EventCoordination(dependencies);
  return eventCoordination;
}

// Export both class and function
export { EventCoordination, initializeEventCoordination };
export default EventCoordination;
