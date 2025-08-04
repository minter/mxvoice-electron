var sound;
var categories = [];
var globalAnimation;
var autoplay = false;
var loop = false;
var holdingTankMode = "storage"; // 'storage' or 'playlist'
var searchTimeout; // Global variable for live search debouncing
var wavesurfer = WaveSurfer.create({
  container: "#waveform",
  waveColor: "#e9ecef",
  backgroundColor: "#343a40",
  progressColor: "#007bff",
  cursorColor: "white",
  cursorWidth: 0,
  responsive: true,
  height: 100,
});
var fontSize = 11;

// Load the last holding tank and hotkeys

// Always clear the holding tank store to ensure we load the new HTML
window.electronAPI.store.has("holding_tank").then(hasHoldingTank => {
  if (hasHoldingTank) {
    window.electronAPI.store.delete("holding_tank").then(() => {
      console.log("Cleared holding tank store to load new HTML");
    });
  }
});

// Mode initialization will be handled by the mode management module
// The module will be initialized after all modules are loaded

// Load hotkeys
window.electronAPI.store.has("hotkeys").then(hasHotkeys => {
  if (hasHotkeys) {
    window.electronAPI.store.get("hotkeys").then(storedHotkeysHtml => {
      // Check if the stored HTML contains the old plain text header
      if (
        storedHotkeysHtml && typeof storedHotkeysHtml === 'string' &&
        storedHotkeysHtml.includes("Hotkeys") &&
        !storedHotkeysHtml.includes("header-button")
      ) {
        // This is the old HTML format, clear it so the new HTML loads
        window.electronAPI.store.delete("hotkeys").then(() => {
          console.log("Cleared old hotkeys HTML format");
        });
      } else if (storedHotkeysHtml && typeof storedHotkeysHtml === 'string') {
        $("#hotkeys-column").html(storedHotkeysHtml);
        $("#selected_row").removeAttr("id");
      }
    });
  }
});

// Load column order
window.electronAPI.store.has("column_order").then(hasColumnOrder => {
  if (hasColumnOrder) {
    window.electronAPI.store.get("column_order").then(columnOrder => {
      if (columnOrder && Array.isArray(columnOrder)) {
        columnOrder.forEach(function (val) {
          $("#top-row").append($("#top-row").children(`#${val}`).detach());
        });
      }
    });
  }
});

// Load font size
window.electronAPI.store.has("font-size").then(hasFontSize => {
  if (hasFontSize) {
    window.electronAPI.store.get("font-size").then(size => {
      if (size !== undefined && size !== null) {
        fontSize = size;
        $(".song").css("font-size", fontSize + "px");
      }
    });
  }
});

// Animate.css

const animateCSS = (element, animation, speed = "", prefix = "animate__") =>
  // We create a Promise and return it
  new Promise((resolve, reject) => {
    const animationName = `${prefix}${animation} ${speed}`;
    const node = element;

    node.addClass(`${prefix}animated ${animationName}`);

    // When the animation ends, we clean the classes and resolve the Promise
    function handleAnimationEnd() {
      node.removeClass(`${prefix}animated ${animationName}`);
      node.off("animationend", handleAnimationEnd);

      resolve("Animation ended");
    }

    node.on("animationend", handleAnimationEnd);
  });

function saveHoldingTankToStore() {
  // Only save if we have the new HTML format with mode toggle
  var currentHtml = $("#holding-tank-column").html();
  if (currentHtml.includes("mode-toggle")) {
    window.electronAPI.store.set("holding_tank", currentHtml);
  }
}

function saveHotkeysToStore() {
  // Only save if we have the new HTML format with header button
  var currentHtml = $("#hotkeys-column").html();
  if (currentHtml.includes("header-button")) {
    window.electronAPI.store.set("hotkeys", currentHtml);
  }
}

function playSongFromHotkey(hotkey) {
  console.log("Getting song ID from hotkey " + hotkey);
  var song_id = $(`.hotkeys.active #${hotkey}_hotkey`).attr("songid");
  console.log(`Found song ID ${song_id}`);
  if (song_id) {
    console.log(`Preparing to play song ${song_id}`);
    // Unhighlight any selected tracks in holding tank or playlist
    $(".now_playing").first().removeClass("now_playing");
    $("#selected_row").removeAttr("id");
    // Hotkey playback should not affect holding tank mode
    // Just play the song without changing autoplay state
    playSongFromId(song_id);
    animateCSS($(`.hotkeys.active #${hotkey}_hotkey`), "flipInX");
  }
}

function populateHotkeys(fkeys, title) {
  for (var key in fkeys) {
    if (fkeys[key]) {
      try {
        $(`.hotkeys.active #${key}_hotkey`).attr("songid", fkeys[key]);
        setLabelFromSongId(fkeys[key], $(`.hotkeys.active #${key}_hotkey`));
      } catch (err) {
        console.log(`Error loading fkey ${key} (DB ID: ${fkeys[key]})`);
      }
    } else {
      $(`.hotkeys.active #${key}_hotkey`).removeAttr("songid");
      $(`.hotkeys.active #${key}_hotkey span`).html("");
    }
  }
  if (title) {
    $("#hotkey_tabs li a.active").text(title);
  }
}

function populateHoldingTank(songIds) {
  $(".holding_tank.active").empty();
  songIds.forEach((songId) => {
    addToHoldingTank(songId, $(".holding_tank.active"));
  });
  scale_scrollable();
  return false;
}

function clearHotkeys() {
  customConfirm("Are you sure you want clear your hotkeys?", function () {
    for (let key = 1; key <= 12; key++) {
      $(`.hotkeys.active #f${key}_hotkey`).removeAttr("songid");
      $(`.hotkeys.active #f${key}_hotkey span`).html("");
    }
  });
}

function clearHoldingTank() {
  customConfirm("Are you sure you want clear your holding tank?", function () {
    $(".holding_tank.active").empty();
  });
}

// File Operations Module - Functions extracted to src/renderer/modules/file-operations/
// openHotkeyFile(), openHoldingTankFile(), saveHotkeyFile(), saveHoldingTankFile()
// pickDirectory(), installUpdate() - All moved to file-operations module

// Import file operations module and make functions globally available
import fileOperationsModule from './renderer/modules/file-operations/index.js';

// Make file operations functions globally available
window.openHotkeyFile = fileOperationsModule.openHotkeyFile;
window.openHoldingTankFile = fileOperationsModule.openHoldingTankFile;
window.saveHotkeyFile = fileOperationsModule.saveHotkeyFile;
window.saveHoldingTankFile = fileOperationsModule.saveHoldingTankFile;
window.pickDirectory = fileOperationsModule.pickDirectory;
window.installUpdate = fileOperationsModule.installUpdate;

// Import song management module and make functions globally available
import songManagementModule from './renderer/modules/song-management/index.js';

