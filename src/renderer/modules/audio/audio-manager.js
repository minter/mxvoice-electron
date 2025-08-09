/**
 * Audio Manager Module
 * 
 * This module handles the main audio playback functionality
 * in the MxVoice Electron application.
 */

// Import shared state
import sharedState from '../shared-state.js';
import { howlerUtils } from './audio-utils.js';

// Import debug logger
let debugLog = null;
try {
  // Try to get debug logger from global scope
  if (window.debugLog) {
    debugLog = window.debugLog;
  }
} catch (error) {
  // Debug logger not available
}

/**
 * Play a song with the given filename and row data
 * 
 * @param {string} filename - The filename of the song
 * @param {Object} row - The database row data
 * @param {string} song_id - The database ID of the song
 */
function playSongWithFilename(filename, row, song_id) {
  debugLog?.info('🔍 playSongWithFilename called with:', { 
    module: 'audio-manager',
    function: 'playSongWithFilename',
    filename: filename,
    song_id: song_id
  });
  
  // Get music directory from store
  window.electronAPI.store.get("music_directory").then(musicDirectory => {
    debugLog?.info('🔍 Debug: musicDirectory response:', { 
      module: 'audio-manager',
      function: 'playSongWithFilename',
      musicDirectory: musicDirectory
    });
    if (musicDirectory.success) {
      debugLog?.info('🔍 Debug: musicDirectory.value:', { 
        module: 'audio-manager',
        function: 'playSongWithFilename',
        musicDirectoryValue: musicDirectory.value
      });
      if (!musicDirectory.value) {
        debugLog?.warn('❌ musicDirectory.value is undefined or empty, using default path', { 
          module: 'audio-manager',
          function: 'playSongWithFilename'
        });
        // Use default path as fallback
        const defaultPath = path.join(process.env.APPDATA || process.env.HOME || '', '.config', 'mxvoice', 'mp3');
        window.electronAPI.path.join(defaultPath, filename).then(result => {
          if (result.success) {
            const sound_path = [result.data];
            debugLog?.info("Inside get, Filename is " + filename, { 
              module: 'audio-manager',
              function: 'playSongWithFilename',
              filename: filename
            });
            const sound = new Howl({
              src: sound_path,
              html5: true,
              volume: $("#volume").val() / 100,
              mute: $("#mute_button").hasClass("active"),
              onplay: function () {
                debugLog?.info('🔍 Sound onplay event fired', { 
                  module: 'audio-manager',
                  function: 'playSongWithFilename'
                });
                const time = Math.round(sound.duration());
                sharedState.set('globalAnimation', requestAnimationFrame(
                  howlerUtils.updateTimeTracker.bind(this)
                ));
                const title = row.title || "";
                const artist = row.artist || "";
                artist = artist.length ? "by " + artist : artist;
                              let wavesurfer = sharedState.get('wavesurfer');
              if (!wavesurfer && sharedState.get('createWaveSurfer')) {
                wavesurfer = sharedState.get('createWaveSurfer')();
              }
              if (wavesurfer) {
                wavesurfer.load(sound_path);
              }
                $("#song_now_playing")
                  .html(
                    `<i id="song_spinner" class="fas fa-volume-up"></i> ${title} ${artist}`
                  )
                  .fadeIn(100)
                  .attr("songid", song_id);
                $("#play_button").addClass("d-none");
                $("#pause_button").removeClass("d-none");
                $("#stop_button").removeAttr("disabled");
              },
              onend: function () {
                debugLog?.info('🔍 Sound onend event fired', { 
                  module: 'audio-manager',
                  function: 'playSongWithFilename'
                });
                song_ended();
                const loop = sharedState.get('loop');
                const autoplay = sharedState.get('autoplay');
                const holdingTankMode = sharedState.get('holdingTankMode');
                if (loop) {
                  // If loop mode is enabled, restart the current song
                  playSongFromId(song_id);
                } else if (autoplay && holdingTankMode === "playlist") {
                  autoplay_next();
                }
              },
            });
            debugLog?.info('🔍 Setting sound in shared state:', { 
              module: 'audio-manager',
              function: 'playSongWithFilename',
              sound: sound
            });
            sharedState.set('sound', sound);
            debugLog?.info('🔍 Sound set in shared state, now playing...', { 
              module: 'audio-manager',
              function: 'playSongWithFilename'
            });
            sound.play();
          } else {
            debugLog?.warn('❌ Failed to join path with default:', { 
              module: 'audio-manager',
              function: 'playSongWithFilename',
              error: result.error
            });
          }
        }).catch(error => {
          debugLog?.warn('❌ Path join error with default:', { 
            module: 'audio-manager',
            function: 'playSongWithFilename',
            error: error.message
          });
        });
        return;
      }
      
      window.electronAPI.path.join(musicDirectory.value, filename).then(result => {
        if (result.success) {
          if (!result.data) {
            debugLog?.warn('❌ result.data is undefined or empty', { 
              module: 'audio-manager',
              function: 'playSongWithFilename'
            });
            return;
          }
          const sound_path = [result.data];
          debugLog?.info("Inside get, Filename is " + filename, { 
            module: 'audio-manager',
            function: 'playSongWithFilename',
            filename: filename
          });
          const sound = new Howl({
            src: sound_path,
            html5: true,
            volume: $("#volume").val() / 100,
            mute: $("#mute_button").hasClass("active"),
            onplay: function () {
              debugLog?.info('🔍 Sound onplay event fired', { 
                module: 'audio-manager',
                function: 'playSongWithFilename'
              });
              const time = Math.round(sound.duration());
              sharedState.set('globalAnimation', requestAnimationFrame(
                howlerUtils.updateTimeTracker.bind(this)
              ));
              const title = row.title || "";
              let artist = row.artist || "";
              artist = artist.length ? "by " + artist : artist;
              let wavesurfer = sharedState.get('wavesurfer');
              if (!wavesurfer && sharedState.get('createWaveSurfer')) {
                wavesurfer = sharedState.get('createWaveSurfer')();
              }
              if (wavesurfer) {
                wavesurfer.load(sound_path);
              }
              $("#song_now_playing")
                .html(
                  `<i id="song_spinner" class="fas fa-volume-up"></i> ${title} ${artist}`
                )
                .fadeIn(100)
                .attr("songid", song_id);
              $("#play_button").addClass("d-none");
              $("#pause_button").removeClass("d-none");
              $("#stop_button").removeAttr("disabled");
            },
            onend: function () {
              debugLog?.info('🔍 Sound onend event fired', { 
                module: 'audio-manager',
                function: 'playSongWithFilename'
              });
              song_ended();
              const loop = sharedState.get('loop');
              const autoplay = sharedState.get('autoplay');
              const holdingTankMode = sharedState.get('holdingTankMode');
              if (loop) {
                // If loop mode is enabled, restart the current song
                playSongFromId(song_id);
              } else if (autoplay && holdingTankMode === "playlist") {
                autoplay_next();
              }
            },
          });
          debugLog?.info('🔍 Setting sound in shared state:', { 
            module: 'audio-manager',
            function: 'playSongWithFilename',
            sound: sound
          });
          sharedState.set('sound', sound);
          debugLog?.info('🔍 Sound set in shared state, now playing...', { 
            module: 'audio-manager',
            function: 'playSongWithFilename'
          });
          sound.play();
        } else {
          debugLog?.warn('❌ Failed to join path:', { 
            module: 'audio-manager',
            function: 'playSongWithFilename',
            error: result.error
          });
        }
      }).catch(error => {
        debugLog?.warn('❌ Path join error:', { 
          module: 'audio-manager',
          function: 'playSongWithFilename',
          error: error.message
        });
      });
    } else {
      debugLog?.warn('❌ Could not get music directory from store', { 
        module: 'audio-manager',
        function: 'playSongWithFilename'
      });
    }
  }).catch(error => {
    debugLog?.warn('❌ Store get API error:', { 
      module: 'audio-manager',
      function: 'playSongWithFilename',
      error: error.message
    });
  });
}

