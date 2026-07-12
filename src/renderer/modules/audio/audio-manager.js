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
import { getPlaybackSelectionSongId, resetUIState } from './audio-controller.js';
import { getPreference } from '../preferences/profile-preference-adapter.js';
import { resolveAudioSource } from './audio-source-resolver.js';
import { showMissingAudioFile } from './playback-error-presenter.js';
import { prepareCrossfadeTransition } from './crossfade-transition.js';
import { presentPlaybackStarted } from './playback-ui-presenter.js';
import { createPlaybackSound } from './playback-sound-factory.js';
import { handlePlaybackStarted } from './playback-start.js';
import { completeActivePlayback, handlePlaybackCompleted } from './playback-completion.js';
import { parseCrossfadePreference, prepareForPlaybackReplacement } from './playback-replacement.js';
import { loadSongForPlayback } from './playback-song-loader.js';
import {
  calculatePlaybackVolume,
  getCrossfadePolicy,
  getTrackBounds
} from './playback-policy.js';

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
  } catch (_error) {
    // Silent fail in E2E mode
  }
  return null;
}

// Import secure adapters
import {
  secureStore,
  secureDatabase,
  securePath,
  secureFileSystem,
} from '../adapters/secure-adapter.js';

// Cache for music directory to avoid repeated IPC calls
let cachedMusicDirectory = null;

/**
 * Ensure audio context is resumed and attempt playback with validation
 * @param {Object} sound - Howl sound instance
 * @param {string} song_id - Song ID for logging
 * @returns {number|undefined} Sound ID if playback started, undefined otherwise
 */