// Make song management functions globally available
window.saveEditedSong = songManagementModule.saveEditedSong;
window.saveNewSong = songManagementModule.saveNewSong;
window.editSelectedSong = songManagementModule.editSelectedSong;
window.deleteSelectedSong = songManagementModule.deleteSelectedSong;
window.deleteSong = songManagementModule.deleteSong;
window.removeFromHoldingTank = songManagementModule.removeFromHoldingTank;
window.removeFromHotkey = songManagementModule.removeFromHotkey;

// Import bulk operations module and make functions globally available
import bulkOperationsModule from './renderer/modules/bulk-operations/index.js';

// Make bulk operations functions globally available
window.showBulkAddModal = bulkOperationsModule.showBulkAddModal;
window.addSongsByPath = bulkOperationsModule.addSongsByPath;
window.saveBulkUpload = bulkOperationsModule.saveBulkUpload;

// Import drag and drop module and make functions globally available
import dragDropModule from './renderer/modules/drag-drop/index.js';

// Make drag and drop functions globally available
window.hotkeyDrop = dragDropModule.hotkeyDrop;
window.holdingTankDrop = dragDropModule.holdingTankDrop;
window.allowHotkeyDrop = dragDropModule.allowHotkeyDrop;
window.songDrag = dragDropModule.songDrag;
window.columnDrag = dragDropModule.columnDrag;

// Import navigation module and make functions globally available
import navigationModule from './renderer/modules/navigation/index.js';

// Make navigation functions globally available
window.sendToHotkeys = navigationModule.sendToHotkeys;
window.sendToHoldingTank = navigationModule.sendToHoldingTank;
window.selectNext = navigationModule.selectNext;
window.selectPrev = navigationModule.selectPrev;

// Import mode management module and make functions globally available
import modeManagementModule from './renderer/modules/mode-management/index.js';

// Make mode management functions globally available
window.setHoldingTankMode = modeManagementModule.setHoldingTankMode;
window.getHoldingTankMode = modeManagementModule.getHoldingTankMode;
window.toggleAutoPlay = modeManagementModule.toggleAutoPlay;
window.getAutoPlayState = modeManagementModule.getAutoPlayState;
window.resetToDefaultMode = modeManagementModule.resetToDefaultMode;

// Initialize mode management module
modeManagementModule.initModeManagement().then(result => {
  if (result.success) {
    console.log('✅ Mode management module initialized:', result.mode);
  } else {
    console.warn('❌ Failed to initialize mode management module:', result.error);
  }
}).catch(error => {
  console.error('❌ Mode management module initialization error:', error);
});

// Import test functions module and make functions globally available
import testUtilsModule from './renderer/modules/test-utils/index.js';

// Make test functions globally available
window.testPhase2Migrations = testUtilsModule.testPhase2Migrations;
window.testDatabaseAPI = testUtilsModule.testDatabaseAPI;
window.testFileSystemAPI = testUtilsModule.testFileSystemAPI;
window.testStoreAPI = testUtilsModule.testStoreAPI;
window.testAudioAPI = testUtilsModule.testAudioAPI;
window.testSecurityFeatures = testUtilsModule.testSecurityFeatures;
window.runAllTests = testUtilsModule.runAllTests;

function openPreferencesModal() {
  $("#preferencesModal").modal();
}

function populateCategorySelect() {
  console.log("Populating categories");
  $("#category_select option").remove();
  $("#category_select").append(`<option value="*">All Categories</option>`);
  
  // Use new database API for getting categories
  if (window.electronAPI && window.electronAPI.database) {
    window.electronAPI.database.getCategories().then(result => {
      if (result.success) {
        result.data.forEach(row => {
          categories[row.code] = row.description;
          $("#category_select").append(
            `<option value="${row.code}">${row.description}</option>`
          );
        });
      } else {
        console.warn('❌ Failed to get categories:', result.error);
        // Fallback to legacy database access
        if (typeof db !== 'undefined') {
          var stmt = db.prepare("SELECT * FROM categories ORDER BY description ASC");
          for (const row of stmt.iterate()) {
            categories[row.code] = row.description;
            $("#category_select").append(
              `<option value="${row.code}">${row.description}</option>`
            );
          }
        }
      }
    }).catch(error => {
      console.warn('❌ Database API error:', error);
      // Fallback to legacy database access
      if (typeof db !== 'undefined') {
        var stmt = db.prepare("SELECT * FROM categories ORDER BY description ASC");
        for (const row of stmt.iterate()) {
          categories[row.code] = row.description;
          $("#category_select").append(
            `<option value="${row.code}">${row.description}</option>`
          );
        }
      }
    });
  } else {
    // Fallback to legacy database access
    if (typeof db !== 'undefined') {
      var stmt = db.prepare("SELECT * FROM categories ORDER BY description ASC");
      for (const row of stmt.iterate()) {
        categories[row.code] = row.description;
        $("#category_select").append(
          `<option value="${row.code}">${row.description}</option>`
        );
      }
    }
  }
}

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

// Live search function for real-time results as user types
function performLiveSearch(searchTerm) {
  console.log("performLiveSearch called with:", searchTerm);

  // Check if we have either a search term or advanced search filters
  var hasSearchTerm = searchTerm && searchTerm.length >= 2;
  var hasAdvancedFilters = false;

  if ($("#advanced-search").is(":visible")) {
    var title = $("#title-search").val().trim();
    var artist = $("#artist-search").val().trim();
    var info = $("#info-search").val().trim();
    var since = $("#date-search").val();
    hasAdvancedFilters =
      title.length > 0 ||
      artist.length > 0 ||
      info.length > 0 ||
      since.length > 0;
  }

  if (!hasSearchTerm && !hasAdvancedFilters) {
    // Clear results if no search term and no advanced filters
    $("#search_results tbody").find("tr").remove();
    $("#search_results thead").hide();
    return;
  }

  $("#search_results tbody").find("tr").remove();
  $("#search_results thead").show();

  var raw_html = [];
  var query_params = [];
  var query_segments = [];
  var query_string = "";
  var category = $("#category_select").val();

  // Apply category filter if not "All Categories"
  if (category != "*") {
    query_segments.push("category = ?");
    query_params.push(category);
  }

  // Apply advanced search filters if advanced search is visible
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
  }

  // Add the live search term to the query (only if we have a search term)
  if (hasSearchTerm) {
    var search_term = "%" + searchTerm + "%";
    query_segments.push("(info LIKE ? OR title LIKE ? OR artist like ?)");
    query_params.push(search_term, search_term, search_term);
  }

  // Build the complete query string
  if (query_segments.length != 0) {
    query_string = " WHERE " + query_segments.join(" AND ");
  }

  console.log("Live search query:", query_string);
  console.log("Live search params:", query_params);

  // Fast, limited search for live results with filters applied
  var stmt = db.prepare(
    "SELECT * from mrvoice" +
      query_string +
      " ORDER BY category,info,title,artist LIMIT 50"
  );
  const rows = stmt.all(query_params);

  console.log("Live search results:", rows.length);

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

  // Show indicator if there are more results
  if (rows.length === 50) {
    $("#search_results").append(
      `<tr><td colspan="5" class="text-center text-muted"><small>Showing first 50 results. Press Enter for complete search.</small></td></tr>`
    );
  }

  scale_scrollable();
}