/**
 * Play a song from its database ID
 * 
 * @param {string} song_id - The database ID of the song to play
 */
function playSongFromId(song_id) {
  debugLog?.info("Playing song from song ID " + song_id, { 
    module: 'audio-manager',
    function: 'playSongFromId',
    song_id: song_id
  });
  if (song_id) {
    const sound = sharedState.get('sound');
    if (sound) {
      sound.off("fade");
      sound.unload();
    }
    
    // Use new database API to get song data
    if (window.electronAPI && window.electronAPI.database) {
      window.electronAPI.database.query("SELECT * from mrvoice WHERE id = ?", [song_id]).then(result => {
        if (result.success && result.data.length > 0) {
          const row = result.data[0];
          const filename = row.filename;
          
          if (!filename) {
            debugLog?.error('❌ No filename found for song ID:', { 
              module: 'audio-manager',
              function: 'playSongFromId',
              song_id: song_id,
              rowData: row
            });
            return;
          }
          
          // Continue with the rest of the function...
          playSongWithFilename(filename, row, song_id);
        } else {
          debugLog?.error('❌ No song found with ID:', { 
            module: 'audio-manager',
            function: 'playSongFromId',
            song_id: song_id
          });
        }
      }).catch(error => {
        debugLog?.error('❌ Database query error:', { 
          module: 'audio-manager',
          function: 'playSongFromId',
          error: error.message
        });
        // Fallback to legacy database access
        const db = sharedState.get('db');
        if (db) {
          try {
            const stmt = db.prepare("SELECT * from mrvoice WHERE id = ?");
            const row = stmt.get(song_id);
            
            if (!row) {
              debugLog?.error('❌ No song found with ID:', { 
                module: 'audio-manager',
                function: 'playSongFromId',
                song_id: song_id
              });
              return;
            }
            
            const filename = row.filename;
            
            if (!filename) {
              debugLog?.error('❌ No filename found for song ID:', { 
                module: 'audio-manager',
                function: 'playSongFromId',
                song_id: song_id,
                rowData: row
              });
              return;
            }
            
            playSongWithFilename(filename, row, song_id);
          } catch (dbError) {
            debugLog?.error('❌ Legacy database error:', { 
              module: 'audio-manager',
              function: 'playSongFromId',
              error: dbError.message
            });
          }
        } else {
          debugLog?.error('❌ No database access available', { 
            module: 'audio-manager',
            function: 'playSongFromId'
          });
        }
      });
    } else {
      // Fallback to legacy database access
      const db = sharedState.get('db');
      if (db) {
        try {
          const stmt = db.prepare("SELECT * from mrvoice WHERE id = ?");
          const row = stmt.get(song_id);
          
          if (!row) {
            debugLog?.error('❌ No song found with ID:', { 
              module: 'audio-manager',
              function: 'playSongFromId',
              song_id: song_id
            });
            return;
          }
          
          const filename = row.filename;
          
          if (!filename) {
            debugLog?.error('❌ No filename found for song ID:', { 
              module: 'audio-manager',
              function: 'playSongFromId',
              song_id: song_id,
              rowData: row
            });
            return;
          }
          
          playSongWithFilename(filename, row, song_id);
        } catch (dbError) {
          debugLog?.error('❌ Legacy database error:', { 
            module: 'audio-manager',
            function: 'playSongFromId',
            error: dbError.message
          });
        }
      } else {
        debugLog?.error('❌ No database access available', { 
          module: 'audio-manager',
          function: 'playSongFromId'
        });
      }
    }
    
    return; // Exit early since we're handling the rest in playSongWithFilename
  }
}

