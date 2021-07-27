var sound;
var categories = [];
var globalAnimation;
var autoplay = false;
var loop = false;
var wavesurfer = WaveSurfer.create({
  container: '#waveform',
  waveColor: '#e9ecef',
  backgroundColor: '#343a40',
  progressColor: '#007bff',
  cursorColor: 'white',
  cursorWidth: 0,
  responsive: true,
  height: 100
});
var fontSize = 11;

// Animate.css

const animateCSS = (element, animation, speed = '', prefix = 'animate__') =>
  // We create a Promise and return it
  new Promise((resolve, reject) => {
    const animationName = `${prefix}${animation} ${speed}`;
    const node = element;

    node.addClass(`${prefix}animated ${animationName}`);

    // When the animation ends, we clean the classes and resolve the Promise
    function handleAnimationEnd() {
      node.removeClass(`${prefix}animated ${animationName}`);
      node.off('animationend', handleAnimationEnd);

      resolve('Animation ended');
    }

    node.on('animationend', handleAnimationEnd);
  });

function playSongFromHotkey(hotkey) {
  console.log ('Getting song ID from hotkey ' + hotkey);
  var song_id = $(`.hotkeys.active #${hotkey}_hotkey`).attr('songid');
  console.log (`Found song ID ${song_id}`);
  if (song_id) {
    console.log (`Preparing to play song ${song_id}`);
    autoplay = true;
    toggleAutoPlay();
    playSongFromId(song_id);
    animateCSS($(`.hotkeys.active #${hotkey}_hotkey`), 'flipInX');
  }
}

function populateHotkeys(fkeys, title) {
  for (var key in fkeys) {
    if (fkeys[key]) {
      try {
        $(`.hotkeys.active #${key}_hotkey`).attr('songid', fkeys[key]);
        setLabelFromSongId(fkeys[key], $(`.hotkeys.active #${key}_hotkey`))
      } catch(err) {
        console.log(`Error loading fkey ${key} (DB ID: ${fkeys[key]})`)
      }
    }
    else {
      $(`.hotkeys.active #${key}_hotkey`).removeAttr('songid');
      $(`.hotkeys.active #${key}_hotkey span`).html('');
    }
  }
  if (title) {
    $('#hotkey_tabs li a.active').text(title)
  }
}

function populateHoldingTank(songIds) {
  $('.holding_tank.active').empty();
  songIds.forEach(songId => {
   addToHoldingTank(songId, $(".holding_tank.active"));
  });
  scale_scrollable();
  return false;
}


function clearHotkeys() {
  if (confirm('Are you sure you want clear your hotkeys?')) {
    for(let key=1;key<=12;key++) {
      $(`.hotkeys.active #f${key}_hotkey`).removeAttr('songid');
      $(`.hotkeys.active #f${key}_hotkey span`).html('');
    }
  }
}

function clearHoldingTank() {
  if (confirm('Are you sure you want clear your holding tank?')) {
    $('.holding_tank.active').empty();
  }
}

function openHotkeyFile() {
  ipcRenderer.send('open-hotkey-file');
}

function openHoldingTankFile() {
  ipcRenderer.send('open-holding-tank-file');
}

function saveHotkeyFile() {
  console.log('Renderer starting saveHotkeyFile');
  var hotkeyArray = [];
  for(let key=1;key<=12;key++){
    hotkeyArray.push($(`.hotkeys.active li#f${key}_hotkey`).attr('songid'));
  }
  if ( !/^\d$/.test($('#hotkey_tabs li a.active').text()) ) {
    hotkeyArray.push($('#hotkey_tabs li a.active').text())
  }
  ipcRenderer.send('save-hotkey-file', hotkeyArray);
}

function saveHoldingTankFile() {
  console.log('Renderer starting saveHoldingTankFile');
  var holdingTankArray = [];
  $('.holding_tank.active li').each(function() {
    holdingTankArray.push($(this).attr('songid'));
  })
  ipcRenderer.send('save-holding-tank-file', holdingTankArray);
}

function openPreferencesModal() {
  $('#preferencesModal').modal();
}

function populateCategorySelect(){
  console.log("Populating categories");
  $('#category_select option').remove()
  $('#category_select').append(`<option value="*">All Categories</option>`)
  var stmt = db.prepare("SELECT * FROM categories ORDER BY description ASC");
  for (const row of stmt.iterate()) {
    categories[row.code] = row.description;
    $('#category_select').append(`<option value="${row.code}">${row.description}</option>`);
    //console.log('Found ' + row.code + ' as ' + row.description);
  };
}

function searchData(){

  $('#search_results tbody').find("tr").remove();
  $("#search_results thead").show();

  var raw_html = [];
  var query_params = [];
  var query_segments = [];
  var query_string = '';
  var category = $("#category_select").val();

  if (category != '*') {
    query_segments.push('category = ?');
    query_params.push(category);
  }

  if ($('#advanced-search').is(':visible')) {
    var title = $("#title-search").val().trim();
    var artist = $("#artist-search").val().trim();
    var info = $("#info-search").val().trim();
    var since = $('#date-search').val();
    if (title.length) {
      query_segments.push('title LIKE ?');
      query_params.push(`%${title}%`);
    }
    if (artist.length) {
      query_segments.push('artist LIKE ?');
      query_params.push(`%${artist}%`);
    }
    if (info.length) {
      query_segments.push('info LIKE ?');
      query_params.push(`%${info}%`);
    }
    if (since.length) {
      query_segments.push("modtime > ?");
      var today = new Date();
      query_params.push(Math.round(today.setDate(today.getDate() - since) / 1000));
    }
    if (query_segments.length != 0) {
      query_string = " WHERE " + query_segments.join(' AND ');
    }
  } else {
    var omni = $('#omni_search').val().trim();
    var search_term = '%' + omni + '%';
    if (omni != '') {
      query_segments.push('(info LIKE ? OR title LIKE ? OR artist like ?)');
      query_params.push(search_term, search_term, search_term);
    }
    if (query_segments.length != 0) {
      query_string = " WHERE " + query_segments.join(' AND ');
    }
  }

  console.log("Query string is" + query_string);

  var stmt = db.prepare("SELECT * from mrvoice" + query_string + ' ORDER BY category,info,title,artist');
  const rows = stmt.all(query_params);
  rows.forEach((row) => {
    raw_html.push(`<tr draggable='true' ondragstart='songDrag(event)' style='font-size: ${fontSize}px' class='song unselectable context-menu' songid='${row.id}'><td class='hide-1'>${categories[row.category]}</td><td class='hide-2'>${row.info || ''}</td><td style='font-weight: bold'>${row.title || ''}</td><td style='font-weight:bold'>${row.artist || ''}</td><td>${row.time}</td></tr>`);
  });
  $("#search_results").append(raw_html.join(''));

  scale_scrollable();

  $('#omni_search').select();
  $("#category_select").prop("selectedIndex", 0);
}

