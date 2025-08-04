/**
 * Search Engine Module
 * 
 * Handles the main search functionality for the MxVoice application.
 * This module contains the core search logic that queries the database
 * and displays results.
 */

/**
 * Perform a search on the database
 * This is the main search function that handles both basic and advanced search
 */
function searchData() {
  $("#search_results tbody").find("tr").remove();
  $("#search_results thead").show();

  var raw_html = [];
  var query_params = [];
  var query_segments = [];
  var query_string = "";
  var category = $("#category_select").val();

  if (category != "*") {
    query_segments.push("category = ?");
    query_params.push(category);
  }

  if ($("#advanced-search").is(":visible")) {
    var title = $("#title-search").val().trim();
    var artist = $("#artist-search").val().trim();
    var info = $("#info-search").val().trim();
    var since = $("#date-search").val();
    if (title.length) {
      query_segments.push("title LIKE ?");
      query_params.push(`%${title}%`);
    }
    if (artist.length) {
      query_segments.push("artist LIKE ?");
      query_params.push(`%${artist}%`);
    }
    if (info.length) {
      query_segments.push("info LIKE ?");
      query_params.push(`%${info}%`);
    }
    if (since.length) {
      query_segments.push("modtime > ?");
      var today = new Date();
      query_params.push(
        Math.round(today.setDate(today.getDate() - since) / 1000)
      );
    }
    if (query_segments.length != 0) {
      query_string = " WHERE " + query_segments.join(" AND ");
    }
  } else {
    var omni = $("#omni_search").val().trim();
    var search_term = "%" + omni + "%";
    if (omni != "") {
      query_segments.push("(info LIKE ? OR title LIKE ? OR artist like ?)");
      query_params.push(search_term, search_term, search_term);
    }
    if (query_segments.length != 0) {
      query_string = " WHERE " + query_segments.join(" AND ");
    }
  }

  console.log("Query string is" + query_string);

  // Use new database API for search query
  if (window.electronAPI && window.electronAPI.database) {
    const sql = "SELECT * from mrvoice" + query_string + " ORDER BY category,info,title,artist";
    window.electronAPI.database.query(sql, query_params).then(result => {
      if (result.success) {
        result.data.forEach((row) => {
          raw_html.push(
            `<tr draggable='true' ondragstart='songDrag(event)' style='font-size: ${fontSize}px' class='song unselectable context-menu' songid='${
              row.id
            }'><td class='hide-1'>${
              categories[row.category]
            }</td><td class='hide-2'>${
              row.info || ""
            }</td><td style='font-weight: bold'>${
              row.title || ""
            }</td><td style='font-weight:bold'>${row.artist || ""}</td><td>${
              row.time
            }</td></tr>`
          );
        });
        $("#search_results").append(raw_html.join(""));
        scale_scrollable();
        $("#omni_search").select();
        $("#category_select").prop("selectedIndex", 0);
      } else {
        console.warn('❌ Failed to search songs:', result.error);
        // Fallback to legacy database access
        if (typeof db !== 'undefined') {
          var stmt = db.prepare(
            "SELECT * from mrvoice" +
              query_string +
              " ORDER BY category,info,title,artist"
          );
          const rows = stmt.all(query_params);
          rows.forEach((row) => {
            raw_html.push(
              `<tr draggable='true' ondragstart='songDrag(event)' style='font-size: ${fontSize}px' class='song unselectable context-menu' songid='${
                row.id
              }'><td class='hide-1'>${
                categories[row.category]
              }</td><td class='hide-2'>${
                row.info || ""
              }</td><td style='font-weight: bold'>${
                row.title || ""
              }</td><td style='font-weight:bold'>${row.artist || ""}</td><td>${
                row.time
              }</td></tr>`
            );
          });
          $("#search_results").append(raw_html.join(""));
          scale_scrollable();
          $("#omni_search").select();
          $("#category_select").prop("selectedIndex", 0);
        }
      }
    }).catch(error => {
      console.warn('❌ Database API error:', error);
      // Fallback to legacy database access
      if (typeof db !== 'undefined') {
        var stmt = db.prepare(
          "SELECT * from mrvoice" +
            query_string +
            " ORDER BY category,info,title,artist"
        );
        const rows = stmt.all(query_params);
        rows.forEach((row) => {
          raw_html.push(
            `<tr draggable='true' ondragstart='songDrag(event)' style='font-size: ${fontSize}px' class='song unselectable context-menu' songid='${
              row.id
            }'><td class='hide-1'>${
              categories[row.category]
            }</td><td class='hide-2'>${
              row.info || ""
            }</td><td style='font-weight: bold'>${
              row.title || ""
            }</td><td style='font-weight:bold'>${row.artist || ""}</td><td>${
              row.time
            }</td></tr>`
          );
        });
        $("#search_results").append(raw_html.join(""));
        scale_scrollable();
        $("#omni_search").select();
        $("#category_select").prop("selectedIndex", 0);
      }
    });
  } else {
    // Fallback to legacy database access
    if (typeof db !== 'undefined') {
      var stmt = db.prepare(
        "SELECT * from mrvoice" +
          query_string +
          " ORDER BY category,info,title,artist"
      );
      const rows = stmt.all(query_params);
      rows.forEach((row) => {
        raw_html.push(
          `<tr draggable='true' ondragstart='songDrag(event)' style='font-size: ${fontSize}px' class='song unselectable context-menu' songid='${
            row.id
          }'><td class='hide-1'>${
            categories[row.category]
          }</td><td class='hide-2'>${
            row.info || ""
          }</td><td style='font-weight: bold'>${
            row.title || ""
          }</td><td style='font-weight:bold'>${row.artist || ""}</td><td>${
            row.time
          }</td></tr>`
        );
      });
      $("#search_results").append(raw_html.join(""));
      scale_scrollable();
      $("#omni_search").select();
      $("#category_select").prop("selectedIndex", 0);
    }
  }
}

module.exports = {
  searchData
}; 