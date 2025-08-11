/**
 * Audio Control Events Module
 * 
 * Handles all audio control event handlers that were previously in renderer.js.
 * Includes play/pause/stop buttons, volume control, progress bar, and waveform.
 */

export default class AudioControlEvents {
  constructor(dependencies = {}) {
    this.electronAPI = dependencies.electronAPI || window.electronAPI;
    this.db = null;
    this.store = null;
    this.debugLog = dependencies.debugLog || window.debugLog;
    this.moduleRegistry = dependencies.moduleRegistry || window.moduleRegistry;
    
    this.eventsAttached = false;
    this.audioHandlers = new Map();
  }

  /**
   * Attach all audio control event handlers
   */
  async attachAudioControlEvents() {
    try {
      if (this.eventsAttached) {
        this.debugLog?.warn('Audio control events already attached');
        return;
      }

      this.debugLog?.info('Attaching audio control event handlers...');

      // Playback control buttons
      this.attachPlaybackControlEvents();

      // Volume and mute controls
      this.attachVolumeControlEvents();

      // Progress and waveform controls
      this.attachProgressControlEvents();

      // Loop control
      this.attachLoopControlEvents();

      // Waveform display toggle
      this.attachWaveformDisplayEvents();

      this.eventsAttached = true;
      this.debugLog?.info('Audio control event handlers attached successfully');

    } catch (error) {
      this.debugLog?.error('Failed to attach audio control events:', error);
    }
  }

  /**
   * Playback control events (lines 924-979 from renderer.js)
   */
  attachPlaybackControlEvents() {
    // Pause button handler
    const pauseButtonHandler = (event) => {
      try {
        this.debugLog?.debug('Pause button clicked');
        this.debugLog?.debug('window.pausePlaying function', typeof window.pausePlaying);
        
        if (window.pausePlaying) {
          if (event.shiftKey) {
            window.pausePlaying(true);
          } else {
            window.pausePlaying();
          }
        } else {
          this.debugLog?.error('pausePlaying function not available');
        }
      } catch (error) {
        this.debugLog?.error('Error in pause button handler:', error);
      }
    };

    // Play button handler
    const playButtonHandler = (event) => {
      try {
        this.debugLog?.debug('Play button clicked');
        this.debugLog?.debug('window.pausePlaying function', typeof window.pausePlaying);
        this.debugLog?.debug('window.playSelected function', typeof window.playSelected);
        
        if (window.pausePlaying && window.playSelected) {
          // Check if there's already a sound loaded and paused
          import('../shared-state.js').then(sharedStateModule => {
            const sharedState = sharedStateModule.default;
            const sound = sharedState.get('sound');
            
            if (sound && sound.state() === 'loaded' && !sound.playing()) {
              // Sound is loaded but not playing - resume it
              this.debugLog?.debug('Resuming paused sound');
              window.pausePlaying();
            } else {
              // No sound or sound is playing - play selected song
              this.debugLog?.debug('Playing selected song');
              window.playSelected();
            }
          }).catch(error => {
            this.debugLog?.error('Failed to import shared state', error);
            // Fallback to playSelected
            window.playSelected();
          });
        } else {
          this.debugLog?.error('Required functions not available');
        }
      } catch (error) {
        this.debugLog?.error('Error in play button handler:', error);
      }
    };

    // Stop button handler
    const stopButtonHandler = (event) => {
      try {
        this.debugLog?.debug('Stop button clicked');
        this.debugLog?.debug('window.stopPlaying function', typeof window.stopPlaying);
        
        if (window.stopPlaying) {
          if (event.shiftKey) {
            window.stopPlaying(true);
          } else {
            window.stopPlaying();
          }
        } else {
          this.debugLog?.error('stopPlaying function not available');
        }
      } catch (error) {
        this.debugLog?.error('Error in stop button handler:', error);
      }
    };

    document.getElementById('pause_button')?.addEventListener('click', pauseButtonHandler);
    document.getElementById('play_button')?.addEventListener('click', playButtonHandler);
    document.getElementById('stop_button')?.addEventListener('click', stopButtonHandler);

    this.audioHandlers.set('pauseButton', { element: '#pause_button', event: 'click', handler: pauseButtonHandler });
    this.audioHandlers.set('playButton', { element: '#play_button', event: 'click', handler: playButtonHandler });
    this.audioHandlers.set('stopButton', { element: '#stop_button', event: 'click', handler: stopButtonHandler });
    
    this.debugLog?.debug('Playback control events attached');
  }