function setLabelFromSongId(song_id, element) {
  //console.log(element);
  var stmt = db.prepare("SELECT * from mrvoice WHERE id = ?");
  var row = stmt.get(song_id);
  var title = row.title || '[Unknown Title]';
  var artist = row.artist || '[Unknown Artist]';
  var time = row.time || '[??:??]';

  // Handle swapping
  var original_song_node = $(`.hotkeys.active li[songid=${song_id}]`).not(element);
  console.log(original_song_node);
  if (original_song_node.length) {
    var old_song = original_song_node.find('span').detach();
    var destination_song = $(element).find('span').detach();
    original_song_node.append(destination_song);
    if (destination_song.attr('songid')) {
      original_song_node.attr("songid", destination_song.attr("songid"));
    } else {
      original_song_node.removeAttr("songid");
    }

    $(element).append(old_song);

  } else {
    $(element).find("span").html(`${title} by ${artist} (${time})`);
    $(element).find("span").attr("songid", song_id);
  }
}

function addToHoldingTank(song_id, element) {
  var stmt = db.prepare("SELECT * from mrvoice WHERE id = ?");
  var row = stmt.get(song_id);
  var title = row.title || "[Unknown Title]";
  var artist = row.artist || "[Unknown Artist]";
  var time = row.time || "[??:??]";

  var existing_song = $(`.holding_tank.active li[songid=${song_id}]`);
  if (existing_song.length) {
    var song_row = existing_song.detach();
  } else {
    var song_row = `<li style='font-size: ${fontSize}px' class='song list-group-item' draggable='true' ondragstart='songDrag(event)' songid='${song_id}'>${title} by ${artist} (${time})</li>`;
  }

  if ($(element).is("li")) {
    $(element)
    .after(song_row);
  } else if ($(element).is('div')) {
    $(element).find('ul.active').append(song_row);
  } else {
    $(element).append(song_row);
  }
}

var howlerUtils = {
	formatTime: function (secs) {
		var minutes = Math.floor(secs / 60) || 0;
		var seconds = (secs - minutes * 60) || 0;
		return minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
  },
  isLoaded: function(s) {
    return (s.state() == 'loaded');
  },
	updateTimeTracker: function () {
    if (!howlerUtils.isLoaded(sound)) {
      cancelAnimationFrame(globalAnimation);
      wavesurfer.empty();
      return;
    }
    var self = this;
    var seek = sound.seek() || 0;
    var remaining = self.duration() - seek;
    var currentTime = howlerUtils.formatTime(Math.round(seek));
    var remainingTime = howlerUtils.formatTime(Math.round(remaining));
    var percent_elapsed = seek / self.duration();
    $("#audio_progress").width((percent_elapsed * 100 || 0) + "%");
    if (!isNaN(percent_elapsed)) wavesurfer.seekTo(percent_elapsed);
    $("#timer").text(currentTime);
    $("#duration").text(`-${remainingTime}`);
    globalAnimation = requestAnimationFrame(howlerUtils.updateTimeTracker.bind(self));
	}
};

function song_ended() {
  $("#duration").html("0:00");
  $("#timer").html("0:00");
  $("#audio_progress").width("0%");
  $("#song_now_playing").fadeOut(100);
  $("song_now_playing").removeAttr('songid');
  $("#play_button").removeClass("d-none");
  $("#pause_button").addClass("d-none");
  if (!$("#selected_row").length) {
    $("#play_button").attr("disabled", true);
  }
  $("#stop_button").attr("disabled", true);
}

function playSongFromId(song_id){
  console.log('Playing song from song ID ' + song_id);
  if (song_id) {
    if (sound) {
      sound.off('fade');
      sound.unload();
    }
    var stmt = db.prepare("SELECT * from mrvoice WHERE id = ?");
    var row = stmt.get(song_id);
    var filename = row.filename;
    var sound_path = [path.join(store.get('music_directory'), filename)];
    console.log("Inside get, Filename is " + filename);
    sound = new Howl({
      src: sound_path,
      html5: true,
      volume: $('#volume').val()/100,
      mute: $("#mute_button").hasClass("btn-danger"),
      onplay: function() {
        var time = Math.round(sound.duration());
        globalAnimation = requestAnimationFrame(howlerUtils.updateTimeTracker.bind(this));
        var title = row.title || "";
        var artist = row.artist || "";
        artist = artist.length ? "by " + artist : artist;
        wavesurfer.load(sound_path);
        $("#song_now_playing")
          .html(
            `<i id="song_spinner" title="CD" class="fas fa-sm fa-spin fa-compact-disc"></i> ${title} ${artist}`
          )
          .fadeIn(100);
        $("#song_now_playing").attr('songid',song_id);
        $("#play_button").addClass("d-none");
        $("#pause_button").removeClass("d-none");
        $("#stop_button").removeAttr('disabled');
        $("#play_button").removeAttr("disabled");
        $("#progress_bar .progress-bar").addClass(
          "progress-bar-animated progress-bar-striped"
        );
      },
      onend: function() {
        song_ended();
        if (loop) {
          sound.play();
        } else {
          sound.unload();
          autoplay_next();
        }
      },
      onstop: function() {
        console.log('Stopped!');
        song_ended();
      }
    });

    sound.play();

  }
}

