/**
 * Audio Probe Module (Test Mode Only)
 * 
 * Provides audio signal analysis for E2E testing by measuring RMS
 * from Howler.js audio instances. Only active when E2E environment is set.
 */

let debugLog = null;
try {
  if (window.debugLog) {
    debugLog = window.debugLog;
  }
} catch (error) {
  // Debug logger not available
}

/**
 * Create an audio probe from Howler.js context
 * @param {AudioContext} ctx - Howler's audio context
 * @param {GainNode} masterGain - Howler's master gain node (optional)
 * @returns {Object} Probe interface with currentRMS and isSilent
 */
export function createProbeFromHowler(ctx, masterGain = null) {
  if (!ctx) return null;
  
  try {
    const analyser = new AnalyserNode(ctx, { fftSize: 2048 });
    analyser.smoothingTimeConstant = 0.2;
    
    // Connect to master gain if available, otherwise to destination
    if (masterGain) {
      masterGain.connect(analyser);
    } else {
      analyser.connect(ctx.destination);
    }
    
    return {
      currentRMS() {
        const buf = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          sum += buf[i] * buf[i];
        }
        return Math.sqrt(sum / buf.length);
      },
      isSilent(threshold = 1e-3) {
        return this.currentRMS() < threshold;
      }
    };
  } catch (error) {
    debugLog?.error('Failed to create probe from Howler:', {
      module: 'audio-probe',
      function: 'createProbeFromHowler',
      error: error.message
    });
    return null;
  }
}

/**
 * Install audio probe for testing with Howler.js
 * @returns {Object} Probe interface with currentRMS and isSilent
 */
export function installAudioProbe() {
  if (!window.electronTest?.isE2E) {
    debugLog?.info('Audio probe not installed - not in E2E mode', {
      module: 'audio-probe',
      function: 'installAudioProbe'
    });
    return null;
  }

  try {
    // Create a simple probe that checks for Howler context on each access
    const probe = {
      _analyser: null,
      
      _ensureAnalyser() {
        if (this._analyser) return;
        
        // Get Howler's internal audio context
        const howlerContext = window.Howler?.ctx;
        if (!howlerContext) {
          debugLog?.warn('Howler context not available for audio probe', {
            module: 'audio-probe',
            function: 'installAudioProbe._ensureAnalyser'
          });
          return;
        }
        
        // Create analyser node to tap into Howler's output
        this._analyser = new AnalyserNode(howlerContext, { fftSize: 2048 });
        this._analyser.smoothingTimeConstant = 0.2;
        
        // Connect to Howler's master gain node if available
        if (window.Howler?.masterGain) {
          window.Howler.masterGain.connect(this._analyser);
        } else {
          // Fallback: connect to destination
          this._analyser.connect(howlerContext.destination);
        }
        
        debugLog?.info('Audio probe analyser created and connected', {
          module: 'audio-probe',
          function: 'installAudioProbe._ensureAnalyser'
        });
      },
      
      currentRMS() {
        this._ensureAnalyser();
        if (!this._analyser) return 0;
        
        const buf = new Float32Array(this._analyser.fftSize);
        this._analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          sum += buf[i] * buf[i];
        }
        return Math.sqrt(sum / buf.length);
      },
      
      isSilent(threshold = 1e-3) {
        return this.currentRMS() < threshold;
      }
    };

    // Expose via preload bridge for Playwright access (context isolation safe)
    if (typeof window !== 'undefined' && window.electronTest?.setAudioProbe) {
      window.electronTest.setAudioProbe(probe);
    }

    debugLog?.info('Audio probe installed successfully with Howler.js (lazy)', {
      module: 'audio-probe',
      function: 'installAudioProbe'
    });

    return probe;
  } catch (error) {
    debugLog?.error('Failed to install audio probe:', {
      module: 'audio-probe',
      function: 'installAudioProbe',
      error: error.message
    });
    return null;
  }
}

/**
 * Create test oscillator for reliable testing
 * @returns {Object} Test oscillator interface
 */
export function createTestOscillator() {
  if (!window.electronTest?.isE2E) {
    return null;
  }

  try {
    // Get Howler's internal audio context
    const howlerContext = window.Howler?.ctx;
    if (!howlerContext) {
      debugLog?.warn('Howler context not available for test oscillator', {
        module: 'audio-probe',
        function: 'createTestOscillator'
      });
      return null;
    }

    const osc = new OscillatorNode(howlerContext, { 
      type: 'sine', 
      frequency: 440
    });
    
    // Connect to Howler's master gain if available
    if (window.Howler?.masterGain) {
      osc.connect(window.Howler.masterGain);
    } else {
      osc.connect(howlerContext.destination);
    }
    
    return {
      start: () => osc.start(),
      stop: () => osc.stop(),
      setFrequency: (freq) => osc.frequency.setValueAtTime(freq, howlerContext.currentTime),
      disconnect: () => osc.disconnect()
    };
  } catch (error) {
    debugLog?.error('Failed to create test oscillator:', {
      module: 'audio-probe',
      function: 'createTestOscillator',
      error: error.message
    });
    return null;
  }
}
