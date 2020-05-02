// var db = new sqlite3.Database(path.join(preferences.locations.database_directory, 'mrvoice.db'));
var sound;
var categories = [];
var globalAnimation;
var autoplay = false;

function playSongFromHotkey(hotkey) {
  console.log ('Getting song ID from hotkey ' + hotkey);
  var song_id = $(`.hotkeys.active #${hotkey}_hotkey`).attr('songid');
  console.log (`Found song ID ${song_id}`);
  if (song_id) {
    console.log (`Preparing to play song ${song_id}`);
    playSongFromId(song_id);
     $(`.hotkeys.active #${hotkey}_hotkey`).fadeOut(100).fadeIn(100);
  }
}

function populateHotkeys(fkeys) {
  for (var key in fkeys) {
    if (fkeys[key]) {
      $(`.hotkeys.active #${key}_hotkey`).attr('songid', fkeys[key]);
      setLabelFromSongId(fkeys[key], $(`.hotkeys.active #${key}_hotkey`))
    }
    else {
      $(`.hotkeys.active #${key}_hotkey`).removeAttr('songid');
      $(`.hotkeys.active #${key}_hotkey span`).html('');
    }
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
    hotkeyArray.push($(`#f${key}_hotkey`).attr('songid'));
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

function populateCategorySelect(){
  console.log("Populating categories");
  var stmt = db.prepare("SELECT * FROM categories ORDER BY description ASC");
  for (const row of stmt.iterate()) {
    categories[row.code] = row.description;
    $('#category_select').append(`<option value="${row.code}">${row.description}</option>`);
    //console.log('Found ' + row.code + ' as ' + row.description);
  };
}

function searchData(){
  var category = $( "#category_select" ).val();
  console.log('Using category ' + category);
  var value = $( '#omni_search' ).val().trim();
  console.log('Called with search string ' + value);
  $('#search_results tbody').find("tr").remove();
  $("#search_results thead").show();
  var search_term = '%' + value + '%';
  var query_params = [];
  var query_segments = [];
  var query_string = '';
  if (category != '*') {
    query_segments.push('category = ?');
    query_params.push(category);
  }
  if (value != '') {
    query_segments.push('(info LIKE ? OR title LIKE ? OR artist like ?)');
    query_params.push(search_term, search_term, search_term);
  }
  if (query_segments.length != 0) {
    query_string = " WHERE " + query_segments.join(' AND ');
  }
  console.log("Query string is " + query_string);

  $( '#omni_search' ).select();

  var stmt = db.prepare("SELECT * from mrvoice" + query_string + ' ORDER BY category,info,title,artist');
  for (const row of stmt.iterate(query_params)) {
    //console.log('Found ' + row.title + ' by ' + row.artist);
    $("#search_results").append(`<tr draggable='true' ondragstart='songDrag(event)' class='song unselectable' songid='${row.id}'><td>${categories[row.category]}</td><td>${row.info || ''}</td><td style='font-weight: bold'>${row.title || ''}</td><td style='font-weight:bold'>${row.artist || ''}</td><td>${row.time}</td></tr>`);
  }

  scale_scrollable();

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
    var song_row = `<li class='list-group-item' draggable='true' ondragstart='songDrag(event)' songid='${song_id}'>${title} by ${artist} (${time})</li>`;
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
	updateTimeTracker: function () {
		var self = this;
		var seek = sound.seek() || 0;
    var remaining = self.duration() - seek;
		var currentTime = howlerUtils.formatTime(Math.round(seek));
    var remainingTime = howlerUtils.formatTime(Math.round(remaining));
		if (self.playing()) {
      requestAnimationFrame(howlerUtils.updateTimeTracker.bind(self));
      $("#audio_progress").width(
              ((seek / self.duration()) * 100 || 0) + "%"
      );
      $("#timer").text(currentTime);
      $("#duration").text(`-${remainingTime}`);
		} else {
      cancelAnimationFrame(globalAnimation);
    }
	}
};

function song_ended() {
  $("#duration").html("0:00");
  $("#timer").html("0:00");
  $("#audio_progress").width("0%");
  $("#song_now_playing").fadeOut(100);
  $("#play_button").removeClass("disabled");
  $("#stop_button").addClass("disabled");
}

function playSongFromId(song_id){
  console.log('Playing song from song ID ' + song_id);

  if (song_id) {
    if (sound) {
      sound.stop();
    }
    var stmt = db.prepare("SELECT * from mrvoice WHERE id = ?");
    var row = stmt.get(song_id);
    var filename = row.filename;
    console.log("Inside get, Filename is " + filename);
    sound = new Howl({
      src: [path.join(preferences.locations.music_directory, filename)],
      html5: true,
      onplay: function() {
        var time = Math.round(sound.duration());
        globalAnimation = requestAnimationFrame(howlerUtils.updateTimeTracker.bind(this));
        var title = row.title || "";
        var artist = row.artist || "";
        artist = artist.length ? "by " + artist : artist;
        $("#song_now_playing").html(`${title} ${artist}`).fadeIn(100);
        $("#play_button").addClass("disabled");
        $("#stop_button").removeClass("disabled");
      },
      onend: function() {
        song_ended();
        autoplay_next();
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
    } else {
      next_song = $(".holding_tank.active li").first();
    }
    if (next_song.length) {
      playSongFromId(next_song.attr("songid"));
      next_song.addClass("now_playing");
    } else {
      $("li.now_playing").first().removeClass("now_playing");
    }
  }
}

function playSelected(){
  var song_id = $('#selected_row').attr('songid');
  console.log('Got song ID ' + song_id);
  playSongFromId(song_id);
}

function stopPlaying(fadeOut = false){
  if (sound) {
    sound.on('fade', function(){
      sound.stop();
    });
    if (autoplay) {
      $(".now_playing").first().removeClass("now_playing");
    }
    if (fadeOut) {
      sound.fade(1,0,1000);
    } else {
      sound.stop();
    }
  }
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

function sendToHotkeys() {
  target = $(".hotkeys.active li").not("[songid]").first();
  song_id = $("#selected_row").attr("songid");
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
    $("#autoplay_button").toggleClass("fa-stop fa-play-circle");
    $("#holding_tank").toggleClass("autoplaying");
    $(".now_playing").first().toggleClass("now_playing");
    if (autoplay) {
      $("#holding_tank_label").html("Auto Play");
    } else {
      $("#holding_tank_label").html("Holding Tank");
    }

}

function deleteSong() {
  if ($("#selected_row").is('span')) {
    $("#selected_row").parent().removeAttr('songid');
    $("#selected_row").empty();
    $("#selected_row").removeAttr('id');
  } else {
    $("#selected_row").remove();
  }
  return false;
}

function scale_scrollable() {
  $(".table-wrapper-scroll-y").height($(window).height() - 240 + "px");
}

function switchToHotkeyTab(tab) {
  $(`#hotkey_tabs li:nth-child(${tab}) a`).tab('show');
}

function renameHotkeyTab() {

  prompt({
    title: "Rename Hotkey Tab",
    label: "Rename this tab:",
    value: $("#hotkey_tabs .nav-link.active").text(),
    type: "input",
    alwaysOnTop: true,
  })
    .then((r) => {
      if (r === null) {
        console.log("user canceled");
      } else {
        $("#hotkey_tabs .nav-link.active").text(r);
      }
    })
    .catch(console.error);
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
  var duration = $('#song-form-duration').val();
  var uuid = uuidv4();
  var newFilename = `${artist}-${title}-${uuid}${pathData.ext}`.replace(/\s/g, "");
  var newPath = path.join(preferences.locations.music_directory, newFilename );

  const stmt = db.prepare("INSERT INTO mrvoice (title, artist, category, info, filename, time) VALUES (?, ?, ?, ?, ?, ?)");
  stmt.run(title, artist, category, info, newFilename, duration);
  fs.copyFileSync(filename, newPath);

  // Song has been saved, now let's show item
  $("#omni_search").val(title);
  searchData();
}

function renameHoldingTankTab() {
  prompt({
    title: "Rename Holding Tank Tab",
    label: "Rename this tab:",
    value: $("#holding_tank_tabs .nav-link.active").text(),
    type: "input",
    alwaysOnTop: true,
  })
    .then((r) => {
      if (r === null) {
        console.log("user canceled");
      } else {
        $("#holding_tank_tabs .nav-link.active").text(r);
      }
    })
    .catch(console.error);
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
        fs.unlinkSync(path.join(preferences.locations.music_directory, filename));
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

function toggle_selected_row(row) {
  // if ($(row).attr('id') == "selected_row") {
  //   $(row).removeAttr("id");
  // } else {
    $("#selected_row").removeAttr('id');
    $(row).attr("id", "selected_row");
  // }
}

$( document ).ready(function() {

  populateCategorySelect();

  $("#search_results").on("click", "tbody tr", function (event) {
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
    playSelected();
  });

  $(".hotkeys li").on("drop", function (event) {
    $(this).removeClass("drop_target");
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
    searchData();
    $("#omni_search").focus();
  });

  $("#holding_tank").on("drop", function (event) {
    holdingTankDrop(event.originalEvent);
    $(event.originalEvent.target).removeClass("dropzone");
  });

  $("#holding_tank").on("dragover", function (event) {
    allowHotkeyDrop(event.originalEvent);
    $(event.originalEvent.target).addClass("dropzone");
  });

  $("#holding_tank").on("dragleave", function (event) {
    allowHotkeyDrop(event.originalEvent);
    $(event.originalEvent.target).removeClass("dropzone");
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
    $("#omni_search").val("");
    $("#category_select").prop("selectedIndex", 0);
    $("#omni_search").focus();
    $("#search_results tbody").find("tr").remove();
    $("#search_results thead").hide();
    return false;
  });

  $("#stop_button").click(function (e) {
    if (e.shiftKey) {
      stopPlaying(true);
    } else {
      stopPlaying();
    }
  });

  $("#search_results thead").hide();

  $('#songFormModal').on('hidden.bs.modal', function (e) {
    $('#song-form-category').val('');
    $('#song-form-title').val('');
    $('#song-form-artist').val('');
    $('#song-form-info').val('');
    $('#song-form-duration').val('');
  })

    $("#songFormModal").on("shown.bs.modal", function (e) {
      console.log($("#song-form-title").val().length);
      if (!$("#song-form-title").val().length) {
        $("#song-form-title").focus();
      } else {
        $("#song-form-info").focus();
      }
    });

});
