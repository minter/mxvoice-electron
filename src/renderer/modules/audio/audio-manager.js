/**
 * Audio Manager Module
 *
 * This module handles the main audio playback functionality
 * in the MxVoice Electron application.
 */

// Import shared state
import sharedState from '../shared-state.js';
import { howlerUtils, createHowl } from './audio-utils.js';
import { createProbeFromHowler } from './audio-probe.js';

// Import debug logger - use lazy getter for proper initialization timing
function getDebugLog() {
  return window.debugLog || null;
}

/**
 * Create and install audio probe for E2E testing
 * @returns {Object|null} Audio probe or null if not in E2E mode
 */
function createAndInstallProbe() {
  if (!window.electronTest?.isE2E) return null;
  
  try {
    const ctx = window.Howler?.ctx;
    const masterGain = window.Howler?.masterGain;
    
    if (ctx && (masterGain || ctx.state === 'running')) {
      const probe = createProbeFromHowler(ctx, masterGain);
      if (probe && window.electronTest?.setAudioProbe) {
        window.electronTest.setAudioProbe(probe);
        return probe;
      }
    }
  } catch (error) {
    // Silent fail in E2E mode
  }
  return null;
}

// Import secure adapters
import {
  secureStore,
  secureDatabase,
  securePath,
} from '../adapters/secure-adapter.js';

// Cache for music directory to avoid repeated IPC calls
let cachedMusicDirectory = null;

/**
 * Initialize the music directory cache
 * This is called during module initialization to pre-fetch the music directory
 */
async function initializeMusicDirectoryCache() {
  try {
    const result = await secureStore.get('music_directory');
    cachedMusicDirectory = result.success && result.value ? result.value : null;
    getDebugLog()?.info('Music directory cache initialized', {
      module: 'audio-manager',
      function: 'initializeMusicDirectoryCache',
      musicDirectory: cachedMusicDirectory
    });
  } catch (error) {
    getDebugLog()?.error('Failed to initialize music directory cache', {
      module: 'audio-manager',
      function: 'initializeMusicDirectoryCache',
      error: error.message
    });
  }
}

/**
 * Update the cached music directory
 * This should be called whenever the music directory preference changes
 * @param {string} newDirectory - The new music directory path
 */
function updateMusicDirectoryCache(newDirectory) {
  cachedMusicDirectory = newDirectory;
  getDebugLog()?.info('Music directory cache updated', {
    module: 'audio-manager',
    function: 'updateMusicDirectoryCache',
    musicDirectory: cachedMusicDirectory
  });
}

/**
 * Play a song with the given filename and row data
 *
 * @param {string} filename - The filename of the song
 * @param {Object} row - The database row data
 * @param {string} song_id - The database ID of the song
 */