function setLabelFromSongId(song_id, element) {
  //console.log(element);
  // Use new database API for getting song by ID
  if (window.electronAPI && window.electronAPI.database) {
    window.electronAPI.database.query("SELECT * from mrvoice WHERE id = ?", [song_id]).then(result => {
      if (result.success && result.data.length > 0) {
        var row = result.data[0];
        var title = row.title || "[Unknown Title]";
        var artist = row.artist || "[Unknown Artist]";
        var time = row.time || "[??:??]";
        
        // Handle swapping
        var original_song_node = $(`.hotkeys.active li[songid=${song_id}]`).not(
          element
        );
        console.log(original_song_node);
        if (original_song_node.length) {
          var old_song = original_song_node.find("span").detach();
          var destination_song = $(element).find("span").detach();
          original_song_node.append(destination_song);
          if (destination_song.attr("songid")) {
            original_song_node.attr("songid", destination_song.attr("songid"));
          } else {
            original_song_node.removeAttr("songid");
          }

          $(element).append(old_song);
        } else {
          $(element).find("span").html(`${title} by ${artist} (${time})`);
          $(element).find("span").attr("songid", song_id);
        }
        saveHotkeysToStore();
      } else {
        console.warn('❌ Failed to get song by ID:', result.error);
        // Fallback to legacy database access
        if (typeof db !== 'undefined') {
          var stmt = db.prepare("SELECT * from mrvoice WHERE id = ?");
          var row = stmt.get(song_id);
          var title = row.title || "[Unknown Title]";
          var artist = row.artist || "[Unknown Artist]";
          var time = row.time || "[??:??]";

          // Handle swapping
          var original_song_node = $(`.hotkeys.active li[songid=${song_id}]`).not(
            element
          );
          console.log(original_song_node);
          if (original_song_node.length) {
            var old_song = original_song_node.find("span").detach();
            var destination_song = $(element).find("span").detach();
            original_song_node.append(destination_song);
            if (destination_song.attr("songid")) {
              original_song_node.attr("songid", destination_song.attr("songid"));
            } else {
              original_song_node.removeAttr("songid");
            }

            $(element).append(old_song);
          } else {
            $(element).find("span").html(`${title} by ${artist} (${time})`);
            $(element).find("span").attr("songid", song_id);
          }
          saveHotkeysToStore();
        }
      }
    }).catch(error => {
      console.warn('❌ Database API error:', error);
      // Fallback to legacy database access
      if (typeof db !== 'undefined') {
        var stmt = db.prepare("SELECT * from mrvoice WHERE id = ?");
        var row = stmt.get(song_id);
        var title = row.title || "[Unknown Title]";
        var artist = row.artist || "[Unknown Artist]";
        var time = row.time || "[??:??]";

        // Handle swapping
        var original_song_node = $(`.hotkeys.active li[songid=${song_id}]`).not(
          element
        );
        console.log(original_song_node);
        if (original_song_node.length) {
          var old_song = original_song_node.find("span").detach();
          var destination_song = $(element).find("span").detach();
          original_song_node.append(destination_song);
          if (destination_song.attr("songid")) {
            original_song_node.attr("songid", destination_song.attr("songid"));
          } else {
            original_song_node.removeAttr("songid");
          }

          $(element).append(old_song);
        } else {
          $(element).find("span").html(`${title} by ${artist} (${time})`);
          $(element).find("span").attr("songid", song_id);
        }
        saveHotkeysToStore();
      }
    });
  } else {
    // Fallback to legacy database access
    if (typeof db !== 'undefined') {
      var stmt = db.prepare("SELECT * from mrvoice WHERE id = ?");
      var row = stmt.get(song_id);
      var title = row.title || "[Unknown Title]";
      var artist = row.artist || "[Unknown Artist]";
      var time = row.time || "[??:??]";

      // Handle swapping
      var original_song_node = $(`.hotkeys.active li[songid=${song_id}]`).not(
        element
      );
      console.log(original_song_node);
      if (original_song_node.length) {
        var old_song = original_song_node.find("span").detach();
        var destination_song = $(element).find("span").detach();
        original_song_node.append(destination_song);
        if (destination_song.attr("songid")) {
          original_song_node.attr("songid", destination_song.attr("songid"));
        } else {
          original_song_node.removeAttr("songid");
        }

        $(element).append(old_song);
      } else {
        $(element).find("span").html(`${title} by ${artist} (${time})`);
        $(element).find("span").attr("songid", song_id);
      }
      saveHotkeysToStore();
    }
  }
}

function addToHoldingTank(song_id, element) {
  // Use new database API for getting song by ID
  if (window.electronAPI && window.electronAPI.database) {
    window.electronAPI.database.query("SELECT * from mrvoice WHERE id = ?", [song_id]).then(result => {
      if (result.success && result.data.length > 0) {
        var row = result.data[0];
        var title = row.title || "[Unknown Title]";
        var artist = row.artist || "[Unknown Artist]";
        var time = row.time || "[??:??]";

        var existing_song = $(
          `.holding_tank.active .list-group-item[songid=${song_id}]`
        );
        if (existing_song.length) {
          var song_row = existing_song.detach();
        } else {
          var song_row = document.createElement("li");
          song_row.style.fontSize = `${fontSize}px`;
          song_row.className = "song list-group-item context-menu";
          song_row.setAttribute("draggable", "true");
          song_row.setAttribute("ondragstart", "songDrag(event)");
          song_row.setAttribute("songid", song_id);
          song_row.textContent = `${title} by ${artist} (${time})`;
        }

        if ($(element).is("li")) {
          $(element).after(song_row);
        } else if ($(element).is("div")) {
          $(element).find("ul.active").append(song_row);
        } else {
          $(element).append(song_row);
        }
        saveHoldingTankToStore();
      } else {
        console.warn('❌ Failed to get song by ID:', result.error);
        // Fallback to legacy database access
        if (typeof db !== 'undefined') {
          var stmt = db.prepare("SELECT * from mrvoice WHERE id = ?");
          var row = stmt.get(song_id);
          var title = row.title || "[Unknown Title]";
          var artist = row.artist || "[Unknown Artist]";
          var time = row.time || "[??:??]";

          var existing_song = $(
            `.holding_tank.active .list-group-item[songid=${song_id}]`
          );
          if (existing_song.length) {
            var song_row = existing_song.detach();
          } else {
            var song_row = document.createElement("li");
            song_row.style.fontSize = `${fontSize}px`;
            song_row.className = "song list-group-item context-menu";
            song_row.setAttribute("draggable", "true");
            song_row.setAttribute("ondragstart", "songDrag(event)");
            song_row.setAttribute("songid", song_id);
            song_row.textContent = `${title} by ${artist} (${time})`;
          }

          if ($(element).is("li")) {
            $(element).after(song_row);
          } else if ($(element).is("div")) {
            $(element).find("ul.active").append(song_row);
          } else {
            $(element).append(song_row);
          }
          saveHoldingTankToStore();
        }
      }
    }).catch(error => {
      console.warn('❌ Database API error:', error);
      // Fallback to legacy database access
      if (typeof db !== 'undefined') {
        var stmt = db.prepare("SELECT * from mrvoice WHERE id = ?");
        var row = stmt.get(song_id);
        var title = row.title || "[Unknown Title]";
        var artist = row.artist || "[Unknown Artist]";
        var time = row.time || "[??:??]";

        var existing_song = $(
          `.holding_tank.active .list-group-item[songid=${song_id}]`
        );
        if (existing_song.length) {
          var song_row = existing_song.detach();
        } else {
          var song_row = document.createElement("li");
          song_row.style.fontSize = `${fontSize}px`;
          song_row.className = "song list-group-item context-menu";
          song_row.setAttribute("draggable", "true");
          song_row.setAttribute("ondragstart", "songDrag(event)");
          song_row.setAttribute("songid", song_id);
          song_row.textContent = `${title} by ${artist} (${time})`;
        }

        if ($(element).is("li")) {
          $(element).after(song_row);
        } else if ($(element).is("div")) {
          $(element).find("ul.active").append(song_row);
        } else {
          $(element).append(song_row);
        }
        saveHoldingTankToStore();
      }
    });
  } else {
    // Fallback to legacy database access
    if (typeof db !== 'undefined') {
      var stmt = db.prepare("SELECT * from mrvoice WHERE id = ?");
      var row = stmt.get(song_id);
      var title = row.title || "[Unknown Title]";
      var artist = row.artist || "[Unknown Artist]";
      var time = row.time || "[??:??]";

      var existing_song = $(
        `.holding_tank.active .list-group-item[songid=${song_id}]`
      );
      if (existing_song.length) {
        var song_row = existing_song.detach();
      } else {
        var song_row = document.createElement("li");
        song_row.style.fontSize = `${fontSize}px`;
        song_row.className = "song list-group-item context-menu";
        song_row.setAttribute("draggable", "true");
        song_row.setAttribute("ondragstart", "songDrag(event)");
        song_row.setAttribute("songid", song_id);
        song_row.textContent = `${title} by ${artist} (${time})`;
      }

      if ($(element).is("li")) {
        $(element).after(song_row);
      } else if ($(element).is("div")) {
        $(element).find("ul.active").append(song_row);
      } else {
        $(element).append(song_row);
      }
      saveHoldingTankToStore();
    }
  }
}

