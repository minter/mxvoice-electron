/**
 * Audio Manager Module
 * 
 * This module handles the main audio playback functionality
 * in the MxVoice Electron application.
 */

/**
 * Play a song from its database ID
 * 
 * @param {string} song_id - The database ID of the song to play
 */
function playSongFromId(song_id) {
  console.log("Playing song from song ID " + song_id);
  if (song_id) {
    if (sound) {
      sound.off("fade");
      sound.unload();
    }
    
    var stmt = db.prepare("SELECT * from mrvoice WHERE id = ?");
    var row = stmt.get(song_id);
    
    if (!row) {
      console.error('❌ No song found with ID:', song_id);
      return;
    }
    
    var filename = row.filename;
    
    if (!filename) {
      console.error('❌ No filename found for song ID:', song_id, 'Row data:', row);
      return;
    }
    
    // Get music directory from store
    window.electronAPI.store.get("music_directory").then(musicDirectory => {
      console.log('🔍 Debug: musicDirectory response:', musicDirectory);
      if (musicDirectory.success) {
        console.log('🔍 Debug: musicDirectory.value:', musicDirectory.value);
        if (!musicDirectory.value) {
          console.warn('❌ musicDirectory.value is undefined or empty, using default path');
          // Use default path as fallback
          const defaultPath = path.join(process.env.APPDATA || process.env.HOME || '', '.config', 'mxvoice', 'mp3');
          window.electronAPI.path.join(defaultPath, filename).then(result => {
            if (result.success) {
              var sound_path = [result.data];
              console.log("Inside get, Filename is " + filename);
              sound = new Howl({
                src: sound_path,
                html5: true,
                volume: $("#volume").val() / 100,
                mute: $("#mute_button").hasClass("active"),
                onplay: function () {
                  var time = Math.round(sound.duration());
                  globalAnimation = requestAnimationFrame(
                    howlerUtils.updateTimeTracker.bind(this)
                  );
                  var title = row.title || "";
                  var artist = row.artist || "";
                  artist = artist.length ? "by " + artist : artist;
                  wavesurfer.load(sound_path);
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
                  song_ended();
                  if (loop) {
                    // If loop mode is enabled, restart the current song
                    playSongFromId(song_id);
                  } else if (autoplay && holdingTankMode === "playlist") {
                    autoplay_next();
                  }
                },
              });
              sound.play();
            } else {
              console.warn('❌ Failed to join path with default:', result.error);
            }
          }).catch(error => {
            console.warn('❌ Path join error with default:', error);
          });
          return;
        }
        
        window.electronAPI.path.join(musicDirectory.value, filename).then(result => {
          if (result.success) {
            if (!result.data) {
              console.warn('❌ result.data is undefined or empty');
              return;
            }
            var sound_path = [result.data];
            console.log("Inside get, Filename is " + filename);
            sound = new Howl({
              src: sound_path,
              html5: true,
              volume: $("#volume").val() / 100,
              mute: $("#mute_button").hasClass("active"),
              onplay: function () {
                var time = Math.round(sound.duration());
                globalAnimation = requestAnimationFrame(
                  howlerUtils.updateTimeTracker.bind(this)
                );
                var title = row.title || "";
                var artist = row.artist || "";
                artist = artist.length ? "by " + artist : artist;
                wavesurfer.load(sound_path);
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
                song_ended();
                if (loop) {
                  // If loop mode is enabled, restart the current song
                  playSongFromId(song_id);
                } else if (autoplay && holdingTankMode === "playlist") {
                  autoplay_next();
                }
              },
            });
            sound.play();
          } else {
            console.warn('❌ Failed to join path:', result.error);
          }
        }).catch(error => {
          console.warn('❌ Path join error:', error);
        });
      } else {
        console.warn('❌ Could not get music directory from store');
      }
    }).catch(error => {
      console.warn('❌ Store get API error:', error);
    });
  }
}

/**
 * Play the currently selected song
 */
function playSelected() {
  var song_id = $("#selected_row").attr("songid");
  console.log("Got song ID " + song_id);

  // Only clear the now_playing class if the selected row is from the search panel
  // (not from the holding tank/playlist)
  if (!$("#holding-tank-column").has($("#selected_row")).length) {
    $(".now_playing").removeClass("now_playing");
  }

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
  if (autoplay && holdingTankMode === "playlist") {
    var now_playing = $(".now_playing").first();
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
    if (holdingTankMode === "playlist") {
      autoplay = false;
      setHoldingTankMode("storage");
    }
  }
}

// Export individual functions for direct access
export {
  playSongFromId,
  playSelected,
  song_ended,
  autoplay_next,
  cancel_autoplay
};

// Default export for module loading
export default {
  playSongFromId,
  playSelected,
  song_ended,
  autoplay_next,
  cancel_autoplay
}; 