function playSongWithFilename(filename, row, song_id) {
  getDebugLog()?.info('Playing song', {
    module: 'audio-manager',
    function: 'playSongWithFilename',
    filename: filename,
    song_id: song_id,
    title: row?.title,
    cachedMusicDirectory: cachedMusicDirectory
  });

  // Use cached music directory if available, otherwise fetch it
  
  const musicDirectoryPromise = cachedMusicDirectory 
    ? Promise.resolve({ success: true, value: cachedMusicDirectory })
    : secureStore.get('music_directory').then(result => {
        // Cache the result for future use
        if (result.success && result.value) {
          cachedMusicDirectory = result.value;
        }
        return result;
      });
  
  musicDirectoryPromise
    .then((result) => {
      // Extract the actual value from the result object
      const musicDirectory =
        result.success && result.value ? result.value : null;

      if (musicDirectory) {
        if (!musicDirectory) {
          getDebugLog()?.warn('Music directory not found, using default path', {
            module: 'audio-manager',
            function: 'playSongWithFilename',
          });
          // Use default path as fallback - get through secure API
          const defaultPath = '.config/mxvoice/mp3';
          securePath
            .join(defaultPath, filename)
            .then((result) => {
              if (!result.success || !result.data) {
                getDebugLog()?.warn('Path join failed with default path', {
                  module: 'audio-manager',
                  function: 'playSongWithFilename',
                  result: result,
                });
                return;
              }
              const joinedPath = result.data;
              const sound_path = [joinedPath];
              // Ensure E2E test mode/probe is initialized right before first playback
              if (window.electronTest?.isE2E && window.moduleRegistry?.audio?.ensureTestMode) {
                window.moduleRegistry.audio.ensureTestMode();
              }
              
          // Resume suspended Web Audio context on Windows
          // This fixes the 1-2 second lag issue on Windows
          if (window.Howler?.ctx?.state === 'suspended') {
            getDebugLog()?.info('Resuming suspended Web Audio context', {
              module: 'audio-manager',
              function: 'playSongWithFilename'
            });
            window.Howler.ctx.resume().then(() => {
              getDebugLog()?.info('Web Audio context resumed successfully', {
                module: 'audio-manager',
                function: 'playSongWithFilename'
              });
            }).catch(error => {
              getDebugLog()?.warn('Failed to resume audio context:', {
                module: 'audio-manager',
                function: 'playSongWithFilename',
                error: error.message
              });
            });
          }
              
              const sound = createHowl({
                src: sound_path,
                volume:
                  (Number(document.getElementById('volume')?.value) || 0) / 100,
                mute:
                  document
                    .getElementById('mute_button')
                    ?.classList.contains('active') || false,
                onload: function () {
                  getDebugLog()?.info('Sound fully loaded', {
                    module: 'audio-manager',
                    function: 'playSongWithFilename',
                    duration: sound.duration(),
                    state: sound.state()
                  });
                },
                onloaderror: function (id, error) {
                  getDebugLog()?.error('Sound load error', {
                    module: 'audio-manager',
                    function: 'playSongWithFilename',
                    soundId: id,
                    error: error,
                    src: sound_path
                  });
                },
                onplayerror: function (id, error) {
                  getDebugLog()?.error('Sound play error', {
                    module: 'audio-manager',
                    function: 'playSongWithFilename',
                    soundId: id,
                    error: error,
                    src: sound_path
                  });
                },
                onplay: function () {
                  getDebugLog()?.info('Sound playback started', {
                    module: 'audio-manager',
                    function: 'playSongWithFilename'
                  });
                  const time = Math.round(sound.duration());
                  sharedState.set(
                    'globalAnimation',
                    requestAnimationFrame(
                      howlerUtils.updateTimeTracker.bind(this)
                    )
                  );
                  const title = row.title || '';
                  let artist = row.artist || '';
                  artist = artist.length ? 'by ' + artist : artist;
                  let wavesurfer = sharedState.get('wavesurfer');
                  if (!wavesurfer && sharedState.get('createWaveSurfer')) {
                    wavesurfer = sharedState.get('createWaveSurfer')();
                  }
                  if (wavesurfer) {
                    wavesurfer.load(sound_path);
                  }
                  const now = document.getElementById('song_now_playing');
                  if (now) {
                    now.innerHTML = `<i id="song_spinner" class="fas fa-volume-up"></i> ${title} ${artist}`;
                    now.style.display = '';
                    now.setAttribute('songid', String(song_id));
                  }
                  document
                    .getElementById('play_button')
                    ?.classList.add('d-none');
                  document
                    .getElementById('pause_button')
                    ?.classList.remove('d-none');
                  document
                    .getElementById('stop_button')
                    ?.removeAttribute('disabled');

                  // E2E: ensure probe is attached once WebAudio is active
                  if (window.electronTest?.isE2E && !window.electronTest?.audioProbe) {
                    createAndInstallProbe();
                  }
                },
                onend: function () {
                  getDebugLog()?.info('Sound playback ended', {
                    module: 'audio-manager',
                    function: 'playSongWithFilename',
                  });
                  song_ended();
                  const loop = sharedState.get('loop');
                  const autoplay = sharedState.get('autoplay');
                  const holdingTankMode = sharedState.get('holdingTankMode');
                  if (loop) {
                    // If loop mode is enabled, restart the current song
                    playSongFromId(song_id);
                  } else if (autoplay && holdingTankMode === 'playlist') {
                    autoplay_next();
                  }
                },
              });
              
              sharedState.set('sound', sound);
              
              getDebugLog()?.info('About to call play()', {
                module: 'audio-manager',
                function: 'playSongWithFilename',
                soundState: sound.state(),
                src: sound_path
              });
              
              // Start playback immediately (progressive loading mode)
              // With preload: false, this starts as soon as buffer is ready
              const playResult = sound.play();
              
              getDebugLog()?.info('Called play(), result:', {
                module: 'audio-manager',
                function: 'playSongWithFilename',
                playResult: playResult,
                soundState: sound.state(),
                playing: sound.playing()
              });
              
              // Resume suspended audio context in E2E mode
              if (window.electronTest?.isE2E && window.Howler?.usingWebAudio && window.Howler?.ctx?.state === 'suspended') {
                window.Howler.ctx.resume().catch(() => {});
              }
              // Ensure probe exists in E2E once WebAudio context is available
              try {
                if (window.electronTest?.isE2E && !window.electronTest?.audioProbe && window.Howler?.usingWebAudio && window.Howler?.ctx) {
                  const ctx = window.Howler.ctx;
                  const analyser = new AnalyserNode(ctx, { fftSize: 2048 });
                  analyser.smoothingTimeConstant = 0.2;
                  if (window.Howler?.masterGain) {
                    window.Howler.masterGain.connect(analyser);
                  } else {
                    analyser.connect(ctx.destination);
                  }
                  const probe = {
                    currentRMS() {
                      const buf = new Float32Array(analyser.fftSize);
                      analyser.getFloatTimeDomainData(buf);
                      let sum = 0; for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
                      return Math.sqrt(sum / buf.length);
                    },
                    isSilent(threshold = 1e-3) { return this.currentRMS() < threshold; }
                  };
                  if (window.electronTest?.setAudioProbe) {
                    window.electronTest.setAudioProbe(probe);
                  }
                }
              } catch (_) {}
            })
            .catch((error) => {
              getDebugLog()?.warn('Path join error with default path', {
                module: 'audio-manager',
                function: 'playSongWithFilename',
                error: error.message,
                defaultPath: defaultPath,
                filename: filename,
              });
            });
          return;
        }

        securePath
          .join(musicDirectory, filename)
          .then((result) => {
            if (!result.success || !result.data) {
              getDebugLog()?.warn('Path join failed', {
                module: 'audio-manager',
                function: 'playSongWithFilename',
                result: result,
              });
              return;
            }
            
            const joinedPath = result.data;
            const sound_path = [joinedPath];
            
            // Ensure E2E test mode/probe is initialized right before first playback
            if (window.electronTest?.isE2E && window.moduleRegistry?.audio?.ensureTestMode) {
              window.moduleRegistry.audio.ensureTestMode();
            }
            
            const sound = createHowl({
              src: sound_path,
              volume:
                (Number(document.getElementById('volume')?.value) || 0) / 100,
              mute:
                document
                  .getElementById('mute_button')
                  ?.classList.contains('active') || false,
              onload: function () {
                getDebugLog()?.info('Sound fully loaded', {
                  module: 'audio-manager',
                  function: 'playSongWithFilename',
                  duration: sound.duration(),
                  state: sound.state()
                });
              },
              onloaderror: function (id, error) {
                getDebugLog()?.error('Sound load error', {
                  module: 'audio-manager',
                  function: 'playSongWithFilename',
                  soundId: id,
                  error: error,
                  src: sound_path
                });
              },
              onplayerror: function (id, error) {
                getDebugLog()?.error('Sound play error', {
                  module: 'audio-manager',
                  function: 'playSongWithFilename',
                  soundId: id,
                  error: error,
                  src: sound_path
                });
              },
              onplay: function () {
                getDebugLog()?.info('Sound playback started', {
                  module: 'audio-manager',
                  function: 'playSongWithFilename',
                });
                const time = Math.round(sound.duration());
                sharedState.set(
                  'globalAnimation',
                  requestAnimationFrame(
                    howlerUtils.updateTimeTracker.bind(this)
                  )
                );
                const title = row.title || '';
                let artist = row.artist || '';
                artist = artist.length ? 'by ' + artist : artist;
                let wavesurfer = sharedState.get('wavesurfer');
                if (!wavesurfer && sharedState.get('createWaveSurfer')) {
                  wavesurfer = sharedState.get('createWaveSurfer')();
                }
                if (wavesurfer) {
                  wavesurfer.load(sound_path);
                }
                const now = document.getElementById('song_now_playing');
                if (now) {
                  now.innerHTML = `<i id="song_spinner" class="fas fa-volume-up"></i> ${title} ${artist}`;
                  now.style.display = '';
                  now.setAttribute('songid', String(song_id));
                }
                document.getElementById('play_button')?.classList.add('d-none');
                document
                  .getElementById('pause_button')
                  ?.classList.remove('d-none');
                document
                  .getElementById('stop_button')
                  ?.removeAttribute('disabled');

                // E2E: ensure probe is attached once WebAudio is active
                try {
                  if (window.electronTest?.isE2E && !window.electronTest?.audioProbe && window.Howler?.usingWebAudio && window.Howler?.masterGain && window.Howler?.ctx) {
                    const ctx = window.Howler.ctx;
                    const analyser = new AnalyserNode(ctx, { fftSize: 2048 });
                    analyser.smoothingTimeConstant = 0.2;
                    window.Howler.masterGain.connect(analyser);
                    if (!window.electronTest) window.electronTest = {};
                    window.electronTest.audioProbe = {
                      currentRMS() {
                        const buf = new Float32Array(analyser.fftSize);
                        analyser.getFloatTimeDomainData(buf);
                        let sum = 0; for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
                        return Math.sqrt(sum / buf.length);
                      },
                      isSilent(threshold = 1e-3) { return this.currentRMS() < threshold; }
                    };
                  }
                } catch (_) {}
              },
              onend: function () {
                getDebugLog()?.info('Sound playback ended', {
                  module: 'audio-manager',
                  function: 'playSongWithFilename',
                });
                song_ended();
                const loop = sharedState.get('loop');
                const autoplay = sharedState.get('autoplay');
                const holdingTankMode = sharedState.get('holdingTankMode');
                if (loop) {
                  // If loop mode is enabled, restart the current song
                  playSongFromId(song_id);
                } else if (autoplay && holdingTankMode === 'playlist') {
                  autoplay_next();
                }
              },
            });
            
            sharedState.set('sound', sound);
            
            // Resume audio context if suspended (critical for playback)
            if (window.Howler?.ctx?.state === 'suspended') {
              getDebugLog()?.info('Resuming suspended audio context', {
                module: 'audio-manager',
                function: 'playSongWithFilename'
              });
              window.Howler.ctx.resume().then(() => {
                sound.play();
              }).catch(() => {
                sound.play(); // Try anyway
              });
            } else {
              sound.play();
            }
            
            try {
              if (window.electronTest?.isE2E && window.Howler?.usingWebAudio && window.Howler?.ctx?.state === 'suspended') {
                window.Howler.ctx.resume().catch(() => {});
              }
            } catch (_) {}
            // Ensure probe exists in E2E once WebAudio context is available
            if (window.electronTest?.isE2E && !window.electronTest?.audioProbe) {
              createAndInstallProbe();
            }
            
          })
          .catch((error) => {
            getDebugLog()?.warn('Path join error', {
              module: 'audio-manager',
              function: 'playSongWithFilename',
              error: error.message,
              musicDirectory: musicDirectory,
              filename: filename,
            });
          });
      } else {
        getDebugLog()?.warn('Could not get music directory from store', {
          module: 'audio-manager',
          function: 'playSongWithFilename',
          musicDirectory: musicDirectory,
        });
      }
    })
    .catch((error) => {
      getDebugLog()?.warn('Store get API error', {
        module: 'audio-manager',
        function: 'playSongWithFilename',
        error: error.message,
      });
    });
}

