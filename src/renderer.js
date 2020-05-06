var sound;
var categories = [];
var globalAnimation;
var autoplay = false;
var loop = false;
var sound_canceled = false;

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

function populateHotkeys(fkeys, title) {
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
  $("#play_button").removeClass("d-none");
  $("#pause_button").addClass("d-none");
  if (!$("#selected_row").length) {
    $("#play_button").attr("disabled", true);
  }
  $("#stop_button").attr("disabled", true);
  sound_canceled = true;
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
      volume: $('#volume').val()/100,
      onplay: function() {
        sound_canceled = false;
        var time = Math.round(sound.duration());
        globalAnimation = requestAnimationFrame(howlerUtils.updateTimeTracker.bind(this));
        var title = row.title || "";
        var artist = row.artist || "";
        artist = artist.length ? "by " + artist : artist;
        $("#song_now_playing")
          .html(
            `<i id="song_spinner" title="CD" class="fas fa-sm fa-spin fa-compact-disc"></i> ${title} ${artist}`
          )
          .fadeIn(100);
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
      var fadeDuration = ((preferences.audio.fade_out_seconds || 2) * 1000)
      console.log(`Value of fade duration is ${fadeDuration}`)
      sound.fade(sound.volume(),0,fadeDuration);
    } else {
      sound.stop();
    }
  }
}

function pausePlaying(fadeOut = false) {
  if (sound && !sound_canceled) {
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
        var fadeDuration = ((preferences.audio.fade_out_seconds || 2) * 1000)
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

  const stmt = db.prepare("INSERT INTO mrvoice (title, artist, category, info, filename, time, modtime) VALUES (?, ?, ?, ?, ?, ?, ?)");
  stmt.run(title, artist, category, info, newFilename, duration, Math.floor(Date.now() / 1000));
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

function showBulkAddModal(directory) {
  $('#bulk-add-path').val(directory)
  $('#bulk-add-category').empty();
  const stmt = db.prepare("SELECT * FROM categories ORDER BY description ASC");
  for (const row of stmt.iterate()) {
    categories[row.code] = row.description;
    $('#bulk-add-category').append(`<option value="${row.code}">${row.description}</option>`);
  }

  $('#bulkAddModal').modal();
}

function addSongsByPath(pathArray) {
  const songSourcePath = pathArray.shift();
  if (songSourcePath) {
    return mm.parseFile(songSourcePath).then(metadata => {
      var category = $('#bulk-add-category').val()

      var durationSeconds = metadata.format.duration.toFixed(0);
      var durationString = new Date(durationSeconds * 1000).toISOString().substr(14, 5);

      var title = metadata.common.title || path.parse(songSourcePath).name
      if (!title) { return }
      console.log(`Working with audio titled ${title}`)
      var artist = metadata.common.artist
      var uuid = uuidv4();
      var newFilename = `${artist}-${title}-${uuid}${path.extname(songSourcePath)}`.replace(/\s/g, "");
      var newPath = path.join(preferences.locations.music_directory, newFilename );
      const stmt = db.prepare("INSERT INTO mrvoice (title, artist, category, filename, time, modtime) VALUES (?, ?, ?, ?, ?, ?)");
      const info = stmt.run(title, artist, category, newFilename, durationString, Math.floor(Date.now() / 1000));
      console.log(`Copying audio file ${songSourcePath} to ${newPath}`)
      fs.copyFileSync(songSourcePath, newPath);
      $("#search_results").append(`<tr draggable='true' ondragstart='songDrag(event)' class='song unselectable' songid='${info.lastInsertRowid}'><td>${categories[category]}</td><td></td><td style='font-weight: bold'>${title || ''}</td><td style='font-weight:bold'>${artist || ''}</td><td>${durationString}</td></tr>`);


      return addSongsByPath(pathArray); // process rest of the files AFTER we are finished
    })
  }
  return Promise.resolve();
}

function saveBulkUpload(event) {
  event.preventDefault();
  $('#bulkAddModal').modal('hide');
  var dirname = $('#bulk-add-path').val()
  var songs = []
  var files = fs.readdirSync(dirname);

  for (var i in files) {
    var filename = files[i]
    var fullPath = path.join(dirname, filename)
    var pathData = path.parse(filename);
    if (['.mp3', '.mp4', '.m4a', '.wav', '.ogg'].includes(pathData.ext.toLowerCase())) {
      songs.push(fullPath);
    }
  }

  $('#search_results tbody').find("tr").remove();
  $("#search_results thead").show();

  addSongsByPath(songs);

}

function populateCategoriesModal() {
  $('#categoryList').find('div.row').remove();

  const stmt = db.prepare("SELECT * FROM categories ORDER BY description ASC");
  for (const row of stmt.iterate()) {

    $("#categoryList").append(`<div class="form-group row">

                    <div class="col-sm-8">
                      <div catcode="${row.code}" class="category-description">${row.description}</div>
                      <input style="display: none;" type="text" class="form-control categoryDescription" catcode="${row.code}" id="categoryDescription-${row.code}" value="${row.description}" required>
                    </div>
                    <div class="col-sm-4">
                    <a href="#" onclick="editCategory('${row.code}')">Edit</a>&nbsp;
                    <a class="delete_link" href="#" onclick="deleteCategory(event,'${row.code}','${row.description}')">Delete</a>
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
  const info = stmt.run(code, description)
  if (info.changes == 1) {
    console.log(`Added new row into database`)
    $('#newCategoryCode').val('')
    $('#newCategoryDescription').val('')
    populateCategorySelect()
    populateCategoriesModal()
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

function sound_on_full(bool) {
  if (bool == true) {
    $('#full_button').addClass('btn-primary');
    $("#full_button").removeClass("btn-secondary");
  } else {
    $("#full_button").removeClass("btn-primary");
    $("#full_button").addClass("btn-secondary");
  }
}


function mute_on(bool) {
  if (bool == true) {
    $("#mute_button").addClass("btn-danger");
    $("#mute_button").removeClass("btn-secondary");
  } else {
    $("#mute_button").removeClass("btn-danger");
    $("#mute_button").addClass("btn-secondary");
  }
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
    if (sound) {
      if (!sound_canceled) {
        sound.play();
      } else {
        playSelected();
      }
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
      sound.play();
    }
  })

  $("#volume").on('change',function() {
    var volume = $(this).val()/100;
    if (sound) {
      sound.volume(volume);
    }
    if (volume == 1) {
      sound_on_full(true);
    } else {
      sound_on_full(false);
    }
    if (volume == 0) {
      mute_on(true);
    } else {
      mute_on(false);
    }
  });

  $('#mute_button').click(function() {
    $('#volume').val(0);
    if (sound) {
      sound.volume(0);
    }
    mute_on(true);
    sound_on_full(false);
  });

  $("#full_button").click(function () {
    $("#volume").val(100);
    if (sound) {
      sound.volume(1);
    }
    mute_on(false);
    sound_on_full(true);
  });

  $("#loop_button").click(function () {
    loop = !loop;
    loop_on(loop);
  });

  $('.modal').on('show.bs.modal', function() {
    $(".modal").modal("hide");
  })

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
