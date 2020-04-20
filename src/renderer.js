var db = new sqlite3.Database('/Users/minter/mrvoice.db');

function searchData(){
  db.serialize(function() {
    var value = document.getElementById('omni_search').value
    console.log('Called with value ' + value);
    var search_term = '%' + value + '%';
    db.each("SELECT * from mrvoice WHERE info LIKE ? OR title LIKE ? OR artist like ?", [search_term, search_term, search_term], function(err, row) {
    if (err) {
      throw err;
    }
        console.log('Found ' + row.title + ' by ' + row.artist);
        $('#search_results').append("<tr><td>" + row.title + "</td><td>" + row.artist + "</td></tr>");
    });
  });

  // var value = $('#omni_search').value;
  // console.log('Called with value ' + value);
}