var howlerUtils = {
  formatTime: function (secs) {
    var minutes = Math.floor(secs / 60) || 0;
    var seconds = secs - minutes * 60 || 0;
    return minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
  },
  isLoaded: function (s) {
    return s.state() == "loaded";
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
    globalAnimation = requestAnimationFrame(
      howlerUtils.updateTimeTracker.bind(self)
    );
  },
};

function song_ended() {
  resetUIState();
}

function playSongFromId(song_id) {
  console.log("Playing song from song ID " + song_id);
  if (song_id) {
    if (sound) {
      sound.off("fade");
      sound.unload();
    }
    
    var stmt = db.prepare("SELECT * from mrvoice WHERE id = ?");
    var row = stmt.get(song_id);
    
    if (!row) {
      console.error('❌ No song found with ID:', song_id);
      return;
    }
    
    var filename = row.filename;
    
    if (!filename) {
      console.error('❌ No filename found for song ID:', song_id, 'Row data:', row);
      return;
    }
    // Get music directory from store
    window.electronAPI.store.get("music_directory").then(musicDirectory => {
      console.log('🔍 Debug: musicDirectory response:', musicDirectory);
      if (musicDirectory.success) {
        console.log('🔍 Debug: musicDirectory.value:', musicDirectory.value);
        if (!musicDirectory.value) {
          console.warn('❌ musicDirectory.value is undefined or empty, using default path');
          // Use default path as fallback
          const defaultPath = path.join(process.env.APPDATA || process.env.HOME || '', '.config', 'mxvoice', 'mp3');
          window.electronAPI.path.join(defaultPath, filename).then(result => {
            if (result.success) {
              var sound_path = [result.data];
              console.log("Inside get, Filename is " + filename);
              sound = new Howl({
                src: sound_path,
                html5: true,
                volume: $("#volume").val() / 100,
                mute: $("#mute_button").hasClass("active"),
                onplay: function () {
                  var time = Math.round(sound.duration());
                  globalAnimation = requestAnimationFrame(
                    howlerUtils.updateTimeTracker.bind(this)
                  );
                  var title = row.title || "";
                  var artist = row.artist || "";
                  artist = artist.length ? "by " + artist : artist;
                  wavesurfer.load(sound_path);
                  $("#song_now_playing")
                    .html(
                      `<i id="song_spinner" class="fas fa-volume-up"></i> ${title} ${artist}`
                    )
                    .fadeIn(100)
                    .attr("songid", song_id);
                  $("#play_button").addClass("d-none");
                  $("#pause_button").removeClass("d-none");
                  $("#stop_button").removeAttr("disabled");
                },
              onend: function () {
                song_ended();
                if (loop) {
                  // If loop mode is enabled, restart the current song
                  playSongFromId(song_id);
                } else if (autoplay && holdingTankMode === "playlist") {
                  autoplay_next();
                }
              },
              });
              sound.play();
            } else {
              console.warn('❌ Failed to join path with default:', result.error);
            }
          }).catch(error => {
            console.warn('❌ Path join error with default:', error);
          });
          return;
        }
        window.electronAPI.path.join(musicDirectory.value, filename).then(result => {

          if (result.success) {
            if (!result.data) {
              console.warn('❌ result.data is undefined or empty');
              return;
            }
            var sound_path = [result.data];
            console.log("Inside get, Filename is " + filename);
            sound = new Howl({
              src: sound_path,
              html5: true,
              volume: $("#volume").val() / 100,
              mute: $("#mute_button").hasClass("active"),
              onplay: function () {
                var time = Math.round(sound.duration());
                globalAnimation = requestAnimationFrame(
                  howlerUtils.updateTimeTracker.bind(this)
                );
                var title = row.title || "";
                var artist = row.artist || "";
                artist = artist.length ? "by " + artist : artist;
                wavesurfer.load(sound_path);
                $("#song_now_playing")
                  .html(
                    `<i id="song_spinner" class="fas fa-volume-up"></i> ${title} ${artist}`
                  )
                  .fadeIn(100)
                  .attr("songid", song_id);
                $("#play_button").addClass("d-none");
                $("#pause_button").removeClass("d-none");
                $("#stop_button").removeAttr("disabled");
              },
              onend: function () {
                song_ended();
                if (loop) {
                  // If loop mode is enabled, restart the current song
                  playSongFromId(song_id);
                } else if (autoplay && holdingTankMode === "playlist") {
                  autoplay_next();
                }
              },
            });
            sound.play();
          } else {
            console.warn('❌ Failed to join path:', result.error);
          }
        }).catch(error => {
          console.warn('❌ Path join error:', error);
        });
      } else {
        console.warn('❌ Could not get music directory from store');
      }
    }).catch(error => {
      console.warn('❌ Store get API error:', error);
    });
  }
}

