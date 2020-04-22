var db = new sqlite3.Database(path.join(preferences.locations.database_directory, 'mrvoice.db'));
var sound;

function populateCategorySelect(){
  console.log("Populating categories");
  db.each("SELECT * FROM categories ORDER BY description ASC", [], function(err, row) {
  if (err) {
    throw err;
  }
    $('#category_select').append(`<option value="${row.code}">${row.description}</option>`);
    console.log('Found ' + row.code + ' as ' + row.description);
  });

}

function searchData(){
  db.serialize(function() {
    var category = $( "#category_select" ).val();
    console.log('Using category ' + category);
    var value = document.getElementById('omni_search').value.trim();
    console.log('Called with value ' + value);
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
        console.log('Found ' + row.title + ' by ' + row.artist);
        var rowNode = t.row
          .add([
            row.category,
            row.info,
            row.title,
            row.artist,
            row.time,
          ])
          .draw()
          .node();
        $(rowNode).addClass('song unselectable').attr("songid",row.id);
    });
  });
}

function playSelected(){
  var song_id = $('#selected_row').attr('songid');
  console.log('Got song ID ' + song_id);

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

function stopSelected(){
  sound.stop();
}