/**
 * Play a song from its database ID
 *
 * @param {string} song_id - The database ID of the song to play
 */
function playSongFromId(song_id) {
  getDebugLog()?.info('Playing song from ID', {
    module: 'audio-manager',
    function: 'playSongFromId',
    song_id: song_id
  });

  if (!song_id) {
    getDebugLog()?.error('No song_id provided', {
      module: 'audio-manager',
      function: 'playSongFromId',
      song_id: song_id,
    });
    return;
  }

  const sound = sharedState.get('sound');
  if (sound) {
    sound.off('fade');
    sound.unload();
  }

  secureDatabase
    .query('SELECT * from mrvoice WHERE id = ?', [song_id])
    .then((result) => {
      if (result.success && result.data.length > 0) {
        const row = result.data[0];
        const filename = row.filename;

        if (!filename) {
          getDebugLog()?.error('No filename found for song ID', {
            module: 'audio-manager',
            function: 'playSongFromId',
            song_id: song_id,
            rowData: row,
          });
          return;
        }

        playSongWithFilename(filename, row, song_id);
      } else {
        getDebugLog()?.error('No song found with ID or query failed', {
          module: 'audio-manager',
          function: 'playSongFromId',
          song_id: song_id,
          result_success: result?.success,
          result_data_length: result?.data?.length || 0,
          result_error: result?.error || null,
        });
      }
    })
    .catch((error) => {
      getDebugLog()?.error('Database query error', {
        module: 'audio-manager',
        function: 'playSongFromId',
        song_id: song_id,
        error: error.message,
        error_stack:
          error.stack?.split('\n').slice(0, 3).join('\n') || 'No stack trace',
      });
    });

  return; // Exit early since we're handling the rest in playSongWithFilename
}