function autoplay_next() {
  if (autoplay && holdingTankMode === "playlist") {
    var now_playing = $(".now_playing").first();
    if (now_playing.length) {
      now_playing.removeClass("now_playing");
      next_song = now_playing.next();
      next_song.addClass("now_playing");
    }
    if (next_song.length) {
      // Clear any existing highlighting and highlight the new playing track
      $("#selected_row").removeAttr("id");
      next_song.attr("id", "selected_row");
      playSongFromId(next_song.attr("songid"));
      next_song.addClass("now_playing");
    } else {
      // End of playlist - just remove the now_playing class and stay in playlist mode
      $("li.now_playing").first().removeClass("now_playing");
      // Clear any highlighting at the end of playlist
      $("#selected_row").removeAttr("id");
      // Don't switch modes - stay in playlist mode
    }
  }
}

function cancel_autoplay() {
  if (!$("#holding-tank-column").has($("#selected_row")).length) {
    // Only cancel autoplay if we're not in the holding tank
    if (holdingTankMode === "playlist") {
      autoplay = false;
      setHoldingTankMode("storage");
    }
  }
}

function playSelected() {
  var song_id = $("#selected_row").attr("songid");
  console.log("Got song ID " + song_id);

  // Only clear the now_playing class if the selected row is from the search panel
  // (not from the holding tank/playlist)
  if (!$("#holding-tank-column").has($("#selected_row")).length) {
    $(".now_playing").removeClass("now_playing");
  }

  if (holdingTankMode === "storage") {
    // In storage mode, cancel autoplay and play just this song
    cancel_autoplay();
  }
  // In playlist mode, autoplay is already set up by the double-click handler

  playSongFromId(song_id);
}

function stopPlaying(fadeOut = false) {
  if (sound) {
    if (autoplay && holdingTankMode === "playlist") {
      $(".now_playing").first().removeClass("now_playing");
    }
    if (fadeOut) {
      console.log("Starting fade out...");
      window.electronAPI.store.get("fade_out_seconds").then(fadeSeconds => {
        console.log("Fade out seconds:", fadeSeconds);
        
        // Extract the numeric value from the response
        var fadeSecondsValue = fadeSeconds.value || fadeSeconds;
        var fadeDuration = parseFloat(fadeSecondsValue) * 1000;
        console.log("Fade duration:", fadeDuration);
        
        // Check if sound is still valid
        if (!sound || !sound.volume) {
          console.log("Sound is no longer valid, stopping");
          return;
        }
        
        // Remove any existing fade listeners to avoid conflicts
        sound.off("fade");
        
        // Set up fade completion handler
        sound.on("fade", function () {
          console.log("Fade event fired, unloading sound");
          if (sound) {
            sound.unload();
            resetUIState();
          }
        });
        
        // Start the fade
        var currentVolume = sound.volume();
        sound.fade(currentVolume, 0, fadeDuration);
        console.log("Fade started with volume:", currentVolume, "to 0 over", fadeDuration, "ms");
      }).catch(error => {
        console.error("Error getting fade_out_seconds:", error);
        // Fallback to immediate stop
        sound.unload();
        resetUIState();
      });
    } else {
      sound.unload();
      resetUIState();
    }
  }
}

function resetUIState() {
  $("#duration").html("0:00");
  $("#timer").html("0:00");
  $("#audio_progress").width("0%");
  $("#song_now_playing").fadeOut(100);
  $("#song_now_playing").removeAttr("songid");
  $("#play_button").removeClass("d-none");
  $("#pause_button").addClass("d-none");
  $("#song_spinner").removeClass("fa-spin");
  $("#progress_bar .progress-bar").removeClass(
    "progress-bar-animated progress-bar-striped"
  );
  if (!$("#selected_row").length) {
    $("#play_button").attr("disabled", true);
  }
  $("#stop_button").attr("disabled", true);
}

function pausePlaying(fadeOut = false) {
  if (sound) {
    toggle_play_button();
    if (sound.playing()) {
      sound.on("fade", function () {
        sound.pause();
        sound.volume(old_volume);
      });
      $("#song_spinner").removeClass("fa-spin");
      $("#progress_bar .progress-bar").removeClass(
        "progress-bar-animated progress-bar-striped"
      );
      if (fadeOut) {
        var old_volume = sound.volume();
        window.electronAPI.store.get("fade_out_seconds").then(fadeSeconds => {
          var fadeDuration = fadeSeconds * 1000;
          sound.fade(sound.volume(), 0, fadeDuration);
        });
      } else {
        sound.pause();
      }
    } else {
      sound.play();
      $("#song_spinner").addClass("fa-spin");
      $("#progress_bar .progress-bar").addClass(
        "progress-bar-animated progress-bar-striped"
      );
    }
  }
}

function toggle_play_button() {
  $("#play_button").toggleClass("d-none");
  $("#pause_button").toggleClass("d-none");
}





// Mode Management Module - Functions extracted to src/renderer/modules/mode-management/
// setHoldingTankMode(), toggleAutoPlay() - All moved to mode-management module

// Song Management Module - Functions extracted to src/renderer/modules/song-management/
// deleteSong(), removeFromHoldingTank(), removeFromHotkey() - All moved to song-management module

function scale_scrollable() {
  var advanced_search_height = $("#advanced-search").is(":visible") ? 38 : 0;
  if ($("#advanced-search").is(":visible")) {
    advanced_search_height = 38;
  }
  $(".table-wrapper-scroll-y").height(
    $(window).height() - 240 - advanced_search_height + "px"
  );
}

function switchToHotkeyTab(tab) {
  $(`#hotkey_tabs li:nth-child(${tab}) a`).tab("show");
}

function renameHotkeyTab() {
  const currentName = $("#hotkey_tabs .nav-link.active").text();
  customPrompt("Rename Hotkey Tab", "Enter a new name for this tab:", currentName, function(newName) {
    if (newName && newName.trim() !== "") {
      $("#hotkey_tabs .nav-link.active").text(newName);
      saveHotkeysToStore();
    }
  });
}

// Song Management Module - Functions extracted to src/renderer/modules/song-management/
// saveEditedSong(), saveNewSong() - All moved to song-management module

function savePreferences(event) {
  console.log("Saving preferences");
  event.preventDefault();
  $(`#preferencesModal`).modal("hide");
  window.electronAPI.store.set("database_directory", $("#preferences-database-directory").val());
  window.electronAPI.store.set("music_directory", $("#preferences-song-directory").val());
  window.electronAPI.store.set("hotkey_directory", $("#preferences-hotkey-directory").val());
  window.electronAPI.store.set("fade_out_seconds", $("#preferences-fadeout-seconds").val());
}

function renameHoldingTankTab() {
  const currentName = $("#holding_tank_tabs .nav-link.active").text();
  customPrompt("Rename Holding Tank Tab", "Enter a new name for this tab:", currentName, function(newName) {
    if (newName && newName.trim() !== "") {
      $("#holding_tank_tabs .nav-link.active").text(newName);
      saveHoldingTankToStore();
    }
  });
}

