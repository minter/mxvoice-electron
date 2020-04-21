var db = new sqlite3.Database(path.join(homedir, 'mrvoice.db'));
var sound;

function searchData(){
  db.serialize(function() {
    var value = document.getElementById('omni_search').value
    console.log('Called with value ' + value);
    $('#search_results tbody').find("tr").remove();
    var search_term = '%' + value + '%';
    db.each("SELECT * from mrvoice WHERE info LIKE ? OR title LIKE ? OR artist like ?", [search_term, search_term, search_term], function(err, row) {
    if (err) {
      throw err;
    }
        console.log('Found ' + row.title + ' by ' + row.artist);
        $('#search_results').append("<tr songid='" + row.id + "'><td>" + row.title + "</td><td>" + row.artist + "</td></tr>");
    });
  });
}

function playSelected(){
  //$('#selected_row').attr('songid');
  //$('#selected_row').removeAttr('id');

  // $('#myTable').on('click', '.clickable-row', function(event) {
  //   if($(this).hasClass('active')){
  //     $(this).removeClass('active');
  //   } else {
  //     $(this).addClass('active').siblings().removeClass('active');
  //   }
  // });
  var song_id = $('#selected_row').attr('songid');
  // var filename;
  console.log('Got song ID ' + song_id);

  if (song_id) {
    db.get("SELECT * from mrvoice WHERE id = ?", [song_id], function(err, row) {
      var filename = row.filename;
      console.log("Inside get, Filename is " + filename);
      sound = new Howl({
        src: [path.join(homedir, 'mp3', filename)]
      });
      sound.play();
    });
  }
}

function stopSelected(){
  sound.stop();
}