/**
 * Play the currently selected song
 */
function playSelected() {
  getDebugLog()?.info('Play selected called', {
    module: 'audio-manager',
    function: 'playSelected'
  });

  const song_id = document
    .getElementById('selected_row')
    ?.getAttribute('songid');

  // Only clear the now_playing class if the selected row is from the search panel
  // (not from the holding tank/playlist)
  {
    const col = document.getElementById('holding-tank-column');
    const sel = document.getElementById('selected_row');
    if (!(col && sel && col.contains(sel))) {
      document
        .querySelectorAll('.now_playing')
        .forEach((el) => el.classList.remove('now_playing'));
    }
  }

  const holdingTankMode = sharedState.get('holdingTankMode');
  if (holdingTankMode === 'storage') {
    // In storage mode, cancel autoplay and play just this song
    cancel_autoplay();
  }
  // In playlist mode, autoplay is already set up by the double-click handler

  playSongFromId(song_id);
}

/**
 * Handle song end event
 */
function song_ended() {
  resetUIState();
}

/**
 * Autoplay next song in playlist
 */
function autoplay_next() {
  const autoplay = sharedState.get('autoplay');
  const holdingTankMode = sharedState.get('holdingTankMode');

  getDebugLog()?.info('autoplay_next called', {
    module: 'audio-manager',
    function: 'autoplay_next',
    autoplay: autoplay,
    holdingTankMode: holdingTankMode,
  });

  if (autoplay && holdingTankMode === 'playlist') {
    const now_playing = document.querySelector('.now_playing');
    let next_song = null;

    if (now_playing) {
      getDebugLog()?.info('Found currently playing song, finding next', {
        module: 'audio-manager',
        function: 'autoplay_next',
        currentSongId: now_playing.getAttribute('songid'),
      });

      now_playing.classList.remove('now_playing');
      next_song = now_playing.nextElementSibling;
    }

    if (next_song) {
      getDebugLog()?.info('Playing next song in playlist', {
        module: 'audio-manager',
        function: 'autoplay_next',
        nextSongId: next_song.getAttribute('songid'),
      });

      // Clear any existing highlighting and highlight the new playing track
      document.getElementById('selected_row')?.removeAttribute('id');
      next_song.id = 'selected_row';
      playSongFromId(next_song.getAttribute('songid'));
      next_song.classList.add('now_playing');
    } else {
      getDebugLog()?.info('End of playlist reached', {
        module: 'audio-manager',
        function: 'autoplay_next',
      });

      // End of playlist - just remove the now_playing class and stay in playlist mode
      const np = document.querySelector('li.now_playing');
      if (np) np.classList.remove('now_playing');
      // Clear any highlighting at the end of playlist
      document.getElementById('selected_row')?.removeAttribute('id');
      // Don't switch modes - stay in playlist mode
    }
  } else {
    getDebugLog()?.info('Autoplay conditions not met', {
      module: 'audio-manager',
      function: 'autoplay_next',
      autoplay: autoplay,
      holdingTankMode: holdingTankMode,
    });
  }
}

/**
 * Cancel autoplay functionality
 */
function cancel_autoplay() {
  const col = document.getElementById('holding-tank-column');
  const sel = document.getElementById('selected_row');
  if (!(col && sel && col.contains(sel))) {
    // Only cancel autoplay if we're not in the holding tank
    const holdingTankMode = sharedState.get('holdingTankMode');
    if (holdingTankMode === 'playlist') {
      sharedState.set('autoplay', false);
      // Note: setHoldingTankMode should be available from the mode management module
      if (window.setHoldingTankMode) {
        window.setHoldingTankMode('storage');
      }
    }
  }
}

// Export individual functions for direct access
export {
  playSongFromId,
  playSongWithFilename,
  playSelected,
  song_ended,
  autoplay_next,
  cancel_autoplay,
  initializeMusicDirectoryCache,
  updateMusicDirectoryCache,
};

// Default export for module loading
export default {
  playSongFromId,
  playSongWithFilename,
  playSelected,
  song_ended,
  autoplay_next,
  cancel_autoplay,
  initializeMusicDirectoryCache,
  updateMusicDirectoryCache,
};