function increaseFontSize() {
  if (fontSize < 25) {
    $(".song").css("font-size", ++fontSize + "px");
    window.electronAPI.store.set("font-size", fontSize);
  }
}

function decreaseFontSize() {
  if (fontSize > 5) {
    $(".song").css("font-size", --fontSize + "px");
    window.electronAPI.store.set("font-size", fontSize);
  }
}

// Song Management Module - Functions extracted to src/renderer/modules/song-management/
// editSelectedSong(), deleteSelectedSong() - All moved to song-management module

// Song Management Module - Functions extracted to src/renderer/modules/song-management/
// showBulkAddModal(), addSongsByPath(), saveBulkUpload() - All moved to bulk-operations module

function populateCategoriesModal() {
  $("#categoryList").find("div.row").remove();

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
  populateCategoriesModal();

  $("#categoryManagementModal").modal();
}

function deleteCategory(event, code, description) {
  event.preventDefault();
  customConfirm(
    `Are you sure you want to delete "${description}" from Mx. Voice permanently? All songs in this category will be changed to the category "Uncategorized."`,
    function () {
      console.log(`Deleting category ${code}`);

      const uncategorizedCheckStmt = db.prepare(
        "INSERT OR REPLACE INTO categories VALUES(?, ?);"
      );
      const uncategorizedCheckInfo = uncategorizedCheckStmt.run(
        "UNC",
        "Uncategorized"
      );
      if (uncategorizedCheckInfo.changes == 1) {
        console.log(`Had to upsert Uncategorized table`);
      }
      const stmt = db.prepare(
        "UPDATE mrvoice SET category = ? WHERE category = ?"
      );
      const info = stmt.run("UNC", code);
      console.log(`Updated ${info.changes} rows to uncategorized`);

      const deleteStmt = db.prepare("DELETE FROM categories WHERE code = ?");
      const deleteInfo = deleteStmt.run(code);
      if (deleteInfo.changes == 1) {
        console.log(`Deleted category ${code}`);
      }
      populateCategorySelect();
      populateCategoriesModal();
    }
  );
}

function saveCategories(event) {
  event.preventDefault();
  $("#categoryList div.row").each(function () {
    var code = $(this).find(".categoryDescription").attr("catcode");
    console.log(`Checking code ${code}`);
    var description = $(this).find(".categoryDescription").val();
    const stmt = db.prepare(
      "UPDATE categories SET description = ? WHERE code = ? AND description != ?"
    );
    const info = stmt.run(description, code, description);
    if (info.changes == 1) {
      console.log(
        `Saving changes to ${code} - new description is ${description}`
      );
    }
    populateCategorySelect();
    populateCategoriesModal();
  });
}
function addNewCategory(event) {
  event.preventDefault();
  console.log(`Adding new category`);
  var description = $("#newCategoryDescription").val();
  var code = description.replace(/\s/g, "").substr(0, 4).toUpperCase();
  var codeCheckStmt = db.prepare("SELECT * FROM categories WHERE code = ?");
  var loopCount = 1;
  var newCode = code;
  while ((row = codeCheckStmt.get(newCode))) {
    console.log(`Found a code collision on ${code}`);
    var newCode = `${code}${loopCount}`;
    loopCount = loopCount + 1;
    console.log(`NewCode is ${newCode}`);
  }
  console.log(`Out of loop, setting code to ${newCode}`);
  code = newCode;
  console.log(`Adding ${code} :: ${description}`);
  const stmt = db.prepare("INSERT INTO categories VALUES (?, ?)");
  try {
    const info = stmt.run(code, description);
    if (info.changes == 1) {
      console.log(`Added new row into database`);
      $("#newCategoryCode").val("");
      $("#newCategoryDescription").val("");
      populateCategorySelect();
      populateCategoriesModal();
    }
  } catch (err) {
    if (err.message.match(/UNIQUE constraint/)) {
      $("#newCategoryDescription").val("");
      alert(
        `Couldn't add a category named "${description}" - apparently one already exists!`
      );
    }
  }
}

function toggle_selected_row(row) {
  // if ($(row).attr('id') == "selected_row") {
  //   $(row).removeAttr("id");
  // } else {
  $("#selected_row").removeAttr("id");
  $(row).attr("id", "selected_row");
  $("#play_button").removeAttr("disabled");
  // }
}

function loop_on(bool) {
  if (bool == true) {
    $("#loop_button").addClass("active");
  } else {
    $("#loop_button").removeClass("active");
  }
}

// pickDirectory() and installUpdate() functions moved to file-operations module

function toggleWaveform() {
  if ($("#waveform").hasClass("hidden")) {
    $("#waveform").removeClass("hidden");
    $("#waveform_button").addClass("active");
    animateCSS($("#waveform"), "fadeInUp").then(() => {});
  } else {
    $("#waveform_button").removeClass("active");
    animateCSS($("#waveform"), "fadeOutDown").then(() => {
      $("#waveform").addClass("hidden");
    });
  }
}

function toggleAdvancedSearch() {
  try {
    console.log("toggleAdvancedSearch called");

    // Clear any pending live search
    clearTimeout(searchTimeout);
    console.log("Cleared timeout");

    $("#search_form").trigger("reset");
    console.log("Triggered form reset");

    // Clear search results when toggling advanced search
    $("#search_results tbody").find("tr").remove();
    $("#search_results thead").hide();
    console.log("Cleared search results");

    console.log(
      "Advanced search element exists:",
      $("#advanced-search").length > 0
    );
    console.log(
      "Advanced search visible:",
      $("#advanced-search").is(":visible")
    );
    console.log(
      "Advanced search display:",
      $("#advanced-search").css("display")
    );

    if ($("#advanced-search").is(":visible")) {
      console.log("Hiding advanced search");
      $("#advanced-search-icon").toggleClass("fa-plus fa-minus");
      $("#title-search").hide();
      $("#omni_search").show();
      $("#omni_search").focus();
      animateCSS($("#advanced-search"), "fadeOutUp").then(() => {
        $("#advanced-search").hide();
        scale_scrollable();
      });
    } else {
      console.log("Showing advanced search");
      $("#advanced-search-icon").toggleClass("fa-plus fa-minus");
      $("#advanced-search").show();
      $("#title-search").show();
      $("#title-search").focus();
      $("#omni_search").hide();
      scale_scrollable();
      animateCSS($("#advanced-search"), "fadeInDown").then(() => {});
    }
  } catch (error) {
    console.error("Error in toggleAdvancedSearch:", error);
  }
}

function closeAllTabs() {
  customConfirm(`Are you sure you want to close all open Holding Tanks and Hotkeys?`, function() {
    // Use new store API for cleanup operations
    Promise.all([
      window.electronAPI.store.delete("holding_tank"),
      window.electronAPI.store.delete("hotkeys"),
      window.electronAPI.store.delete("column_order"),
      window.electronAPI.store.delete("font-size")
    ]).then(() => {
      console.log('✅ All tabs closed successfully');
      location.reload();
    }).catch(error => {
      console.warn('❌ Failed to close tabs:', error);
      // Fallback to legacy store access
      store.delete("holding_tank");
      store.delete("hotkeys");
      store.delete("column_order");
      store.delete("font-size");
      location.reload();
    });
  });
}