function autoplay_next() {
  if (autoplay) {
    var now_playing = $(".now_playing").first();
    if (now_playing.length) {
      now_playing.removeClass("now_playing");
      next_song = now_playing.next();
      next_song.addClass("now_playing");
    }
    if (next_song.length) {
      playSongFromId(next_song.attr("songid"));
      next_song.addClass("now_playing");
    } else {
      $("li.now_playing").first().removeClass("now_playing");
    }
  }
}

function cancel_autoplay() {
  if (!$("#holding-tank-column").has($("#selected_row")).length) {
    autoplay = true;
    toggleAutoPlay();
  }
}

function playSelected(){
  var song_id = $('#selected_row').attr('songid');
  console.log('Got song ID ' + song_id);
  cancel_autoplay();
  playSongFromId(song_id);
}

function stopPlaying(fadeOut = false){
  if (sound) {
    sound.on('fade', function(){
      sound.unload();
    });
    if (autoplay) {
      $(".now_playing").first().removeClass("now_playing");
    }
    if (fadeOut) {
      var fadeDuration = (store.get('fade_out_seconds') * 1000);
      sound.fade(sound.volume(),0,fadeDuration);
    } else {
      sound.unload();
    }
  }
}

function pausePlaying(fadeOut = false) {
  if (sound) {
    toggle_play_button();
    if (sound.playing()) {
      sound.on("fade", function () {
        sound.pause();
        sound.volume(old_volume);
      });
      $("#song_spinner").removeClass('fa-spin');
      $("#progress_bar .progress-bar").removeClass("progress-bar-animated progress-bar-striped");
      if (fadeOut) {
        var old_volume = sound.volume();
        var fadeDuration = (store.get('fade_out_seconds') * 1000)
        sound.fade(sound.volume(), 0, fadeDuration);
      } else {
        sound.pause();
      }
    } else {
      sound.play();
      $("#song_spinner").addClass("fa-spin");
      $("#progress_bar .progress-bar").addClass("progress-bar-animated progress-bar-striped");
    }
  }
}

function toggle_play_button() {
  $('#play_button').toggleClass('d-none');
  $('#pause_button').toggleClass('d-none');
}

function hotkeyDrop(event) {
  event.preventDefault();
  var song_id = event.dataTransfer.getData("text");
  var target = $(event.currentTarget);
  target.attr('songid', song_id);
  setLabelFromSongId(song_id,target);
}

function holdingTankDrop(event) {
  event.preventDefault();
  addToHoldingTank(event.dataTransfer.getData("text"), $(event.target));
}

function allowHotkeyDrop(event) {
  event.preventDefault();
}

function songDrag(event) {
  console.log('Starting drag for ID ' + event.target.getAttribute('songid'));
  event.dataTransfer.setData("text", event.target.getAttribute('songid'));
}

function columnDrag(event) {
  console.log("Starting drag for column ID " + event.target.getAttribute("id"));
  event.dataTransfer.setData("application/x-moz-node",event.target.getAttribute("id"));
}

function sendToHotkeys() {
  if ($("#selected_row").is("span")) {
    return;
  }
  target = $(".hotkeys.active li").not("[songid]").first();
  song_id = $("#selected_row").attr("songid");
  if ($(`.hotkeys.active li[songid=${song_id}]`).length) {
    return;
  }
  if (target && song_id) {
    target.attr('songid',song_id);
    setLabelFromSongId(song_id,target);
  }
  return false;
}

function sendToHoldingTank() {
  target = $(".holding_tank.active");
  song_id = $("#selected_row").attr("songid");
  if (song_id) {
    addToHoldingTank(song_id,target);
  }
  return false;
}

function selectNext() {
  $("#selected_row").removeAttr("id").next().attr("id","selected_row");
}

function selectPrev() {
  $("#selected_row").removeAttr("id").prev().attr("id", "selected_row");
}

function toggleAutoPlay() {
    autoplay = !autoplay;
    $(".now_playing").removeClass("now_playing");
    if (autoplay) {
      $("#holding_tank_label").html("Auto-Play");
      $("#autoplay_button").addClass("fa-stop");
      $("#autoplay_button").removeClass("fa-play-circle");
      $(`.holding_tank li[songid=${$('#song_now_playing').attr('songid')}]`).addClass('now_playing');
      $("#holding_tank").addClass("autoplaying");
    } else {
      $("#autoplay_button").removeClass("fa-stop");
      $("#autoplay_button").addClass("fa-play-circle");
      $("#holding_tank_label").html("Holding Tank");
      $("#holding_tank").removeClass("autoplaying");
    }

}

function deleteSong() {
  animateCSS($('#selected_row'), 'zoomOut', 'animate__faster').then(() => {
    if ($("#selected_row").is('span')) {
      $("#selected_row").parent().removeAttr('songid');
      $("#selected_row").empty();
      $("#selected_row").removeAttr('id');
    } else {
      $("#selected_row").remove();
    }
  });
  return false;
}

