var db = new sqlite3.Database(path.join(preferences.locations.database_directory, 'mrvoice.db'));
var sound;
var categories = [];
var globalAnimation;
var autoplay = false;

// Set up fkeys
for(let i=1;i<=12;i++) {
  Mousetrap.bind(`f${i}`, function () {
    playSongFromHotkey(`f${i}`);
  });
}

function playSongFromHotkey(hotkey) {
  console.log ('Getting song ID from hotkey ' + hotkey);
  var song_id = $(`#${hotkey}_hotkey`).attr('songid');
  console.log (`Found song ID ${song_id}`);
  if (song_id) {
    console.log (`Preparing to play song ${song_id}`);
    playSongFromId(song_id);
     $(`#${hotkey}_hotkey`).fadeOut(100).fadeIn(100);
  }
}

function populateHotkeys(fkeys) {
  for (var key in fkeys) {
    if (fkeys[key]) {
      $(`#${key}_hotkey`).attr('songid', fkeys[key]);
      setLabelFromSongId(fkeys[key], $(`#${key}_hotkey`))
    }
    else {
      $(`#${key}_hotkey`).removeAttr('songid');
      $(`#${key}_hotkey span`).html('');
    }
  }
}

function populateHoldingTank(songIds) {
  $('#holding_tank ul').empty();
  songIds.forEach(songId => {
   addToHoldingTank(songId, $("#holding_tank"));
  });
  return false;
}


function clearHotkeys() {
  if (confirm('Are you sure you want clear your hotkeys?')) {
    for(let key=1;key<=12;key++) {
      $(`#f${key}_hotkey`).removeAttr('songid');
      $(`#f${key}_hotkey span`).html('');
    }
  }
}

function clearHoldingTank() {
  if (confirm('Are you sure you want clear your holding tank?')) {
    $('#holding_tank ul').empty();
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
  $('#holding_tank ul li').each(function() {
    holdingTankArray.push($(this).attr('songid'));
  })
  ipcRenderer.send('save-holding-tank-file', holdingTankArray);
}

function populateCategorySelect(){
  console.log("Populating categories");
  db.each("SELECT * FROM categories ORDER BY description ASC", [], function(err, row) {
  if (err) {
    throw err;
  }
    categories[row.code] = row.description;
    $('#category_select').append(`<option value="${row.code}">${row.description}</option>`);
    //console.log('Found ' + row.code + ' as ' + row.description);
  });

}

function searchData(){
  db.serialize(function() {
    var category = $( "#category_select" ).val();
    console.log('Using category ' + category);
    var value = document.getElementById('omni_search').value.trim();
    console.log('Called with search string ' + value);
    $('#search_results tbody').find("tr").remove();
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
    db.each("SELECT * from mrvoice" + query_string + ' ORDER BY category,info,title,artist', query_params, function(err, row) {
    if (err) {
      throw err;
    }
        //console.log('Found ' + row.title + ' by ' + row.artist);
        $("#search_results").append(`<tr draggable='true' ondragstart='songDrag(event)' class='song unselectable' songid='${row.id}'><td>${categories[row.category]}</td><td>${row.info || ''}</td><td style='font-weight: bold'>${row.title || ''}</td><td style='font-weight:bold'>${row.artist || ''}</td><td>${row.time}</td></tr>`);

    });
  });
}

function setLabelFromSongId(song_id, element) {
  db.get("SELECT * from mrvoice WHERE id = ?", [song_id], function(err, row) {
    if(err) {
      $(element).find('span').html('');
    } else {
      var title = row.title || '[Unknown Title]';
      var artist = row.artist || '[Unknown Artist]';
      var time = row.time || '[??:??]';
      $(element).find('span').html(`${title} by ${artist} (${time})`);
    }
  });
}

function addToHoldingTank(song_id, element) {
  db.get("SELECT * from mrvoice WHERE id = ?", [song_id], function (err, row) {
    if (err) {

    } else {
      var title = row.title || "[Unknown Title]";
      var artist = row.artist || "[Unknown Artist]";
      var time = row.time || "[??:??]";
      var song_row = `<li class='list-group-item' draggable='true' ondragstart='songDrag(event)' songid='${song_id}'>${title} by ${artist} (${time})</li>`;

      $(`#holding_tank ul li[songid=${song_id}]`).first().remove();

      if ($(element).is("li")) {
        $(element)
        .after(song_row);
      } else {
        $(element)
        .find("ul")
        .append(song_row);
      }
    }
  });
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
    db.get("SELECT * from mrvoice WHERE id = ?", [song_id], function(err, row) {
      var filename = row.filename;
      console.log("Inside get, Filename is " + filename);
      sound = new Howl({
        src: [path.join(preferences.locations.music_directory, filename)],
        html5: true,
        onplay: function() {
          var time = Math.round(sound.duration());
          globalAnimation = requestAnimationFrame(howlerUtils.updateTimeTracker.bind(this));
          $("#song_now_playing").html(`${row.title} by ${row.artist}`).fadeIn(100);
          $("#play_button").addClass("disabled");
          $("#stop_button").removeClass("disabled");
        },
        onend: function() {
          song_ended();
          if (autoplay) {
            song_node = $("#holding_tank ul li").first();
            if (song_node) {
              playSongFromId(song_node.attr("songid"));
              song = song_node.detach();
              $("#holding_tank ul").append(song);
            }
          }
        },
        onstop: function() {
          console.log('Stopped!');
          song_ended();
        }
      });

      sound.play();

    });
  }
}

function playSelected(){
  var song_id = $('#selected_row').attr('songid');
  console.log('Got song ID ' + song_id);
  playSongFromId(song_id);
}

function stopPlaying(){
  if (sound) {
    sound.stop();
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
  target = $("#hotkeys_list li").not("[songid]").first();
  song_id = $("#selected_row").attr("songid");
  if (target && song_id) {
    target.attr('songid',song_id);
    setLabelFromSongId(song_id,target);
  }
  return false;
}

function sendToHoldingTank() {
  target = $("#holding_tank");
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
    $("#autoplay_button").toggleClass("fa-stop fa-play-circle");
    autoplay = !autoplay;
}
