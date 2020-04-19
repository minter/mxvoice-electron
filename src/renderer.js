var db = new sqlite3.Database('/Users/minter/mrvoice.db');

function searchData(){
  db.serialize(function() {
    db.each("SELECT code AS id, description AS info FROM categories", function(err, row) {
        console.log(row.id + ": " + row.info);
    });
  });

  var value = document.getElementById("omni_search").value;
  // var value = $('#omni_search').value;
  console.log('Called with value ' + value);
}
