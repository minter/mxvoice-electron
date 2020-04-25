var db = new sqlite3.Database(path.join(preferences.locations.database_directory, 'mrvoice.db'));
var sound;
var categories = [];

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
    console.log(`Setting ${key} to ${fkeys[key]}`);
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
        $("#search_results").append(`<tr draggable='true' ondragstart='songDrag(event)' class='song unselectable' songid='${row.id}'><td>${categories[row.category]}</td><td>${row.info}</td><td>${row.title}</td><td>${row.artist}</td><td>${row.time}</td></tr>`);

    });
  });
}

function setLabelFromSongId(song_id, element) {
  console.log(`Looking up song information for ${song_id}`);
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
        src: [path.join(preferences.locations.music_directory, filename)]
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
  sound.stop();
}

function hotkeyDrop(event) {
  event.preventDefault();
  var song_id = event.dataTransfer.getData("text");
  var target = $(event.target).is("span") ? $(event.target).parent() : $(event.target);
  target.attr('songid', song_id);
  setLabelFromSongId(song_id,target);
}

function allowHotkeyDrop(event) {
  event.preventDefault();
}

function songDrag(event) {
  console.log('Starting drag for ID ' + event.target.getAttribute('songid'));
  event.dataTransfer.setData("text", event.target.getAttribute('songid'));
}