function scale_scrollable() {
  var advanced_search_height = $("#advanced-search").is(":visible") ? 38 : 0;
  if ($("#advanced-search").is(":visible")) {
    advanced_search_height = 38;
  }
  $(".table-wrapper-scroll-y").height($(window).height() - 240 - advanced_search_height + "px");
}

function switchToHotkeyTab(tab) {
  $(`#hotkey_tabs li:nth-child(${tab}) a`).tab('show');
}

function renameHotkeyTab() {
  ipcRenderer.invoke('get-app-path').then((result) => {
    prompt({
      title: "Rename Hotkey Tab",
      label: "Rename this tab:",
      value: $("#hotkey_tabs .nav-link.active").text(),
      type: "input",
      alwaysOnTop: true,
      customStylesheet: path.join(result, 'src/stylesheets/colors.css')
    })
      .then((r) => {
        if (r === null) {
          console.log("user canceled");
        } else {
          $("#hotkey_tabs .nav-link.active").text(r);
        }
      })
      .catch(console.error);

  })
}

function saveEditedSong(event) {
  event.preventDefault();
  $(`#songFormModal`).modal('hide');
  console.log("Starting edit process");
  var songId = $('#song-form-songid').val();
  var title = $('#song-form-title').val();
  var artist = $('#song-form-artist').val();
  var info = $('#song-form-info').val();
  var category = $('#song-form-category').val();

  const stmt = db.prepare("UPDATE mrvoice SET title = ?, artist = ?, category = ?, info = ? WHERE id = ?");
  stmt.run(title, artist, category, info, songId);

  $("#omni_search").val(title);
  searchData();
}

function saveNewSong(event) {
  event.preventDefault();
  $(`#songFormModal`).modal('hide');
  console.log("Starting save process");
  var filename = $('#song-form-filename').val();
  var pathData = path.parse(filename);
  var title = $('#song-form-title').val();
  var artist = $('#song-form-artist').val();
  var info = $('#song-form-info').val();
  var category = $('#song-form-category').val();

  if (category == "--NEW--") {
    var description = $('#song-form-new-category').val();
    var code = description.replace(/\s/g, "").substr(0,4).toUpperCase()
    var codeCheckStmt = db.prepare("SELECT * FROM categories WHERE code = ?")
    var loopCount = 1
    var newCode = code
    while (row = codeCheckStmt.get(newCode)) {
      console.log(`Found a code collision on ${code}`)
      var newCode = `${code}${loopCount}`
      loopCount = loopCount + 1
      console.log(`NewCode is ${newCode}`)
    }
    console.log(`Out of loop, setting code to ${newCode}`)
    code = newCode
    const categoryInsertStmt = db.prepare("INSERT INTO categories VALUES (?, ?)")
    try {
      const categoryInfo = categoryInsertStmt.run(code, $('#song-form-new-category').val())
      if (categoryInfo.changes == 1) {
        console.log(`Added new row into database`)
        populateCategorySelect()
        populateCategoriesModal()
        category = code
      }
    } catch(err) {
      if(err.message.match(/UNIQUE constraint/)) {
        var description = $('#song-form-new-category').val()
        $('#song-form-new-category').val('')
        alert(`Couldn't add a category named "${description}" - apparently one already exists!`)
        return
      }
    }
  }

  var duration = $('#song-form-duration').val();
  var uuid = uuidv4();
  var newFilename = `${artist}-${title}-${uuid}${pathData.ext}`.replace(/[^-.\w]/g, "");
  var newPath = path.join(store.get('music_directory'), newFilename );

  const stmt = db.prepare("INSERT INTO mrvoice (title, artist, category, info, filename, time, modtime) VALUES (?, ?, ?, ?, ?, ?, ?)");
  stmt.run(title, artist, category, info, newFilename, duration, Math.floor(Date.now() / 1000));
  fs.copyFileSync(filename, newPath);

  // Song has been saved, now let's show item
  $("#omni_search").val(title);
  searchData();
}

function savePreferences(event) {
  console.log('Saving preferences');
  event.preventDefault();
  $(`#preferencesModal`).modal('hide');
  store.set('database_directory', $('#preferences-database-directory').val());
  store.set('music_directory', $('#preferences-song-directory').val());
  store.set('hotkey_directory', $('#preferences-hotkey-directory').val());
  store.set('fade_out_seconds', $('#preferences-fadeout-seconds').val());
}


function renameHoldingTankTab() {
  ipcRenderer.invoke('get-app-path').then((result) => {
    prompt({
      title: "Rename Holding Tank Tab",
      label: "Rename this tab:",
      value: $("#holding_tank_tabs .nav-link.active").text(),
      type: "input",
      alwaysOnTop: true,
      customStylesheet: path.join(result, 'src/stylesheets/colors.css')
    })
      .then((r) => {
        if (r === null) {
          console.log("user canceled");
        } else {
          $("#holding_tank_tabs .nav-link.active").text(r);
        }
      })
      .catch(console.error);
    });
}

function increaseFontSize() {
  $('.song').css('font-size', fontSize++ + "px");
}

function decreaseFontSize() {
  $(".song").css("font-size", fontSize-- + "px");
}

