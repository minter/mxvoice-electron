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

/**
 * Play a song with the given filename and row data
 *
 * @param {string} filename - The filename of the song
 * @param {Object} row - The database row data
 * @param {string} song_id - The database ID of the song
 */
function playSongWithFilename(filename, row, song_id) {
  getDebugLog()?.info('🎵 PLAYBACK STEP 6: playSongWithFilename called', {
    module: 'audio-manager',
    function: 'playSongWithFilename',
    filename: filename,
    song_id: song_id,
    row_title: row?.title,
    row_artist: row?.artist,
    timestamp: new Date().toISOString(),
  });

  // Get music directory from store
  getDebugLog()?.info(
    '🔍 PLAYBACK STEP 7: Getting music directory from store',
    {
      module: 'audio-manager',
      function: 'playSongWithFilename',
      filename: filename,
      song_id: song_id,
    }
  );

  secureStore
    .get('music_directory')
    .then((result) => {
      // Extract the actual value from the result object
      const musicDirectory =
        result.success && result.value ? result.value : null;

      getDebugLog()?.info('🔍 PLAYBACK STEP 8: Music directory retrieved', {
        module: 'audio-manager',
        function: 'playSongWithFilename',
        musicDirectory: musicDirectory,
        musicDirectory_type: typeof musicDirectory,
        filename: filename,
        song_id: song_id,
      });
      if (musicDirectory) {
        getDebugLog()?.info('🔍 Debug: musicDirectory:', {
          module: 'audio-manager',
          function: 'playSongWithFilename',
          musicDirectoryValue: musicDirectory,
        });
        if (!musicDirectory) {
          getDebugLog()?.warn(
            '❌ musicDirectory is undefined or empty, using default path',
            {
              module: 'audio-manager',
              function: 'playSongWithFilename',
            }
          );
          // Use default path as fallback - get through secure API
          const defaultPath = '.config/mxvoice/mp3';
          securePath
            .join(defaultPath, filename)
            .then((result) => {
              if (!result.success || !result.data) {
                getDebugLog()?.warn('❌ Path join failed with default path:', {
                  module: 'audio-manager',
                  function: 'playSongWithFilename',
                  result: result,
                });
                return;
              }
              const joinedPath = result.data;
              const sound_path = [joinedPath];
              getDebugLog()?.info('Inside get, Filename is ' + filename, {
                module: 'audio-manager',
                function: 'playSongWithFilename',
                filename: filename,
              });
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
                onplay: function () {
                  getDebugLog()?.info('🔍 Sound onplay event fired', {
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
                  const artist = row.artist || '';
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
                  getDebugLog()?.info('🔍 Sound onend event fired', {
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
              getDebugLog()?.info('🔍 Setting sound in shared state:', {
                module: 'audio-manager',
                function: 'playSongWithFilename',
                soundId: sound._id || 'unknown',
                soundSrc: sound_path,
              });
              sharedState.set('sound', sound);
              getDebugLog()?.info(
                '🔍 Sound set in shared state, now playing...',
                {
                  module: 'audio-manager',
                  function: 'playSongWithFilename',
                }
              );
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
              sound.play();
            })
            .catch((error) => {
              getDebugLog()?.warn('❌ Path join error with default:', {
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
              getDebugLog()?.warn('❌ Path join failed:', {
                module: 'audio-manager',
                function: 'playSongWithFilename',
                result: result,
              });
              return;
            }
            const joinedPath = result.data;
            const sound_path = [joinedPath];
            getDebugLog()?.info('Inside get, Filename is ' + filename, {
              module: 'audio-manager',
              function: 'playSongWithFilename',
              filename: filename,
            });
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
              onplay: function () {
                getDebugLog()?.info('🔍 Sound onplay event fired', {
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
                getDebugLog()?.info('🔍 Sound onend event fired', {
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
            getDebugLog()?.info('🔍 Setting sound in shared state:', {
              module: 'audio-manager',
              function: 'playSongWithFilename',
              soundId: sound._id || 'unknown',
              soundSrc: sound_path,
            });
            sharedState.set('sound', sound);
            getDebugLog()?.info(
              '🔍 Sound set in shared state, now playing...',
              {
                module: 'audio-manager',
                function: 'playSongWithFilename',
              }
            );
            try {
              if (window.electronTest?.isE2E && window.Howler?.usingWebAudio && window.Howler?.ctx?.state === 'suspended') {
                window.Howler.ctx.resume().catch(() => {});
              }
            } catch (_) {}
            // Ensure probe exists in E2E once WebAudio context is available
            if (window.electronTest?.isE2E && !window.electronTest?.audioProbe) {
              createAndInstallProbe();
            }
            sound.play();
          })
          .catch((error) => {
            getDebugLog()?.warn('❌ Path join error:', {
              module: 'audio-manager',
              function: 'playSongWithFilename',
              error: error.message,
              musicDirectory: musicDirectory,
              filename: filename,
            });
          });
      } else {
        getDebugLog()?.warn('❌ Could not get music directory from store', {
          module: 'audio-manager',
          function: 'playSongWithFilename',
          musicDirectory: musicDirectory,
        });
      }
    })
    .catch((error) => {
      getDebugLog()?.warn('❌ Store get API error:', {
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
  getDebugLog()?.info(
    '🎵 PLAYBACK START: Playing song from song ID ' + song_id,
    {
      module: 'audio-manager',
      function: 'playSongFromId',
      song_id: song_id,
      song_id_type: typeof song_id,
      timestamp: new Date().toISOString(),
    }
  );

  if (!song_id) {
    getDebugLog()?.error('❌ PLAYBACK FAIL: No song_id provided', {
      module: 'audio-manager',
      function: 'playSongFromId',
      song_id: song_id,
    });
    return;
  }

  getDebugLog()?.info(
    '🔍 PLAYBACK STEP 1: Stopping current sound and querying database',
    {
      module: 'audio-manager',
      function: 'playSongFromId',
      song_id: song_id,
    }
  );

  const sound = sharedState.get('sound');
  if (sound) {
    sound.off('fade');
    sound.unload();
  }

  // Use secure database adapter to get song data
  getDebugLog()?.info('🔍 PLAYBACK STEP 2: Executing database query', {
    module: 'audio-manager',
    function: 'playSongFromId',
    song_id: song_id,
    query: 'SELECT * from mrvoice WHERE id = ?',
    params: [song_id],
  });

  secureDatabase
    .query('SELECT * from mrvoice WHERE id = ?', [song_id])
    .then((result) => {
      getDebugLog()?.info('🔍 PLAYBACK STEP 3: Database query completed', {
        module: 'audio-manager',
        function: 'playSongFromId',
        song_id: song_id,
        result_success: result?.success,
        result_data_length: result?.data?.length,
        result_error: result?.error || null,
      });
      if (result.success && result.data.length > 0) {
        const row = result.data[0];
        const filename = row.filename;

        getDebugLog()?.info('🔍 PLAYBACK STEP 4: Song data retrieved', {
          module: 'audio-manager',
          function: 'playSongFromId',
          song_id: song_id,
          filename: filename,
          row_title: row.title,
          row_artist: row.artist,
          row_id: row.id,
        });

        if (!filename) {
          getDebugLog()?.error(
            '❌ PLAYBACK FAIL: No filename found for song ID:',
            {
              module: 'audio-manager',
              function: 'playSongFromId',
              song_id: song_id,
              rowData: row,
            }
          );
          return;
        }

        getDebugLog()?.info(
          '🎵 PLAYBACK STEP 5: Calling playSongWithFilename',
          {
            module: 'audio-manager',
            function: 'playSongFromId',
            song_id: song_id,
            filename: filename,
          }
        );

        // Continue with the rest of the function...
        playSongWithFilename(filename, row, song_id);
      } else {
        getDebugLog()?.error(
          '❌ PLAYBACK FAIL: No song found with ID or query failed:',
          {
            module: 'audio-manager',
            function: 'playSongFromId',
            song_id: song_id,
            result_success: result?.success,
            result_data_length: result?.data?.length || 0,
            result_error: result?.error || null,
          }
        );
      }
    })
    .catch((error) => {
      getDebugLog()?.error('❌ PLAYBACK FAIL: Database query error:', {
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
  getDebugLog()?.info('🎵 PLAYBACK TRIGGER: playSelected called', {
    module: 'audio-manager',
    function: 'playSelected',
    timestamp: new Date().toISOString(),
    selected_row_exists: Boolean(document.getElementById('selected_row')),
  });

  const song_id = document
    .getElementById('selected_row')
    ?.getAttribute('songid');
  getDebugLog()?.info('🔍 PLAYBACK STEP: Got song ID from selected row', {
    module: 'audio-manager',
    function: 'playSelected',
    song_id: song_id,
    song_id_type: typeof song_id,
    selected_row_exists: Boolean(document.getElementById('selected_row')),
  });

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

  getDebugLog()?.info(
    '🎵 PLAYBACK STEP: Calling playSongFromId from playSelected',
    {
      module: 'audio-manager',
      function: 'playSelected',
      song_id: song_id,
    }
  );

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
};

// Default export for module loading
export default {
  playSongFromId,
  playSongWithFilename,
  playSelected,
  song_ended,
  autoplay_next,
  cancel_autoplay,
};