async function ensureAudioContextAndPlay(sound, song_id) {
  try {
    // Check if Web Audio context exists and is suspended
    if (window.Howler?.ctx && window.Howler.ctx.state === 'suspended') {
      getDebugLog()?.info('Audio context is suspended, resuming...', {
        module: 'audio-manager',
        function: 'ensureAudioContextAndPlay',
        song_id: song_id
      });
      
      try {
        await window.Howler.ctx.resume();
        getDebugLog()?.info('Audio context resumed successfully', {
          module: 'audio-manager',
          function: 'ensureAudioContextAndPlay',
          song_id: song_id
        });
      } catch (error) {
        getDebugLog()?.warn('Failed to resume audio context, attempting playback anyway', {
          module: 'audio-manager',
          function: 'ensureAudioContextAndPlay',
          song_id: song_id,
          error: error.message
        });
      }
    }
    
    // Attempt playback
    const playResult = sound.play();
    
    // Validate playback started
    if (playResult === undefined) {
      getDebugLog()?.warn('sound.play() returned undefined, playback may have failed', {
        module: 'audio-manager',
        function: 'ensureAudioContextAndPlay',
        song_id: song_id,
        soundState: sound.state()
      });
      
      // Wait a moment and check if sound is actually playing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (!sound.playing()) {
        getDebugLog()?.error('Playback failed - sound is not playing after play() call', {
          module: 'audio-manager',
          function: 'ensureAudioContextAndPlay',
          song_id: song_id,
          soundState: sound.state(),
          playResult: playResult
        });
        return undefined;
      }
    }
    
    // Verify playback is actually happening
    if (playResult !== undefined) {
      // Double-check that the sound is actually playing
      setTimeout(() => {
        if (!sound.playing()) {
          getDebugLog()?.warn('Playback may have stopped immediately after starting', {
            module: 'audio-manager',
            function: 'ensureAudioContextAndPlay',
            song_id: song_id,
            playResult: playResult,
            soundState: sound.state()
          });
        }
      }, 200);
    }
    
    getDebugLog()?.info('Playback started successfully', {
      module: 'audio-manager',
      function: 'ensureAudioContextAndPlay',
      song_id: song_id,
      playResult: playResult,
      soundState: sound.state(),
      playing: sound.playing()
    });
    
    return playResult;
  } catch (error) {
    getDebugLog()?.error('Error in ensureAudioContextAndPlay', {
      module: 'audio-manager',
      function: 'ensureAudioContextAndPlay',
      song_id: song_id,
      error: error.message
    });
    return undefined;
  }
}

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
function playSongWithFilename(filename, row, song_id, options = {}) {
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

        resolveAudioSource({
          musicDirectory,
          filename,
          pathAPI: securePath,
          fileSystemAPI: secureFileSystem
        }).then(async (sourceResult) => {
            if (!sourceResult.success && sourceResult.reason === 'path') {
              getDebugLog()?.warn('Audio source resolution failed', {
                module: 'audio-manager',
                function: 'playSongWithFilename',
                error: sourceResult.error,
              });
              return;
            }
            if (!sourceResult.success) {
              getDebugLog()?.error('Audio file not found', {
                module: 'audio-manager',
                function: 'playSongWithFilename',
                song_id: song_id,
                filename: filename,
                filePath: sourceResult.filePath,
                title: row?.title,
                error: sourceResult.error
              });
              showMissingAudioFile({ title: row?.title, filename });
              return;
            }
            const sound_path = sourceResult.source;
            
            // Ensure E2E test mode/probe is initialized right before first playback
            if (window.electronTest?.isE2E) {
              createAndInstallProbe();
            }

            const { trackVolume: trackVolume2, targetVolume: targetVolume2 } = calculatePlaybackVolume(
              document.getElementById('volume')?.value,
              row?.volume ?? 100
            );
            sharedState.set('trackVolume', trackVolume2);
            const crossfade = getCrossfadePolicy(options);
            const shouldCrossfade2 = crossfade.enabled;
            const crossfadeMs2 = crossfade.durationMs;

            // Handle outgoing sound for crossfade
            if (shouldCrossfade2) {
              prepareCrossfadeTransition({
                sharedState,
                durationMs: crossfadeMs2,
                cancelAnimationFrame
              });
            }

            let sound = createPlaybackSound({
              createHowl,
              source: sound_path,
              volume: shouldCrossfade2 ? 0 : targetVolume2,
              muted:
                document
                  .getElementById('mute_button')
                  ?.classList.contains('active') || false,
              debugLog: getDebugLog(),
              onPlay: function () {
                handlePlaybackStarted({
                  sound,
                  howlerContext: this,
                  crossfade: shouldCrossfade2,
                  targetVolume: targetVolume2,
                  durationMs: crossfadeMs2,
                  sharedState,
                  requestAnimationFrame,
                  updateTimeTracker: howlerUtils.updateTimeTracker,
                  presentPlayback: presentPlaybackStarted,
                  presentation: { songId: song_id, row, source: sound_path, sharedState },
                  ensureAudioProbe: window.electronTest?.isE2E && !window.electronTest?.audioProbe
                    ? createAndInstallProbe
                    : null
                });
              },
              onEnd: function () {
                handlePlaybackCompleted({
                  sound, songId: song_id, sharedState,
                  onSongEnded: song_ended,
                  replaySong: playSongFromId,
                  autoplayNext: autoplay_next
                });
              },
            });
            
            sharedState.set('sound', sound);
            const trackBounds = getTrackBounds(row);
            sharedState.set('trackStartTime', trackBounds.startTime);
            sharedState.set('trackEndTime', trackBounds.endTime);
            sharedState.set('crossfadeTriggered', false);

            // Start playback with audio context resume and validation
            ensureAudioContextAndPlay(sound, song_id).then(playResult => {
              if (playResult === undefined) {
                getDebugLog()?.error('Playback failed to start', {
                  module: 'audio-manager',
                  function: 'playSongWithFilename',
                  song_id: song_id,
                  soundState: sound.state()
                });
              } else if (row?.start_time != null && row.start_time > 0) {
                sound.seek(row.start_time);
              }
            }).catch(error => {
              getDebugLog()?.error('Error during playback start', {
                module: 'audio-manager',
                function: 'playSongWithFilename',
                song_id: song_id,
                error: error.message
              });
            });

            try {
              if (window.electronTest?.isE2E && window.Howler?.usingWebAudio && window.Howler?.ctx?.state === 'suspended') {
                window.Howler.ctx.resume().catch(() => {}); // Intentional: resume may reject if context is already closed
              }
            } catch (_) { /* best-effort AudioContext resume in E2E */ }
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
 * @param {Object} options - Playback options
 * @param {boolean} options.crossfade - Whether to crossfade from current track
 * @param {number} options.crossfadeSeconds - Crossfade duration in seconds
 */
async function playSongFromId(song_id, options = {}) {
  getDebugLog()?.info('Playing song from ID', {
    module: 'audio-manager',
    function: 'playSongFromId',
    song_id: song_id,
    crossfade: options.crossfade || false
  });

  if (!song_id) {
    getDebugLog()?.error('No song_id provided', {
      module: 'audio-manager',
      function: 'playSongFromId',
      song_id: song_id,
    });
    return;
  }

  // Cache crossfade preference for the time tracker to use synchronously
  if (!options.crossfade) {
    try {
      const cfResult = await getPreference('crossfade_seconds', window.secureElectronAPI);
      sharedState.set('crossfadeSeconds', parseCrossfadePreference(cfResult));
    } catch (_e) {
      sharedState.set('crossfadeSeconds', 0);
    }
  }

  prepareForPlaybackReplacement({ sharedState, crossfade: options.crossfade });

  const song = await loadSongForPlayback(song_id, secureDatabase);
  if (!song.success) {
    getDebugLog()?.error('Could not load song for playback', {
      module: 'audio-manager', function: 'playSongFromId', song_id, error: song.error
    });
    return;
  }
  playSongWithFilename(song.filename, song.row, song_id, options);
}

/**
 * Play the currently selected song
 */
function playSelected() {
  getDebugLog()?.info('Play selected called', {
    module: 'audio-manager',
    function: 'playSelected'
  });

  const song_id = getPlaybackSelectionSongId();

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
 * Handle song end triggered by reaching the end trim point.
 * sound.stop() doesn't fire onend, so this replicates the onend logic.
 */
function songEndedFromTrimPoint() {
  getDebugLog()?.info('Song ended from trim point', {
    module: 'audio-manager',
    function: 'songEndedFromTrimPoint'
  });
  const nowPlayingEl = document.getElementById('song_now_playing');
  const currentSongId = nowPlayingEl?.getAttribute('songid');
  completeActivePlayback({
    songId: currentSongId,
    sharedState,
    onSongEnded: song_ended,
    replaySong: playSongFromId,
    autoplayNext: autoplay_next
  });
}

// Register on window so audio-utils.js can call it
window.songEndedFromTrimPoint = songEndedFromTrimPoint;

/**
 * Trigger early crossfade when remaining time drops below crossfade duration.
 * Called from updateTimeTracker in playlist mode.
 * @param {number} remaining - Seconds remaining in current track
 */
function triggerEarlyCrossfade(remaining) {
  try {
    const crossfadeSeconds = sharedState.get('crossfadeSeconds') || 0;
    if (crossfadeSeconds <= 0 || remaining > crossfadeSeconds) return;

    // Mark as triggered so we don't fire again for this track
    sharedState.set('crossfadeTriggered', true);

    getDebugLog()?.info('Early crossfade triggered', {
      module: 'audio-manager',
      function: 'triggerEarlyCrossfade',
      remaining,
      crossfadeSeconds
    });

    // Find the next song in the holding tank playlist
    const now_playing = document.querySelector('.now_playing');
    if (!now_playing) return;
    const next_song = now_playing.nextElementSibling;
    if (!next_song) return;

    const nextSongId = next_song.getAttribute('songid');
    if (!nextSongId) return;

    // Update UI: move highlighting to the next song
    now_playing.classList.remove('now_playing');
    document.getElementById('selected_row')?.removeAttribute('id');
    next_song.id = 'selected_row';
    next_song.classList.add('now_playing');

    // Play next song with crossfade
    playSongFromId(nextSongId, { crossfade: true, crossfadeSeconds });
  } catch (_e) {
    getDebugLog()?.warn('Error in triggerEarlyCrossfade', {
      module: 'audio-manager',
      function: 'triggerEarlyCrossfade',
      error: _e?.message
    });
  }
}

window.triggerEarlyCrossfade = triggerEarlyCrossfade;

/**
 * Autoplay next song in playlist
 */
async function autoplay_next() {
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
      // Read crossfade preference for playlist transitions (cached in sharedState)
      let crossfadeOpts = {};
      const crossfadeSeconds = sharedState.get('crossfadeSeconds') || 0;
      if (crossfadeSeconds > 0) {
        crossfadeOpts = { crossfade: true, crossfadeSeconds };
      }
      // Mark the new track as now_playing before kicking off async playback so
      // updateTimeTracker / triggerEarlyCrossfade can't read a stale .now_playing
      // and target the wrong sibling while the new sound is still loading.
      next_song.classList.add('now_playing');
      window.secureElectronAPI?.analytics?.trackEvent?.('song_played', { trigger_method: 'playlist_autoplay' });
      playSongFromId(next_song.getAttribute('songid'), crossfadeOpts);
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