  /**
   * Volume control events (lines 1025-1071 from renderer.js)
   */
  attachVolumeControlEvents() {
    // Volume slider handler
    const volumeChangeHandler = (event) => {
      try {
        this.debugLog?.debug('Volume changed');
        const volume = (Number(event.target?.value) || 0) / 100;
        this.debugLog?.debug('New volume', volume);
        
        // Get sound from shared state
        if (this.electronAPI && this.electronAPI.store) {
          // Import shared state to get sound object
          import('../shared-state.js').then(sharedStateModule => {
            const sharedState = sharedStateModule.default;
            const sound = sharedState.get('sound');
            if (sound) {
              this.debugLog?.debug('Setting volume on sound object');
              sound.volume(volume);
            } else {
              this.debugLog?.debug('No sound object found in shared state');
            }
          }).catch(error => {
            this.debugLog?.error('Failed to import shared state', error);
          });
        }
      } catch (error) {
        this.debugLog?.error('Error in volume change handler:', error);
      }
    };

    // Mute button handler
    const muteButtonHandler = (event) => {
      try {
        this.debugLog?.debug('Mute button clicked');
        
        // Get sound from shared state
        if (this.electronAPI && this.electronAPI.store) {
          import('../shared-state.js').then(sharedStateModule => {
            const sharedState = sharedStateModule.default;
            const sound = sharedState.get('sound');
            if (sound) {
              this.debugLog?.debug('Toggling mute on sound object');
              sound.mute(!sound.mute());
              const volEl = document.getElementById('volume');
              sound.volume(volEl ? (Number(volEl.value) || 0) / 100 : 1);
            } else {
              this.debugLog?.debug('No sound object found in shared state');
            }
          }).catch(error => {
            this.debugLog?.error('Failed to import shared state', error);
          });
        }
        
        // Toggle UI state
        document.getElementById('mute_button')?.classList.toggle('active');
        document.getElementById('song_now_playing')?.classList.toggle('text-secondary');
      } catch (error) {
        this.debugLog?.error('Error in mute button handler:', error);
      }
    };

    document.getElementById('volume')?.addEventListener('change', volumeChangeHandler);
    document.getElementById('mute_button')?.addEventListener('click', muteButtonHandler);

    this.audioHandlers.set('volumeChange', { element: '#volume', event: 'change', handler: volumeChangeHandler });
    this.audioHandlers.set('muteButton', { element: '#mute_button', event: 'click', handler: muteButtonHandler });
    
    this.debugLog?.debug('Volume control events attached');
  }

  /**
   * Progress and waveform control events (lines 981-1023 from renderer.js)
   */
  attachProgressControlEvents() {
    // Progress bar click handler
    const progressBarClickHandler = (event) => {
      try {
        this.debugLog?.debug('Progress bar clicked');
        const rect = event.currentTarget.getBoundingClientRect();
        const percent = (event.clientX - rect.left) / rect.width;
        this.debugLog?.debug('Progress bar click - percent', percent);
        
        // Get sound from shared state
        if (this.electronAPI && this.electronAPI.store) {
          import('../shared-state.js').then(sharedStateModule => {
            const sharedState = sharedStateModule.default;
            const sound = sharedState.get('sound');
            if (sound) {
              this.debugLog?.debug('Seeking to position in sound');
              sound.seek(sound.duration() * percent);
            } else {
              this.debugLog?.debug('No sound object found in shared state');
            }
          }).catch(error => {
            this.debugLog?.error('Failed to import shared state', error);
          });
        }
      } catch (error) {
        this.debugLog?.error('Error in progress bar click handler:', error);
      }
    };

    // Waveform click handler
    const waveformClickHandler = (event) => {
      try {
        this.debugLog?.debug('Waveform clicked');
        const rect = event.currentTarget.getBoundingClientRect();
        const percent = (event.clientX - rect.left) / rect.width;
        this.debugLog?.debug('Waveform click - percent', percent);
        
        // Get sound from shared state
        if (this.electronAPI && this.electronAPI.store) {
          import('../shared-state.js').then(sharedStateModule => {
            const sharedState = sharedStateModule.default;
            const sound = sharedState.get('sound');
            if (sound) {
              this.debugLog?.debug('Seeking to position in sound');
              sound.seek(sound.duration() * percent);
            } else {
              this.debugLog?.debug('No sound object found in shared state');
            }
          }).catch(error => {
            this.debugLog?.error('Failed to import shared state', error);
          });
        }
      } catch (error) {
        this.debugLog?.error('Error in waveform click handler:', error);
      }
    };

    document.getElementById('progress_bar')?.addEventListener('click', progressBarClickHandler);
    document.getElementById('waveform')?.addEventListener('click', waveformClickHandler);

    this.audioHandlers.set('progressBarClick', { element: '#progress_bar', event: 'click', handler: progressBarClickHandler });
    this.audioHandlers.set('waveformClick', { element: '#waveform', event: 'click', handler: waveformClickHandler });
    
    this.debugLog?.debug('Progress control events attached');
  }