// Custom confirmation function to replace native confirm() dialogs
function customConfirm(message, callback) {
  $("#confirmationMessage").text(message);
  $("#confirmationModal").modal("show");

  // Store the callback to execute when confirmed
  $("#confirmationConfirmBtn")
    .off("click")
    .on("click", function () {
      $("#confirmationModal").modal("hide");
      if (callback) {
        callback();
      }
    });
}

// Custom prompt function to replace native prompt() dialogs
function customPrompt(title, message, defaultValue, callback) {
  $("#inputModalTitle").text(title);
  $("#inputModalMessage").text(message);
  $("#inputModalField").val(defaultValue);
  $("#inputModal").modal("show");
  
  // Focus on the input field
  $("#inputModalField").focus();
  
  // Handle Enter key
  $("#inputModalField").off("keypress").on("keypress", function(e) {
    if (e.which === 13) { // Enter key
      $("#inputModalConfirmBtn").click();
    }
  });
  
  $("#inputModalConfirmBtn").off("click").on("click", function () {
    const value = $("#inputModalField").val();
    $("#inputModal").modal("hide");
    if (callback) {
      callback(value);
    }
  });
}

// Focus restoration after modal dismissal
function restoreFocusToSearch() {
  // Small delay to ensure modal is fully closed
  setTimeout(function () {
    if ($("#omni_search").is(":visible")) {
      $("#omni_search").focus();
    } else if ($("#title-search").is(":visible")) {
      $("#title-search").focus();
    }
  }, 100);
}

