/**
 * Audio Manager Module
 * 
 * This module handles the main audio playback functionality
 * in the MxVoice Electron application.
 */

// Import shared state
import sharedState from '../shared-state.js';
import { howlerUtils } from './audio-utils.js';

// Import debug logger - use lazy getter for proper initialization timing
function getDebugLog() {
  return window.debugLog || null;
}

// Import secure adapters
import { secureStore, secureDatabase } from '../adapters/secure-adapter.js';

/**
 * Play a song with the given filename and row data
 * 
 * @param {string} filename - The filename of the song
 * @param {Object} row - The database row data
 * @param {string} song_id - The database ID of the song
 */
function playSongWithFilename(filename, row, song_id) {
  console.log("🔥 DEBUG: playSongWithFilename called with filename:", filename);
  getDebugLog()?.info('🎵 PLAYBACK STEP 6: playSongWithFilename called', { 
    module: 'audio-manager',
    function: 'playSongWithFilename',
    filename: filename,
    song_id: song_id,
    row_title: row?.title,
    row_artist: row?.artist,
    timestamp: new Date().toISOString()
  });
  
  // Get music directory from store
  getDebugLog()?.info('🔍 PLAYBACK STEP 7: Getting music directory from store', { 
    module: 'audio-manager',
    function: 'playSongWithFilename',
    filename: filename,
    song_id: song_id
  });
  
  console.log("🔥 DEBUG: About to get music directory from store");
  secureStore.get("music_directory").then(musicDirectory => {
    console.log("🔥 DEBUG: Music directory result:", musicDirectory);
    getDebugLog()?.info('🔍 PLAYBACK STEP 8: Music directory retrieved', { 
      module: 'audio-manager',
      function: 'playSongWithFilename',
      musicDirectory: musicDirectory,
      musicDirectory_type: typeof musicDirectory,
      filename: filename,
      song_id: song_id
    });
    if (musicDirectory) {
      getDebugLog()?.info('🔍 Debug: musicDirectory:', { 
        module: 'audio-manager',
        function: 'playSongWithFilename',
        musicDirectoryValue: musicDirectory
      });
      if (!musicDirectory) {
        getDebugLog()?.warn('❌ musicDirectory is undefined or empty, using default path', { 
          module: 'audio-manager',
          function: 'playSongWithFilename'
        });
        // Use default path as fallback
        const defaultPath = path.join(process.env.APPDATA || process.env.HOME || '', '.config', 'mxvoice', 'mp3');
        window.electronAPI.path.join(defaultPath, filename).then(result => {
          if (result.success) {
            const sound_path = [result.data];
            getDebugLog()?.info("Inside get, Filename is " + filename, { 
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
                getDebugLog()?.info('🔍 Sound onplay event fired', { 
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
                getDebugLog()?.info('🔍 Sound onend event fired', { 
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
            getDebugLog()?.info('🔍 Setting sound in shared state:', { 
              module: 'audio-manager',
              function: 'playSongWithFilename',
              sound: sound
            });
            sharedState.set('sound', sound);
            getDebugLog()?.info('🔍 Sound set in shared state, now playing...', { 
              module: 'audio-manager',
              function: 'playSongWithFilename'
            });
            sound.play();
          } else {
            getDebugLog()?.warn('❌ Failed to join path with default:', { 
              module: 'audio-manager',
              function: 'playSongWithFilename',
              error: result.error
            });
          }
        }).catch(error => {
          getDebugLog()?.warn('❌ Path join error with default:', { 
            module: 'audio-manager',
            function: 'playSongWithFilename',
            error: error.message
          });
        });
        return;
      }
      
                window.electronAPI.path.join(musicDirectory, filename).then(result => {
        if (result.success) {
          if (!result.data) {
            getDebugLog()?.warn('❌ result.data is undefined or empty', { 
              module: 'audio-manager',
              function: 'playSongWithFilename'
            });
            return;
          }
          const sound_path = [result.data];
          getDebugLog()?.info("Inside get, Filename is " + filename, { 
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
              getDebugLog()?.info('🔍 Sound onplay event fired', { 
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
              getDebugLog()?.info('🔍 Sound onend event fired', { 
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
          getDebugLog()?.info('🔍 Setting sound in shared state:', { 
            module: 'audio-manager',
            function: 'playSongWithFilename',
            sound: sound
          });
          sharedState.set('sound', sound);
          getDebugLog()?.info('🔍 Sound set in shared state, now playing...', { 
            module: 'audio-manager',
            function: 'playSongWithFilename'
          });
          sound.play();
        } else {
          getDebugLog()?.warn('❌ Failed to join path:', { 
            module: 'audio-manager',
            function: 'playSongWithFilename',
            error: result.error
          });
        }
      }).catch(error => {
        getDebugLog()?.warn('❌ Path join error:', { 
          module: 'audio-manager',
          function: 'playSongWithFilename',
          error: error.message
        });
      });
    } else {
      getDebugLog()?.warn('❌ Could not get music directory from store', { 
        module: 'audio-manager',
        function: 'playSongWithFilename',
        musicDirectory: musicDirectory
      });
    }
  }).catch(error => {
    getDebugLog()?.warn('❌ Store get API error:', { 
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
  console.log("🔥 URGENT DEBUG: playSongFromId function called with song_id:", song_id);
  getDebugLog()?.info("🎵 PLAYBACK START: Playing song from song ID " + song_id, { 
    module: 'audio-manager',
    function: 'playSongFromId',
    song_id: song_id,
    song_id_type: typeof song_id,
    timestamp: new Date().toISOString()
  });
  
  if (!song_id) {
    getDebugLog()?.error("❌ PLAYBACK FAIL: No song_id provided", { 
      module: 'audio-manager',
      function: 'playSongFromId',
      song_id: song_id
    });
    return;
  }
  
  getDebugLog()?.info("🔍 PLAYBACK STEP 1: Stopping current sound and querying database", { 
    module: 'audio-manager',
    function: 'playSongFromId',
    song_id: song_id
  });
  
  const sound = sharedState.get('sound');
  if (sound) {
    sound.off("fade");
    sound.unload();
  }
  
  // Use secure database adapter to get song data
    getDebugLog()?.info("🔍 PLAYBACK STEP 2: Executing database query", { 
      module: 'audio-manager',
      function: 'playSongFromId',
      song_id: song_id,
      query: "SELECT * from mrvoice WHERE id = ?",
      params: [song_id]
  });
  
  console.log("🔥 DEBUG: About to execute database query for song_id:", song_id);
  secureDatabase.query("SELECT * from mrvoice WHERE id = ?", [song_id]).then(result => {
    console.log("🔥 DEBUG: Database query result:", result);
        getDebugLog()?.info("🔍 PLAYBACK STEP 3: Database query completed", { 
          module: 'audio-manager',
          function: 'playSongFromId',
          song_id: song_id,
          result_success: result?.success,
          result_data_length: result?.data?.length,
          full_result: result
    });
    if (result.success && result.data.length > 0) {
      console.log("🔥 DEBUG: Database query successful, song found");
      const row = result.data[0];
      const filename = row.filename;
      console.log("🔥 DEBUG: Song filename:", filename, "| Title:", row.title);
          
          getDebugLog()?.info("🔍 PLAYBACK STEP 4: Song data retrieved", { 
            module: 'audio-manager',
            function: 'playSongFromId',
            song_id: song_id,
            filename: filename,
            row_title: row.title,
            row_artist: row.artist,
            full_row: row
          });
          
          if (!filename) {
            getDebugLog()?.error('❌ PLAYBACK FAIL: No filename found for song ID:', { 
              module: 'audio-manager',
              function: 'playSongFromId',
              song_id: song_id,
              rowData: row
            });
            return;
          }
          
          getDebugLog()?.info("🎵 PLAYBACK STEP 5: Calling playSongWithFilename", { 
            module: 'audio-manager',
            function: 'playSongFromId',
            song_id: song_id,
            filename: filename
        });
        
        // Continue with the rest of the function...
        console.log("🔥 DEBUG: About to call playSongWithFilename");
        playSongWithFilename(filename, row, song_id);
      } else {
        console.log("🔥 DEBUG: Database query failed or no song found:", result);
        getDebugLog()?.error('❌ PLAYBACK FAIL: No song found with ID or query failed:', { 
            module: 'audio-manager',
            function: 'playSongFromId',
            song_id: song_id,
            result_success: result?.success,
            result_data: result?.data,
            result_error: result?.error
          });
        }
      }).catch(error => {
    console.log("🔥 DEBUG: Database query error:", error);
    getDebugLog()?.error('❌ PLAYBACK FAIL: Database query error:', { 
          module: 'audio-manager',
          function: 'playSongFromId',
          song_id: song_id,
          error: error.message,
          error_stack: error.stack,
          error_full: error
    });
    // Fallback to legacy database access
    const db = sharedState.get('db');
    if (db) {
          try {
            const stmt = db.prepare("SELECT * from mrvoice WHERE id = ?");
            const row = stmt.get(song_id);
            
            if (!row) {
              getDebugLog()?.error('❌ No song found with ID:', { 
                module: 'audio-manager',
                function: 'playSongFromId',
                song_id: song_id
              });
              return;
            }
            
            const filename = row.filename;
            
            if (!filename) {
              getDebugLog()?.error('❌ No filename found for song ID:', { 
                module: 'audio-manager',
                function: 'playSongFromId',
                song_id: song_id,
                rowData: row
              });
              return;
            }
            
            playSongWithFilename(filename, row, song_id);
          } catch (dbError) {
            getDebugLog()?.error('❌ Legacy database error:', { 
              module: 'audio-manager',
              function: 'playSongFromId',
              error: dbError.message
            });
          }
    } else {
      getDebugLog()?.error('❌ No database access available', { 
        module: 'audio-manager',
        function: 'playSongFromId'
      });
    }
  });
  
  return; // Exit early since we're handling the rest in playSongWithFilename
}

/**
 * Play the currently selected song
 */
function playSelected() {
  console.log("🔥 URGENT DEBUG: playSelected function called!!!");
  console.log("🔥 DEBUG: debugLog available?", !!debugLog, typeof debugLog);
  getDebugLog()?.info("🎵 PLAYBACK TRIGGER: playSelected called", { 
    module: 'audio-manager',
    function: 'playSelected',
    timestamp: new Date().toISOString(),
    selected_row_exists: $("#selected_row").length > 0
  });
  
  const song_id = $("#selected_row").attr("songid");
  getDebugLog()?.info("🔍 PLAYBACK STEP: Got song ID from selected row", { 
    module: 'audio-manager',
    function: 'playSelected',
    song_id: song_id,
    song_id_type: typeof song_id,
    selected_row_element: $("#selected_row")[0]
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

  getDebugLog()?.info("🎵 PLAYBACK STEP: Calling playSongFromId from playSelected", { 
    module: 'audio-manager',
    function: 'playSelected',
    song_id: song_id
  });
  
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
    holdingTankMode: holdingTankMode
  });
  
  if (autoplay && holdingTankMode === "playlist") {
    const now_playing = $(".now_playing").first();
    let next_song = $(); // Initialize as empty jQuery object
    
    if (now_playing.length) {
      getDebugLog()?.info('Found currently playing song, finding next', {
        module: 'audio-manager',
        function: 'autoplay_next',
        currentSongId: now_playing.attr("songid")
      });
      
      now_playing.removeClass("now_playing");
      next_song = now_playing.next();
      next_song.addClass("now_playing");
    }
    
    if (next_song.length) {
      getDebugLog()?.info('Playing next song in playlist', {
        module: 'audio-manager',
        function: 'autoplay_next',
        nextSongId: next_song.attr("songid")
      });
      
      // Clear any existing highlighting and highlight the new playing track
      $("#selected_row").removeAttr("id");
      next_song.attr("id", "selected_row");
      playSongFromId(next_song.attr("songid"));
      next_song.addClass("now_playing");
    } else {
      getDebugLog()?.info('End of playlist reached', {
        module: 'audio-manager',
        function: 'autoplay_next'
      });
      
      // End of playlist - just remove the now_playing class and stay in playlist mode
      $("li.now_playing").first().removeClass("now_playing");
      // Clear any highlighting at the end of playlist
      $("#selected_row").removeAttr("id");
      // Don't switch modes - stay in playlist mode
    }
  } else {
    getDebugLog()?.info('Autoplay conditions not met', {
      module: 'audio-manager',
      function: 'autoplay_next',
      autoplay: autoplay,
      holdingTankMode: holdingTankMode
    });
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