function editSelectedSong() {
  var songId = $('#selected_row').attr('songid');
  const stmt = db.prepare("SELECT * FROM mrvoice WHERE id = ?");

  if (songId) {
    var songInfo = stmt.get(songId);

    $('#song-form-songid').val(songId);
    $('#song-form-category').empty();
    const categoryStmt = db.prepare("SELECT * FROM categories ORDER BY description ASC");
    for (const row of categoryStmt.iterate()) {
      categories[row.code] = row.description;
      if (row.code == songInfo.category) {
        $('#song-form-category').append(`<option selected="selected" value="${row.code}">${row.description}</option>`);
      } else {
        $('#song-form-category').append(`<option value="${row.code}">${row.description}</option>`);
      }
    }


    $('#song-form-title').val(songInfo.title);
    $('#song-form-artist').val(songInfo.artist);
    $('#song-form-info').val(songInfo.info);
    $('#song-form-duration').val(songInfo.time);
    $('#songFormModal form').attr('onsubmit', 'saveEditedSong(event)')
    $('#songFormModalTitle').html('Edit This Song')
    $('#songFormSubmitButton').html('Save');
    $('#songFormModal').modal();

  }

}
function deleteSelectedSong() {
  var songId = $('#selected_row').attr('songid');
  if (songId) {
    console.log(`Preparing to delete song ${songId}`);
    const songStmt = db.prepare("SELECT * FROM mrvoice WHERE ID = ?")
    var songRow = songStmt.get(songId);
    var filename = songRow.filename;
    if (confirm(`Are you sure you want to delete ${songRow.title} from Mx. Voice permanently?`)) {
      console.log("Proceeding with delete");
      const deleteStmt = db.prepare("DELETE FROM mrvoice WHERE id = ?")
      if(deleteStmt.run(songId)) {
        fs.unlinkSync(path.join(store.get('music_directory'), filename));
        // Remove song anywhere it appears
        $(`.holding_tank li[songid=${songId}]`).remove();
        $(`.hotkeys li span[songid=${songId}]`).remove();
        $(`.hotkeys li [songid=${songId}]`).removeAttr('id');
        $(`#search_results tr[songid=${songId}]`).remove();
      } else {
        console.log("Error deleting song from database")
      }
    }
  }
}

function showBulkAddModal(directory) {
  $('#bulk-add-path').val(directory)
  $('#bulk-add-category').empty();
  const stmt = db.prepare("SELECT * FROM categories ORDER BY description ASC");
  for (const row of stmt.iterate()) {
    categories[row.code] = row.description;
    $('#bulk-add-category').append(`<option value="${row.code}">${row.description}</option>`);
  }
  $('#bulk-add-category').append(`<option value="" disabled>-----------------------</option>`);
  $('#bulk-add-category').append(`<option value="--NEW--">ADD NEW CATEGORY...</option>`);

  $('#bulkAddModal').modal();
}

function addSongsByPath(pathArray, category) {
  const songSourcePath = pathArray.shift();
  if (songSourcePath) {
    return mm.parseFile(songSourcePath).then(metadata => {

      var durationSeconds = metadata.format.duration.toFixed(0);
      var durationString = new Date(durationSeconds * 1000).toISOString().substr(14, 5);

      var title = metadata.common.title || path.parse(songSourcePath).name
      if (!title) { return }
      var artist = metadata.common.artist
      var uuid = uuidv4();
      var newFilename = `${artist}-${title}-${uuid}${path.extname(songSourcePath)}`.replace(/[^-.\w]/g, "");
      var newPath = path.join(store.get('music_directory'), newFilename );
      const stmt = db.prepare("INSERT INTO mrvoice (title, artist, category, filename, time, modtime) VALUES (?, ?, ?, ?, ?, ?)");
      const info = stmt.run(title, artist, category, newFilename, durationString, Math.floor(Date.now() / 1000));
      console.log(`Copying audio file ${songSourcePath} to ${newPath}`)
      fs.copyFileSync(songSourcePath, newPath);
      $("#search_results").append(`<tr draggable='true' ondragstart='songDrag(event)' class='song unselectable context-menu' songid='${info.lastInsertRowid}'><td>${categories[category]}</td><td></td><td style='font-weight: bold'>${title || ''}</td><td style='font-weight:bold'>${artist || ''}</td><td>${durationString}</td></tr>`);


      return addSongsByPath(pathArray, category); // process rest of the files AFTER we are finished
    })
  }
  return Promise.resolve();
}

function saveBulkUpload(event) {
  event.preventDefault();
  $('#bulkAddModal').modal('hide');
  var dirname = $('#bulk-add-path').val()

  var walk = function(dir) {
      var results = [];
      var list = fs.readdirSync(dir);
      list.forEach(function(file) {
          file = dir + '/' + file;
          var stat = fs.statSync(file);
          if (stat && stat.isDirectory()) {
              /* Recurse into a subdirectory */
              results = results.concat(walk(file));
          } else {
              /* Is a file */
              var pathData = path.parse(file);
              if (['.mp3', '.mp4', '.m4a', '.wav', '.ogg'].includes(pathData.ext.toLowerCase())) {
                results.push(file);
            }
          }
      });
      return results;
  }

  var songs = walk(dirname);

  $('#search_results tbody').find("tr").remove();
  $("#search_results thead").show();

  var category = $('#bulk-add-category').val()

  if (category == "--NEW--") {
    var description = $('#bulk-song-form-new-category').val();
    var code = description.replace(/\s/g, "").substr(0,4).toUpperCase()
    var codeCheckStmt = db.prepare("SELECT * FROM categories WHERE code = ?")
    var loopCount = 1
    var newCode = code
    while (row = codeCheckStmt.get(newCode)) {
      console.log(`Found a code collision on ${code}`)
      var newCode = `${code}${loopCount}`
      loopCount = loopCount + 1
      console.log(`NewCode is ${newCode}`)
    }
    console.log(`Out of loop, setting code to ${newCode}`)
    code = newCode
    const categoryInsertStmt = db.prepare("INSERT INTO categories VALUES (?, ?)")
    try {
      const categoryInfo = categoryInsertStmt.run(code, description)
      if (categoryInfo.changes == 1) {
        console.log(`Added new row into database`)
        populateCategorySelect()
        populateCategoriesModal()
        category = code
      }
    } catch(err) {
      if(err.message.match(/UNIQUE constraint/)) {
        var description = $('#bulk-song-form-new-category').val()
        $('#bulk-song-form-new-category').val('')
        alert(`Couldn't add a category named "${description}" - apparently one already exists!`)
        return
      }
    }
  }

  addSongsByPath(songs, category);

}