$(document).ready(function () {
  scale_scrollable();

  populateCategorySelect();

  // Initialize bulk operations module
  bulkOperationsModule.initializeBulkOperations();

  // Initialize drag and drop module
  dragDropModule.initializeDragDrop();

  // Initialize navigation module
  navigationModule.initializeNavigation();

  // Initialize progress bar to 0% width
  $("#audio_progress").width("0%");

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

  for (let i = 1; i <= 12; i++) {
    Mousetrap.bind(`f${i}`, function () {
      playSongFromHotkey(`f${i}`);
    });

    Mousetrap(search_field).bind(`f${i}`, function () {
      playSongFromHotkey(`f${i}`);
    });
  }

  for (let i = 1; i <= 5; i++) {
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

  Mousetrap.bind("space", function () {
    pausePlaying();
    return false;
  });

  Mousetrap.bind("shift+space", function () {
    pausePlaying(true);
    return false;
  });

  Mousetrap.bind("return", function () {
    if (!$("#songFormModal").hasClass("show")) {
      playSelected();
    }
    return false;
  });

  Mousetrap.bind(["backspace", "del"], function () {
    console.log("Delete key pressed");
    console.log("selected_row:", $("#selected_row"));
    console.log("holding-tank-column has selected_row:", $("#holding-tank-column").has($("#selected_row")).length);
    console.log("hotkey-tab-content has selected_row:", $("#hotkey-tab-content").has($("#selected_row")).length);
    
    // Check if the selected row is in the holding tank
    if ($("#holding-tank-column").has($("#selected_row")).length) {
      console.log("Selected row is in holding tank");
      // If in holding tank, remove from holding tank
      removeFromHoldingTank();
    } else if ($("#hotkey-tab-content").has($("#selected_row")).length) {
      console.log("Selected row is in hotkey tab");
      // If in hotkey tab, remove from hotkey
      removeFromHotkey();
    } else {
      console.log("Selected row is in search results");
      // If not in holding tank or hotkey, delete from database
      deleteSong();
    }
    return false;
  });

  Mousetrap.bind("command+l", function () {
    if ($("#omni_search").is(":visible")) {
      $("#omni_search").trigger("focus");
    } else {
      $("#title-search").trigger("focus");
    }
  });

  // Set up hotkey and holding tank tabs

  for (var i = 2; i <= 5; i++) {
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
    selector: ".context-menu",
    items: {
      play: {
        name: "Play",
        icon: "fas fa-play-circle",
        callback: function (key, opt) {
          playSelected();
        },
      },
      edit: {
        name: "Edit",
        icon: "fas fa-edit",
        callback: function (key, opt) {
          editSelectedSong();
        },
      },
      delete: {
        name: function() {
          // Check if the selected row is in the holding tank
          if ($("#holding-tank-column").has($("#selected_row")).length) {
            return "Remove from Holding Tank";
          } else if ($("#hotkey-tab-content").has($("#selected_row")).length) {
            return "Remove from Hotkey";
          } else {
            return "Delete";
          }
        },
        icon: "fas fa-trash-alt",
        callback: function (key, opt) {
          deleteSelectedSong();
        },
      },
    },
  });

  $(".holding_tank").on("click", ".list-group-item", function (event) {
    toggle_selected_row(this);
  });

  $(".holding_tank").on("dblclick", ".list-group-item", function (event) {
    $(".now_playing").first().removeClass("now_playing");

    // Set the clicked item as selected
    $("#selected_row").removeAttr("id");
    $(this).attr("id", "selected_row");

    if (holdingTankMode === "playlist") {
      // In playlist mode, mark this song as now playing and start autoplay
      $(this).addClass("now_playing");
      autoplay = true;
    }

    playSelected();
  });

  // Add single-click selection for hotkeys
  $(".hotkeys").on("click", "li", function (event) {
    // Only select if the hotkey has a song assigned
    if ($(this).attr("songid")) {
      $("#selected_row").removeAttr("id");
      $(this).attr("id", "selected_row");
    }
  });

  $(".hotkeys").on("dblclick", "li", function (event) {
    $(".now_playing").first().removeClass("now_playing");
    $("#selected_row").removeAttr("id");
    if ($(this).find("span").text().length) {
      var song_id = $(this).attr("songid");
      if (song_id) {
        playSongFromId(song_id);
      }
    }
  });



  $("#category_select").on("change", function () {
    var category = $("#category_select").prop("selectedIndex");
    searchData();
    $("#omni_search").focus();
    $("#category_select").prop("selectedIndex", category);
  });

  $("#date-search").on("change", function () {
    searchData();
  });



  $("#search_form :input").on("keydown", function (e) {
    if (e.code == "Enter") {
      // Clear any pending live search
      clearTimeout(searchTimeout);
      $("#search_form").submit();
      return false;
    }
  });

  // Live search with debouncing

  // Function to trigger live search with current filters
  function triggerLiveSearch() {
    clearTimeout(searchTimeout);
    var searchTerm = $("#omni_search").val().trim();

    searchTimeout = setTimeout(() => {
      // Check if we have either a search term or advanced search filters
      var hasSearchTerm = searchTerm.length >= 2;
      var hasAdvancedFilters = false;

      if ($("#advanced-search").is(":visible")) {
        var title = $("#title-search").val().trim();
        var artist = $("#artist-search").val().trim();
        var info = $("#info-search").val().trim();
        var since = $("#date-search").val();
        hasAdvancedFilters =
          title.length > 0 ||
          artist.length > 0 ||
          info.length > 0 ||
          since.length > 0;
      }

      if (hasSearchTerm || hasAdvancedFilters) {
        performLiveSearch(searchTerm);
      } else {
        // Clear results when no search term and no advanced filters
        $("#search_results tbody").find("tr").remove();
        $("#search_results thead").hide();
      }
    }, 300); // 300ms debounce
  }

  // Live search on search term input
  $("#omni_search").on("input", function () {
    triggerLiveSearch();
  });

  // Live search when category filter changes
  $("#category_select").on("change", function () {
    var searchTerm = $("#omni_search").val().trim();
    if (searchTerm.length >= 2) {
      triggerLiveSearch();
    }
  });

  // Live search when advanced search fields change
  $("#title-search, #artist-search, #info-search, #date-search").on(
    "input change",
    function () {
      // When advanced search is active, trigger live search even if omni_search is empty
      if ($("#advanced-search").is(":visible")) {
        triggerLiveSearch();
      } else {
        var searchTerm = $("#omni_search").val().trim();
        if (searchTerm.length >= 2) {
          triggerLiveSearch();
        }
      }
    }
  );

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
    // Clear any pending live search
    clearTimeout(searchTimeout);
    $("#search_form").trigger("reset");
    $("#omni_search").focus();
    $("#search_results tbody").find("tr").remove();
    $("#search_results thead").hide();
    return false;
  });

  $("#advanced_search_button").on("click", function () {
    console.log("Advanced search button clicked");
    toggleAdvancedSearch();
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

  $("#progress_bar").click(function (e) {
    var percent = (e.clientX - $(this).offset().left) / $(this).width();
    if (sound) {
      sound.seek(sound.duration() * percent);
    }
  });

  $("#waveform").click(function (e) {
    var percent = (e.clientX - $(this).offset().left) / $(this).width();
    if (sound) {
      sound.seek(sound.duration() * percent);
    }
  });

  $("#volume").on("change", function () {
    var volume = $(this).val() / 100;
    if (sound) {
      sound.volume(volume);
    }
  });

  $("#mute_button").click(function () {
    if (sound) {
      sound.mute(!sound.mute());
      sound.volume($("#volume").val() / 100);
    }
    $("#mute_button").toggleClass("active");
    $("#song_now_playing").toggleClass("text-secondary");
  });

  $("#loop_button").click(function () {
    loop = !loop;
    loop_on(loop);
  });

  $("#waveform_button").on("click", function () {
    toggleWaveform();
  });

  $(".modal").on("show.bs.modal", function () {
    $(".modal").modal("hide");
  });

  $("#hotkey_tabs").on("dblclick", ".nav-link", function () {
    renameHotkeyTab();
  });

  $("#holding_tank_tabs").on("dblclick", ".nav-link", function () {
    renameHoldingTankTab();
  });

  $("#search_results thead").hide();

  $("#songFormModal").on("hidden.bs.modal", function (e) {
    $("#song-form-category").val("");
    $("#song-form-title").val("");
    $("#song-form-new-category").val("");
    $("#song-form-artist").val("");
    $("#song-form-info").val("");
    $("#song-form-duration").val("");
    $("#SongFormNewCategory").hide();
  });

  $("#songFormModal").on("shown.bs.modal", function (e) {
    console.log($("#song-form-title").val().length);
    if (!$("#song-form-title").val().length) {
      $("#song-form-title").focus();
    } else {
      $("#song-form-info").focus();
    }
  });

  $("#preferencesModal").on("shown.bs.modal", function (e) {
    // Load preferences using new store API
    Promise.all([
      window.electronAPI.store.get("database_directory"),
      window.electronAPI.store.get("music_directory"),
      window.electronAPI.store.get("hotkey_directory"),
      window.electronAPI.store.get("fade_out_seconds")
    ]).then(([dbDir, musicDir, hotkeyDir, fadeSeconds]) => {
      if (dbDir.success) $("#preferences-database-directory").val(dbDir.value);
      if (musicDir.success) $("#preferences-song-directory").val(musicDir.value);
      if (hotkeyDir.success) $("#preferences-hotkey-directory").val(hotkeyDir.value);
      if (fadeSeconds.success) $("#preferences-fadeout-seconds").val(fadeSeconds.value);
    }).catch(error => {
      console.warn('Failed to load preferences:', error);
      // Fallback to legacy store access
      $("#preferences-database-directory").val(store.get("database_directory"));
      $("#preferences-song-directory").val(store.get("music_directory"));
      $("#preferences-hotkey-directory").val(store.get("hotkey_directory"));
      $("#preferences-fadeout-seconds").val(store.get("fade_out_seconds"));
    });
  });

  $(window).on("resize", function () {
    this.scale_scrollable();
  });

  // Is there only one song in the db? Pop the first-run modal

  // Use new database API for song count
  if (window.electronAPI && window.electronAPI.database) {
    window.electronAPI.database.query("SELECT count(*) as count from mrvoice WHERE 1").then(result => {
      if (result.success && result.data.length > 0) {
        if (result.data[0].count <= 1) {
          $(`#firstRunModal`).modal("show");
        }
      } else {
        console.warn('❌ Failed to get song count:', result.error);
        // Fallback to legacy database access
        if (typeof db !== 'undefined') {
          var stmt = db.prepare("SELECT count(*) as count from mrvoice WHERE 1");
          var query = stmt.get();
          if (query.count <= 1) {
            $(`#firstRunModal`).modal("show");
          }
        }
      }
    }).catch(error => {
      console.warn('❌ Database API error:', error);
      // Fallback to legacy database access
      if (typeof db !== 'undefined') {
        var stmt = db.prepare("SELECT count(*) as count from mrvoice WHERE 1");
        var query = stmt.get();
        if (query.count <= 1) {
          $(`#firstRunModal`).modal("show");
        }
      }
    });
  } else {
    // Fallback to legacy database access
    if (typeof db !== 'undefined') {
      var stmt = db.prepare("SELECT count(*) as count from mrvoice WHERE 1");
      var query = stmt.get();
      if (query.count <= 1) {
        $(`#firstRunModal`).modal("show");
      }
    }
  }

  $("#song-form-category")
    .change(function () {
      $(this)
        .find("option:selected")
        .each(function () {
          var optionValue = $(this).attr("value");
          if (optionValue == "--NEW--") {
            $("#SongFormNewCategory").show();
            $("#song-form-new-category").attr("required", "required");
          } else {
            $("#SongFormNewCategory").hide();
            $("#song-form-new-category").removeAttr("required");
          }
        });
    })
    .change();



  // Handle focus restoration for confirmation modal
  $("#confirmationModal").on("hidden.bs.modal", function (e) {
    restoreFocusToSearch();
  });
});

// Test Functions Module - Functions extracted to src/renderer/modules/test-utils/
// testPhase2Migrations(), testDatabaseAPI(), testFileSystemAPI(), testStoreAPI(), testAudioAPI(), testSecurityFeatures() - All moved to test-utils module