  /**
   * Loop control events (lines 1073-1104 from renderer.js)
   */
  attachLoopControlEvents() {
    const loopButtonHandler = (event) => {
      try {
        this.debugLog?.debug('Loop button clicked');
        this.debugLog?.debug('window.loop_on function', typeof window.loop_on);
        
        if (window.loop_on) {
          // Get current loop state from shared state
          if (this.electronAPI && this.electronAPI.store) {
            import('../shared-state.js').then(sharedStateModule => {
              const sharedState = sharedStateModule.default;
              const currentLoop = sharedState.get('loop');
              const newLoop = !currentLoop;
              
              this.debugLog?.debug('Toggling loop state', { currentLoop, newLoop });
              sharedState.set('loop', newLoop);
              window.loop_on(newLoop);
            }).catch(error => {
              this.debugLog?.error('Failed to import shared state', error);
              // Fallback to simple toggle
              const loopButton = document.getElementById('loop_button');
              const isActive = loopButton?.classList.contains('active') || false;
              window.loop_on(!isActive);
            });
          } else {
            // Fallback to simple toggle
            const loopButton = document.getElementById('loop_button');
            const isActive = loopButton?.classList.contains('active') || false;
            window.loop_on(!isActive);
          }
        } else {
          this.debugLog?.error('loop_on function not available');
        }
      } catch (error) {
        this.debugLog?.error('Error in loop button handler:', error);
      }
    };

    document.getElementById('loop_button')?.addEventListener('click', loopButtonHandler);
    this.audioHandlers.set('loopButton', { element: '#loop_button', event: 'click', handler: loopButtonHandler });
    
    this.debugLog?.debug('Loop control events attached');
  }

  /**
   * Waveform display toggle events (lines 1106-1108 from renderer.js)
   */
  attachWaveformDisplayEvents() {
    const waveformButtonHandler = (event) => {
      try {
        if (window.toggleWaveform) {
          window.toggleWaveform();
        } else {
          this.debugLog?.warn('toggleWaveform function not available');
        }
      } catch (error) {
        this.debugLog?.error('Error in waveform button handler:', error);
      }
    };

    document.getElementById('waveform_button')?.addEventListener('click', waveformButtonHandler);
    this.audioHandlers.set('waveformButton', { element: '#waveform_button', event: 'click', handler: waveformButtonHandler });
    
    this.debugLog?.debug('Waveform display events attached');
  }

  /**
   * Detach all audio control events
   */
  detachEvents() {
    try {
      this.debugLog?.info('Detaching audio control events...');

      for (const [name, handler] of this.audioHandlers) {
        handler.element && (handler.el || document.querySelector(handler.element))?.removeEventListener(handler.event, handler.handler);
        this.debugLog?.debug(`Removed audio handler: ${name}`);
      }

      this.audioHandlers.clear();
      this.eventsAttached = false;
      
      this.debugLog?.info('Audio control events detached successfully');

    } catch (error) {
      this.debugLog?.error('Failed to detach audio control events:', error);
    }
  }

  /**
   * Get audio control events status
   */
  getStatus() {
    return {
      eventsAttached: this.eventsAttached,
      handlerCount: this.audioHandlers.size,
      handlers: Array.from(this.audioHandlers.keys())
    };
  }
}