function populateCategoriesModal() {
  $('#categoryList').find('div.row').remove();

  const stmt = db.prepare("SELECT * FROM categories ORDER BY description ASC");
  for (const row of stmt.iterate()) {

    $("#categoryList").append(`<div class="form-group row">

      <div class="col-sm-8">
        <div catcode="${row.code}" class="category-description">${row.description}</div>
        <input style="display: none;" type="text" class="form-control form-control-sm categoryDescription" catcode="${row.code}" id="categoryDescription-${row.code}" value="${row.description}" required>
      </div>
      <div class="col-sm-4">
      <a href="#" class="btn btn-primary btn-xs" onclick="editCategory('${row.code}')">Edit</a>&nbsp;
      <a class="delete_link btn btn-danger btn-xs" href="#" onclick="deleteCategory(event,'${row.code}','${row.description}')">Delete</a>
      </div>

    `);
  }

}

function editCategory(code) {
    $(".categoryDescription").hide();
    $(".category-description").show();
    $(`.category-description[catcode=${code}]`).hide();
    $(`.categoryDescription[catcode=${code}]`).show().select();

}

function openCategoriesModal() {
  populateCategoriesModal()

  $('#categoryManagementModal').modal();

}

function deleteCategory(event,code,description) {
  event.preventDefault()
  if (confirm(`Are you sure you want to delete "${description}" from Mx. Voice permanently? All songs in this category will be changed to the category "Uncategorized."`)) {
    console.log(`Deleting category ${code}`)

    const uncategorizedCheckStmt = db.prepare("INSERT OR REPLACE INTO categories VALUES(?, ?);")
    const uncategorizedCheckInfo = uncategorizedCheckStmt.run('UNC', 'Uncategorized')
    if (uncategorizedCheckInfo.changes == 1) {
      console.log(`Had to upsert Uncategorized table`)
    }
    const stmt = db.prepare('UPDATE mrvoice SET category = ? WHERE category = ?')
    const info = stmt.run('UNC', code)
    console.log(`Updated ${info.changes} rows to uncategorized`)

    const deleteStmt = db.prepare("DELETE FROM categories WHERE code = ?")
    const deleteInfo = deleteStmt.run(code)
    if (deleteInfo.changes == 1) {
      console.log(`Deleted category ${code}`)
    }
    populateCategorySelect()
    populateCategoriesModal()
  }
}

function saveCategories(event) {
  event.preventDefault();
  $('#categoryList div.row').each(function() {
    var code = $(this).find('.categoryDescription').attr('catcode')
    console.log(`Checking code ${code}`)
    var description = $(this).find('.categoryDescription').val();
    const stmt = db.prepare("UPDATE categories SET description = ? WHERE code = ? AND description != ?")
    const info = stmt.run(description, code, description)
    if (info.changes == 1) {
      console.log(`Saving changes to ${code} - new description is ${description}`)
    }
    populateCategorySelect()
    populateCategoriesModal()
  })

}
function addNewCategory(event) {
  event.preventDefault();
  console.log(`Adding new category`)
  var description = $('#newCategoryDescription').val();
  var code = description.replace(/\s/g, "").substr(0,4).toUpperCase()
  var codeCheckStmt = db.prepare("SELECT * FROM categories WHERE code = ?")
  var loopCount = 1
  var newCode = code
  while (row = codeCheckStmt.get(newCode)) {
    console.log(`Found a code collision on ${code}`)
    var newCode = `${code}${loopCount}`
    loopCount = loopCount + 1
    console.log(`NewCode is ${newCode}`)
  }
  console.log(`Out of loop, setting code to ${newCode}`)
  code = newCode
  console.log(`Adding ${code} :: ${description}`)
  const stmt = db.prepare("INSERT INTO categories VALUES (?, ?)")
  try {
    const info = stmt.run(code, description)
    if (info.changes == 1) {
      console.log(`Added new row into database`)
      $('#newCategoryCode').val('')
      $('#newCategoryDescription').val('')
      populateCategorySelect()
      populateCategoriesModal()
    }
  } catch(err) {
    if(err.message.match(/UNIQUE constraint/)) {
      $('#newCategoryDescription').val('')
      alert(`Couldn't add a category named "${description}" - apparently one already exists!`)
    }
  }
}

function toggle_selected_row(row) {
  // if ($(row).attr('id') == "selected_row") {
  //   $(row).removeAttr("id");
  // } else {
    $("#selected_row").removeAttr('id');
    $(row).attr("id", "selected_row");
    $("#play_button").removeAttr('disabled');
  // }
}

function loop_on(bool) {
  if (bool == true) {
    $("#loop_button").addClass("btn-success");
    $("#loop_button").removeClass("btn-secondary");
  } else {
    $("#loop_button").removeClass("btn-success");
    $("#loop_button").addClass("btn-secondary");
  }
}

function pickDirectory(event, element) {
  event.preventDefault();
  defaultPath = $(element).val();
  ipcRenderer.invoke('show-directory-picker', defaultPath).then((result) => {
    if (result) $(element).val(result);
  });
}

function installUpdate() {
  ipcRenderer.send('restart-and-install-new-version');
}

