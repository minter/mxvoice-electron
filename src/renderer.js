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

// Animation utilities moved to utils module

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

// Hotkeys and holding tank functions moved to respective modules

// File Operations Module - Functions extracted to src/renderer/modules/file-operations/
// openHotkeyFile(), openHoldingTankFile(), saveHotkeyFile(), saveHoldingTankFile()
// pickDirectory(), installUpdate() - All moved to file-operations module

// Load modules dynamically and make functions globally available
(async function loadModules() {
  try {
    // Import file operations module and make functions globally available
    const fileOperationsModule = await import('./renderer/modules/file-operations/index.js');
    
    // Make file operations functions globally available
    window.openHotkeyFile = fileOperationsModule.default.openHotkeyFile;
    window.openHoldingTankFile = fileOperationsModule.default.openHoldingTankFile;
    window.saveHotkeyFile = fileOperationsModule.default.saveHotkeyFile;
    window.saveHoldingTankFile = fileOperationsModule.default.saveHoldingTankFile;
    window.pickDirectory = fileOperationsModule.default.pickDirectory;
    window.installUpdate = fileOperationsModule.default.installUpdate;

    // Import song management module and make functions globally available
    const songManagementModule = await import('./renderer/modules/song-management/index.js');
    
    // Make song management functions globally available
    window.saveEditedSong = songManagementModule.default.saveEditedSong;
    window.saveNewSong = songManagementModule.default.saveNewSong;
    window.editSelectedSong = songManagementModule.default.editSelectedSong;
    window.deleteSelectedSong = songManagementModule.default.deleteSelectedSong;
    window.deleteSong = songManagementModule.default.deleteSong;
    window.removeFromHoldingTank = songManagementModule.default.removeFromHoldingTank;
    window.removeFromHotkey = songManagementModule.default.removeFromHotkey;

    // Import holding tank module for additional functions
    const holdingTankModule = await import('./renderer/modules/holding-tank/index.js');
    
    // Make holding tank functions globally available
    window.clearHoldingTank = holdingTankModule.default.clearHoldingTank;
    window.renameHoldingTankTab = holdingTankModule.default.renameHoldingTankTab;
    window.scale_scrollable = holdingTankModule.default.scale_scrollable;

    // Note: Hotkeys module uses CommonJS exports and needs special handling
    // For now, these functions will be undefined until we convert the module
    window.clearHotkeys = function() {
      console.warn('clearHotkeys function not available - hotkeys module needs conversion to ES6');
    };
    window.renameHotkeyTab = function() {
      console.warn('renameHotkeyTab function not available - hotkeys module needs conversion to ES6');
    };
    window.playSongFromHotkey = function(hotkey) {
      console.warn('playSongFromHotkey function not available - hotkeys module needs conversion to ES6');
    };
    window.switchToHotkeyTab = function(tab) {
      console.warn('switchToHotkeyTab function not available - hotkeys module needs conversion to ES6');
    };

    // Import categories module and make functions globally available
    const categoriesModule = await import('./renderer/modules/categories/index.js');
    
    // Make categories functions globally available
    window.populateCategorySelect = categoriesModule.default.populateCategorySelect;

    // Import bulk operations module and make functions globally available
    const bulkOperationsModule = await import('./renderer/modules/bulk-operations/index.js');
    
    // Make bulk operations functions globally available
    window.showBulkAddModal = bulkOperationsModule.default.showBulkAddModal;
    window.addSongsByPath = bulkOperationsModule.default.addSongsByPath;
    window.saveBulkUpload = bulkOperationsModule.default.saveBulkUpload;

    // Import drag and drop module and make functions globally available
    const dragDropModule = await import('./renderer/modules/drag-drop/index.js');
    
    // Make drag and drop functions globally available
    window.hotkeyDrop = dragDropModule.default.hotkeyDrop;
    window.holdingTankDrop = dragDropModule.default.holdingTankDrop;
    window.allowHotkeyDrop = dragDropModule.default.allowHotkeyDrop;
    window.songDrag = dragDropModule.default.songDrag;
    window.columnDrag = dragDropModule.default.columnDrag;

    // Import navigation module and make functions globally available
    const navigationModule = await import('./renderer/modules/navigation/index.js');
    
    // Make navigation functions globally available
    window.sendToHotkeys = navigationModule.default.sendToHotkeys;
    window.sendToHoldingTank = navigationModule.default.sendToHoldingTank;
    window.selectNext = navigationModule.default.selectNext;
    window.selectPrev = navigationModule.default.selectPrev;

    // Import mode management module and make functions globally available
    const modeManagementModule = await import('./renderer/modules/mode-management/index.js');
    
    // Make mode management functions globally available
    window.setHoldingTankMode = modeManagementModule.default.setHoldingTankMode;
    window.getHoldingTankMode = modeManagementModule.default.getHoldingTankMode;
    window.toggleAutoPlay = modeManagementModule.default.toggleAutoPlay;
    window.getAutoPlayState = modeManagementModule.default.getAutoPlayState;
    window.resetToDefaultMode = modeManagementModule.default.resetToDefaultMode;

    // Initialize mode management module
    modeManagementModule.default.initModeManagement().then(result => {
      if (result.success) {
        console.log('✅ Mode management module initialized:', result.mode);
      } else {
        console.warn('❌ Failed to initialize mode management module:', result.error);
      }
    }).catch(error => {
      console.error('❌ Mode management module initialization error:', error);
    });

    // Import test functions module and make functions globally available
    const testUtilsModule = await import('./renderer/modules/test-utils/index.js');
    
    // Make test functions globally available
    window.testPhase2Migrations = testUtilsModule.default.testPhase2Migrations;
    window.testDatabaseAPI = testUtilsModule.default.testDatabaseAPI;
    window.testFileSystemAPI = testUtilsModule.default.testFileSystemAPI;
    window.testStoreAPI = testUtilsModule.default.testStoreAPI;
    window.testAudioAPI = testUtilsModule.default.testAudioAPI;
    window.testSecurityFeatures = testUtilsModule.default.testSecurityFeatures;
    window.runAllTests = testUtilsModule.default.runAllTests;

    // Import search module and make functions globally available
    const searchModule = await import('./renderer/modules/search/index.js');
    
    // Make search functions globally available
    window.searchData = searchModule.default.searchData;
    window.performLiveSearch = searchModule.default.performLiveSearch;
    window.toggleAdvancedSearch = searchModule.default.toggleAdvancedSearch;
    window.triggerLiveSearch = searchModule.default.triggerLiveSearch;

    // Import audio module and make functions globally available
    const audioModule = await import('./renderer/modules/audio/index.js');
    
    // Make audio functions globally available
    window.playSongFromId = audioModule.default.playSongFromId;
    window.stopPlaying = audioModule.default.stopPlaying;
    window.pausePlaying = audioModule.default.pausePlaying;
    window.resetUIState = audioModule.default.resetUIState;
    window.autoplay_next = audioModule.default.autoplay_next;
    window.cancel_autoplay = audioModule.default.cancel_autoplay;
    window.playSelected = audioModule.default.playSelected;
    window.loop_on = audioModule.default.loop_on;
    window.howlerUtils = audioModule.default.howlerUtils;

    console.log('✅ All modules loaded successfully!');

    // Initialize modules after loading
    try {
      bulkOperationsModule.default.initializeBulkOperations();
      dragDropModule.default.initializeDragDrop();
      navigationModule.default.initializeNavigation();
      console.log('✅ All modules initialized successfully!');
    } catch (error) {
      console.error('❌ Error initializing modules:', error);
    }

    // Call functions that depend on loaded modules
    try {
      if (window.scale_scrollable) {
        window.scale_scrollable();
      }
      if (window.populateCategorySelect) {
        window.populateCategorySelect();
      }
      console.log('✅ Module-dependent functions called successfully!');
    } catch (error) {
      console.error('❌ Error calling module-dependent functions:', error);
    }

    // Set up keyboard shortcuts after modules are loaded
    try {
      setupKeyboardShortcuts();
      console.log('✅ Keyboard shortcuts set up successfully!');
    } catch (error) {
      console.error('❌ Error setting up keyboard shortcuts:', error);
    }
  } catch (error) {
    console.error('❌ Error loading modules:', error);
  }
})();