/**
 * Play the currently selected song
 */
function playSelected() {
  const song_id = $("#selected_row").attr("songid");
  debugLog?.info("Got song ID " + song_id, { 
    module: 'audio-manager',
    function: 'playSelected',
    song_id: song_id
  });

  // Only clear the now_playing class if the selected row is from the search panel
  // (not from the holding tank/playlist)
  if (!$("#holding-tank-column").has($("#selected_row")).length) {
    $(".now_playing").removeClass("now_playing");
  }

  const holdingTankMode = sharedState.get('holdingTankMode');
  if (holdingTankMode === "storage") {
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
  if (autoplay && holdingTankMode === "playlist") {
    const now_playing = $(".now_playing").first();
    if (now_playing.length) {
      now_playing.removeClass("now_playing");
      next_song = now_playing.next();
      next_song.addClass("now_playing");
    }
    if (next_song.length) {
      // Clear any existing highlighting and highlight the new playing track
      $("#selected_row").removeAttr("id");
      next_song.attr("id", "selected_row");
      playSongFromId(next_song.attr("songid"));
      next_song.addClass("now_playing");
    } else {
      // End of playlist - just remove the now_playing class and stay in playlist mode
      $("li.now_playing").first().removeClass("now_playing");
      // Clear any highlighting at the end of playlist
      $("#selected_row").removeAttr("id");
      // Don't switch modes - stay in playlist mode
    }
  }
}

/**
 * Cancel autoplay functionality
 */
function cancel_autoplay() {
  if (!$("#holding-tank-column").has($("#selected_row")).length) {
    // Only cancel autoplay if we're not in the holding tank
    const holdingTankMode = sharedState.get('holdingTankMode');
    if (holdingTankMode === "playlist") {
      sharedState.set('autoplay', false);
      // Note: setHoldingTankMode should be available from the mode management module
      if (window.setHoldingTankMode) {
        window.setHoldingTankMode("storage");
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
  cancel_autoplay
};

// Default export for module loading
export default {
  playSongFromId,
  playSongWithFilename,
  playSelected,
  song_ended,
  autoplay_next,
  cancel_autoplay
}; 