$( document ).ready(function() {

  scale_scrollable();

  populateCategorySelect();

  $("#search_results").on("click", "tbody tr", function (event) {
    toggle_selected_row(this);
  });

  $("#search_results").on("contextmenu", "tbody tr", function (event) {
    toggle_selected_row(this);
  });


  $("#search_results").on("dblclick", "tbody tr.song", function (event) {
    playSelected();
  });

   // Set up fkeys

  var search_field = document.getElementById("omni_search");

  for(let i=1;i<=12;i++) {
    Mousetrap.bind(`f${i}`, function () {
      playSongFromHotkey(`f${i}`);
    });

    Mousetrap(search_field).bind(
      `f${i}`,
      function () {
        playSongFromHotkey(`f${i}`);
      }
    );
  }

  for (let i = 1; i<=5; i++) {
    Mousetrap.bind(`command+${i}`, function () {
      switchToHotkeyTab(i);
    });

  }

  Mousetrap(search_field).bind("esc", function () {
    stopPlaying();
  });

  Mousetrap.bind("esc", function () {
    stopPlaying();
  });
  Mousetrap.bind("shift+esc", function () {
    stopPlaying(true);
  });

  Mousetrap.bind("command+l", function () {
    $("#omni_search").focus().select();
  });

  Mousetrap.bind("tab", function () {
    sendToHotkeys();
    return false;
  });

  Mousetrap.bind("space", function () {
    pausePlaying();
    return false;
  });

  Mousetrap.bind("shift+space", function () {
    pausePlaying(true);
    return false;
  });

  Mousetrap.bind("shift+tab", function () {
    sendToHoldingTank();
    return false;
  });

  Mousetrap.bind("return", function () {
    if (!$("#songFormModal").hasClass('show')) {
      playSelected();
    }
    return false;
  });

  Mousetrap.bind("down", function () {
    selectNext();
    return false;
  });

  Mousetrap.bind("up", function () {
    selectPrev();
    return false;
  });

  Mousetrap.bind(["backspace", "del"], function () {
    deleteSong();
    return false;
  });

  // Set up hotkey and holding tank tabs

  for (var i = 2; i<=5; i++) {
    var hotkey_node = $("#hotkeys_list_1").clone();
    hotkey_node.attr("id", `hotkeys_list_${i}`);
    hotkey_node.removeClass("show active");
    $("#hotkey-tab-content").append(hotkey_node);

    var holding_tank_node = $("#holding_tank_1").clone();
    holding_tank_node.attr("id", `holding_tank_${i}`);
    holding_tank_node.removeClass("show active");
    $("#holding-tank-tab-content").append(holding_tank_node);
  }

  $.contextMenu({
      selector: '.context-menu',
      items: {
        play: {
            name: "Play",
            icon: 'fas fa-play-circle',
            callback: function(key, opt){
                playSelected();
            }
        },
        edit: {
            name: "Edit",
            icon: 'fas fa-edit',
            callback: function(key, opt){
                editSelectedSong();
            }
        },
        delete: {
          name: "Delete",
          icon: 'fas fa-trash-alt',
          callback: function(key, opt){
              deleteSelectedSong();
          }
        }
    }
  });

  $(".holding_tank").on("click", "li", function (event) {
    toggle_selected_row(this);
  });

  $(".holding_tank").on("dblclick", "li", function (event) {
    $(".now_playing").first().removeClass("now_playing");
    if (autoplay) {
      $("#selected_row").addClass("now_playing");
    }
    playSelected();
  });

  $(".hotkeys").on("click", "li span", function (event) {
    toggle_selected_row(this);
  });

  $(".hotkeys").on("dblclick", "li", function (event) {
    $(".now_playing").first().removeClass("now_playing");
    $("#selected_row").removeAttr('id');
    if ($(this).find('span').text().length) {
      $(this).find("span").attr("id", "selected_row");
    }
    playSelected();
  });

  $(".hotkeys li").on("drop", function (event) {
    $(this).removeClass("drop_target");
    if (!event.originalEvent.dataTransfer.getData("text").length) return;
    hotkeyDrop(event.originalEvent);
  });

  $(".hotkeys li").on("dragover", function (event) {
    $(this).addClass("drop_target");
    allowHotkeyDrop(event.originalEvent);
  });

  $(".hotkeys li").on("dragleave", function (event) {
    $(this).removeClass("drop_target");
  });

  $("#category_select").on("change", function () {
    var category = $( "#category_select" ).prop('selectedIndex');
    searchData();
    $("#omni_search").focus();
    $("#category_select").prop('selectedIndex', category);
  });

  $("#date-search").on("change", function () {
    searchData();
  });

  $("#holding_tank").on("drop", function (event) {
    $(event.originalEvent.target).removeClass("dropzone");
    if (!event.originalEvent.dataTransfer.getData("text").length) return;
    holdingTankDrop(event.originalEvent);
  });

  $(".card-header").on("dragover", function (event) {
    event.preventDefault();
  });

  $(".card-header").on("drop", function (event) {
    if (event.originalEvent.dataTransfer.getData("text").length) return;
    var original_column = $(`#${event.originalEvent.dataTransfer.getData("application/x-moz-node")}`);
    var target_column = $(event.target).closest('.col');
    if (original_column.prop('id') == target_column.prop('id')) return;
    var columns = $('#top-row').children();
    if (columns.index(original_column) > columns.index(target_column)) {
      target_column.before(original_column.detach());
    } else {
      target_column.after(original_column.detach());
    }
    original_column.addClass("animate__animated animate__jello");
  });

  $("#holding_tank").on("dragover", function (event) {
    allowHotkeyDrop(event.originalEvent);
    $(event.originalEvent.target).addClass("dropzone");
  });

  $("#holding_tank").on("dragleave", function (event) {
    allowHotkeyDrop(event.originalEvent);
    $(event.originalEvent.target).removeClass("dropzone");
  });

  $("#search_form :input").on("keydown", function (e) {
    if (e.code == "Enter") {
      $("#search_form").submit();
      return false;
    }
  });

  $("#omni_search").on("keydown", function (e) {
    if (e.code == "Tab") {
      if ((first_row = $("#search_results tbody tr").first())) {
        $("#selected_row").removeAttr("id");
        first_row.attr("id", "selected_row");
        $("#omni_search").blur();
        return false;
      }
    }
  });

  $("#reset_button").on("click", function () {
    $("#search_form").trigger('reset');
    $("#omni_search").focus();
    $("#search_results tbody").find("tr").remove();
    $("#search_results thead").hide();
    return false;
  });

  $("#advanced_search_button").on("click", function () {
    $("#search_form").trigger('reset');
    if ($("#advanced-search").is(':visible')) {
      $("#advanced-search-icon").toggleClass('fa-plus fa-minus');
      $("#title-search").hide();
      $("#omni_search").show();
      $("#omni_search").focus();
      animateCSS($('#advanced-search'), 'fadeOutUp').then(() => {
        $("#advanced-search").hide();
        scale_scrollable();
      });
    } else {
      $("#advanced-search-icon").toggleClass('fa-plus fa-minus');
      $("#advanced-search").show();
      $("#title-search").show();
      $("#title-search").focus();
      $("#omni_search").hide();
      scale_scrollable();
      animateCSS($('#advanced-search'), 'fadeInDown').then(() => {

      });
    }
    return false;
  });

  $("#pause_button").click(function (e) {
    if (sound) {
      if (e.shiftKey) {
        pausePlaying(true);
      } else {
        pausePlaying();
      }
    }
  });

  $("#play_button").click(function (e) {
    if (sound && sound.state() == "loaded") {
      pausePlaying();
    } else {
      playSelected();
    }
  });

  $("#stop_button").click(function (e) {
    if (sound) {
      if (e.shiftKey) {
        stopPlaying(true);
      } else {
        stopPlaying();
      }
    }
  });

  $("#progress_bar").click(function(e) {
    var percent = (e.clientX - $(this).offset().left) / $(this).width();
    if (sound) {
      sound.seek(sound.duration() * percent);
    }
  })

  $("#waveform").click(function (e) {
    var percent = (e.clientX - $(this).offset().left) / $(this).width();
    if (sound) {
      sound.seek(sound.duration() * percent);
    }
  })

  $("#volume").on('change',function() {
    var volume = $(this).val()/100;
    if (sound) {
      sound.volume(volume);
    }
  });

  $('#mute_button').click(function() {
    if (sound) {
      sound.mute(!sound.mute());
      sound.volume($("#volume").val() / 100);
    }
    $("#mute_button").toggleClass("btn-danger btn-secondary");
    $("#song_now_playing").toggleClass("text-secondary");
  });

  $("#loop_button").click(function () {
    loop = !loop;
    loop_on(loop);
  });

  $("#waveform_button").click(function () {
    if ($('#waveform').hasClass('hidden')) {
      $('#waveform').removeClass('hidden');
      $(this).addClass('btn-primary');
      $(this).removeClass('btn-secondary');
      animateCSS($('#waveform'), 'fadeInUp').then(() => {

      });
    } else {
      $(this).removeClass('btn-primary');
      $(this).addClass('btn-secondary');
       animateCSS($('#waveform'), 'fadeOutDown').then(() => {
         $('#waveform').addClass('hidden');
       });
    }
  });

  $('.modal').on('show.bs.modal', function() {
    $(".modal").modal("hide");
  })

  $("#search_results thead").hide();

  $('#songFormModal').on('hidden.bs.modal', function (e) {
    $('#song-form-category').val('');
    $('#song-form-title').val('');
    $('#song-form-new-category').val('');
    $('#song-form-artist').val('');
    $('#song-form-info').val('');
    $('#song-form-duration').val('');
    $("#SongFormNewCategory").hide();
  })

    $("#songFormModal").on("shown.bs.modal", function (e) {
      console.log($("#song-form-title").val().length);
      if (!$("#song-form-title").val().length) {
        $("#song-form-title").focus();
      } else {
        $("#song-form-info").focus();
      }
    });

    $("#preferencesModal").on("shown.bs.modal", function (e) {
      $('#preferences-database-directory').val(store.get('database_directory'));
      $('#preferences-song-directory').val(store.get('music_directory'));
      $('#preferences-hotkey-directory').val(store.get('hotkey_directory'));
      $('#preferences-fadeout-seconds').val(store.get('fade_out_seconds'));
    });

    $(window).on('resize', function() {
      this.scale_scrollable();
    });

    // Is there only one song in the db? Pop the first-run modal

    var stmt = db.prepare("SELECT count(*) as count from mrvoice WHERE 1");
    var query = stmt.get();
    if (query.count <= 1) {
      $(`#firstRunModal`).modal("show");
    }

    $("#song-form-category").change(function(){
        $(this).find("option:selected").each(function(){
            var optionValue = $(this).attr("value");
            if(optionValue == "--NEW--"){
                $("#SongFormNewCategory").show();
                $("#song-form-new-category").attr('required', 'required')
            } else{
                $("#SongFormNewCategory").hide();
                $("#song-form-new-category").removeAttr("required")
            }
        });
    }).change();

    $("#bulk-add-category").change(function(){
        $(this).find("option:selected").each(function(){
            var optionValue = $(this).attr("value");
            if(optionValue == "--NEW--"){
                $("#bulkSongFormNewCategory").show();
                $("#bulk-song-form-new-category").attr('required', 'required')
            } else{
                $("#bulkSongFormNewCategory").hide();
                $("#bulk-song-form-new-category").removeAttr('required');
            }
        });
    }).change();

    $('#bulkAddModal').on('hidden.bs.modal', function (e) {
      $("#bulkSongFormNewCategory").hide();
      $("#bulk-song-form-new-category").val('');
    })
});