// Preferences and database functions moved to respective modules

// Search functions moved to search module

// Live search functions moved to search module

// Database functions moved to database module

// Database functions moved to database module

// howlerUtils moved to audio module

// Audio functions moved to audio module





// Mode Management Module - Functions extracted to src/renderer/modules/mode-management/
// setHoldingTankMode(), toggleAutoPlay() - All moved to mode-management module

// Song Management Module - Functions extracted to src/renderer/modules/song-management/
// deleteSong(), removeFromHoldingTank(), removeFromHotkey() - All moved to song-management module

// UI functions moved to ui module

// Song Management Module - Functions extracted to src/renderer/modules/song-management/
// editSelectedSong(), deleteSelectedSong() - All moved to song-management module

// Song Management Module - Functions extracted to src/renderer/modules/song-management/
// showBulkAddModal(), addSongsByPath(), saveBulkUpload() - All moved to bulk-operations module

// Categories functions moved to categories module

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

// UI and search functions moved to respective modules

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

// Utility functions moved to utils module

/**
 * Set up keyboard shortcuts after modules are loaded
 */
function setupKeyboardShortcuts() {
  var search_field = document.getElementById("omni_search");

  // Set up fkeys
  for (let i = 1; i <= 12; i++) {
    Mousetrap.bind(`f${i}`, function () {
      if (window.playSongFromHotkey) {
        playSongFromHotkey(`f${i}`);
      }
    });

    Mousetrap(search_field).bind(`f${i}`, function () {
      if (window.playSongFromHotkey) {
        playSongFromHotkey(`f${i}`);
      }
    });
  }

  for (let i = 1; i <= 5; i++) {
    Mousetrap.bind(`command+${i}`, function () {
      if (window.switchToHotkeyTab) {
        switchToHotkeyTab(i);
      }
    });
  }

  Mousetrap(search_field).bind("esc", function () {
    if (window.stopPlaying) {
      stopPlaying();
    }
  });

  Mousetrap.bind("esc", function () {
    if (window.stopPlaying) {
      stopPlaying();
    }
  });
  Mousetrap.bind("shift+esc", function () {
    if (window.stopPlaying) {
      stopPlaying(true);
    }
  });

  Mousetrap.bind("command+l", function () {
    $("#omni_search").focus().select();
  });

  Mousetrap.bind("space", function () {
    if (window.pausePlaying) {
      pausePlaying();
    }
    return false;
  });

  Mousetrap.bind("shift+space", function () {
    if (window.pausePlaying) {
      pausePlaying(true);
    }
    return false;
  });

  Mousetrap.bind("return", function () {
    if (!$("#songFormModal").hasClass("show") && window.playSelected) {
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
      if (window.removeFromHoldingTank) {
        removeFromHoldingTank();
      }
    } else if ($("#hotkey-tab-content").has($("#selected_row")).length) {
      console.log("Selected row is in hotkey tab");
      // If in hotkey tab, remove from hotkey
      if (window.removeFromHotkey) {
        removeFromHotkey();
      }
    } else {
      console.log("Selected row is in search results");
      // If not in holding tank or hotkey, delete from database
      if (window.deleteSong) {
        deleteSong();
      }
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
}

$(document).ready(function () {
  // These functions will be called after modules are loaded
  // scale_scrollable();
  // populateCategorySelect();

  // Module initializations will be handled in the loadModules async function

  // Initialize progress bar to 0% width
  $("#audio_progress").width("0%");

  // Set up event handlers that don't depend on modules
  $("#search_results").on("click", "tbody tr", function (event) {
    toggle_selected_row(this);
  });

  $("#search_results").on("contextmenu", "tbody tr", function (event) {
    toggle_selected_row(this);
  });

  $("#search_results").on("dblclick", "tbody tr.song", function (event) {
    if (window.playSelected) {
      playSelected();
    }
  });

  // Keyboard shortcuts will be set up after modules are loaded
  // setupKeyboardShortcuts();

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

  // triggerLiveSearch function moved to search module

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

