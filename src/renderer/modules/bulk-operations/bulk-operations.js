/**
 * Bulk Operations Functions
 * 
 * Core functions for handling bulk import of songs from directories
 */

// Import debug logger
let debugLog = null;
try {
  // Try to get debug logger from global scope
  if (window.debugLog) {
    debugLog = window.debugLog;
  }
} catch (error) {
  // Debug logger not available
}

/**
 * Shows the bulk add modal with directory and category selection
 * 
 * @param {string} directory - The directory path to pre-populate
 */
export function showBulkAddModal(directory) {
  $("#bulk-add-path").val(directory);
  $("#bulk-add-category").empty();
  const stmt = db.prepare("SELECT * FROM categories ORDER BY description ASC");
  for (const row of stmt.iterate()) {
    categories[row.code] = row.description;
    $("#bulk-add-category").append(
      `<option value="${row.code}">${row.description}</option>`
    );
  }
  $("#bulk-add-category").append(
    `<option value="" disabled>-----------------------</option>`
  );
  $("#bulk-add-category").append(
    `<option value="--NEW--">ADD NEW CATEGORY...</option>`
  );

  $("#bulkAddModal").modal();
}

/**
 * Processes songs from a path array and adds them to the database
 * Handles metadata extraction, file copying, and database insertion
 * 
 * @param {Array} pathArray - Array of file paths to process
 * @param {string} category - Category code for the songs
 * @returns {Promise} - Promise that resolves when all songs are processed
 */
export function addSongsByPath(pathArray, category) {
  const songSourcePath = pathArray.shift();
  if (songSourcePath) {
    return mm.parseFile(songSourcePath).then((metadata) => {
      var durationSeconds = metadata.format.duration.toFixed(0);
      var durationString = new Date(durationSeconds * 1000)
        .toISOString()
        .substr(14, 5);

      var title = metadata.common.title || path.parse(songSourcePath).name;
      if (!title) {
        return;
      }
      var artist = metadata.common.artist;
      var uuid = uuidv4();
      var newFilename = `${artist}-${title}-${uuid}${path.extname(songSourcePath)}`.replace(/[^-.\w]/g, "");
      window.electronAPI.store.get("music_directory").then(musicDirectory => {
        var newPath = path.join(musicDirectory.value, newFilename);
        const stmt = db.prepare(
          "INSERT INTO mrvoice (title, artist, category, filename, time, modtime) VALUES (?, ?, ?, ?, ?, ?)"
        );
        const info = stmt.run(
          title,
          artist,
          category,
          newFilename,
          durationString,
          Math.floor(Date.now() / 1000)
        );
        debugLog?.info('Copying audio file', { 
          module: 'bulk-operations',
          function: 'addSongsByPath',
          songSourcePath: songSourcePath,
          newPath: newPath
        });
        window.electronAPI.fileSystem.copy(songSourcePath, newPath).then(result => {
          if (result.success) {
            debugLog?.info('File copied successfully', { 
              module: 'bulk-operations',
              function: 'addSongsByPath',
              songSourcePath: songSourcePath,
              newPath: newPath
            });
          } else {
            debugLog?.warn('Failed to copy file', { 
              module: 'bulk-operations',
              function: 'addSongsByPath',
              songSourcePath: songSourcePath,
              newPath: newPath,
              error: result.error
            });
          }
        }).catch(error => {
          debugLog?.warn('File copy error', { 
            module: 'bulk-operations',
            function: 'addSongsByPath',
            songSourcePath: songSourcePath,
            newPath: newPath,
            error: error
          });
        });
        $("#search_results").append(
          `<tr draggable='true' ondragstart='songDrag(event)' class='song unselectable context-menu' songid='${
            info.lastInsertRowid
          }'><td>${
            categories[category]
          }</td><td></td><td style='font-weight: bold'>${
            title || ""
          }</td><td style='font-weight:bold'>${
            artist || ""
          }</td><td>${durationString}</td></tr>`
        );

        return addSongsByPath(pathArray, category); // process rest of the files AFTER we are finished
      });
    });
  }
  return Promise.resolve();
}

/**
 * Handles bulk upload of songs from a directory
 * Walks through directory recursively, finds audio files, and processes them
 * 
 * @param {Event} event - The form submission event
 */
export function saveBulkUpload(event) {
  event.preventDefault();
  $("#bulkAddModal").modal("hide");
  var dirname = $("#bulk-add-path").val();

  var walk = function (dir) {
    var results = [];
    window.electronAPI.fileSystem.readdir(dir).then(result => {
      if (result.success) {
        result.data.forEach(function (file) {
          file = dir + "/" + file;
          window.electronAPI.fileSystem.stat(file).then(statResult => {
            if (statResult.success) {
              var stat = statResult.data;
              if (stat && stat.isDirectory()) {
                /* Recurse into a subdirectory */
                results = results.concat(walk(file));
              } else {
                /* Is a file */
                window.electronAPI.path.parse(file).then(parseResult => {
                  if (parseResult.success) {
                    var pathData = parseResult.data;
                    if (
                      [".mp3", ".mp4", ".m4a", ".wav", ".ogg"].includes(
                        pathData.ext.toLowerCase()
                      )
                    ) {
                      results.push(file);
                    }
                  } else {
                    debugLog?.warn('Failed to parse path', { 
                      module: 'bulk-operations',
                      function: 'saveBulkUpload',
                      file: file,
                      error: parseResult.error
                    });
                  }
                }).catch(error => {
                  debugLog?.warn('Path parse error', { 
                    module: 'bulk-operations',
                    function: 'saveBulkUpload',
                    file: file,
                    error: error
                  });
                });
              }
            } else {
              debugLog?.warn('Failed to get file stats', { 
                module: 'bulk-operations',
                function: 'saveBulkUpload',
                file: file,
                error: statResult.error
              });
            }
          }).catch(error => {
            debugLog?.warn('File stat error', { 
              module: 'bulk-operations',
              function: 'saveBulkUpload',
              file: file,
              error: error
            });
          });
        });
      } else {
        debugLog?.warn('Failed to read directory', { 
          module: 'bulk-operations',
          function: 'saveBulkUpload',
          dir: dir,
          error: result.error
        });
      }
    }).catch(error => {
      debugLog?.warn('Directory read error', { 
        module: 'bulk-operations',
        function: 'saveBulkUpload',
        dir: dir,
        error: error
      });
    });
    return results;
  };

  var songs = walk(dirname);

  $("#search_results tbody").find("tr").remove();
  $("#search_results thead").show();

  var category = $("#bulk-add-category").val();

  if (category == "--NEW--") {
    var description = $("#bulk-song-form-new-category").val();
    var code = description.replace(/\s/g, "").substr(0, 4).toUpperCase();
    var codeCheckStmt = db.prepare("SELECT * FROM categories WHERE code = ?");
    var loopCount = 1;
    var newCode = code;
    while ((row = codeCheckStmt.get(newCode))) {
      debugLog?.info('Found a code collision', { 
        module: 'bulk-operations',
        function: 'saveBulkUpload',
        code: code,
        loopCount: loopCount
      });
      var newCode = `${code}${loopCount}`;
      loopCount = loopCount + 1;
      debugLog?.info('NewCode generated', { 
        module: 'bulk-operations',
        function: 'saveBulkUpload',
        newCode: newCode
      });
    }
    debugLog?.info('Out of loop, setting code', { 
      module: 'bulk-operations',
      function: 'saveBulkUpload',
      finalCode: newCode
    });
    code = newCode;
    const categoryInsertStmt = db.prepare(
      "INSERT INTO categories VALUES (?, ?)"
    );
    try {
      const categoryInfo = categoryInsertStmt.run(code, description);
      if (categoryInfo.changes == 1) {
        debugLog?.info('Added new row into database', { 
          module: 'bulk-operations',
          function: 'saveBulkUpload',
          code: code,
          description: description
        });
        populateCategorySelect();
        populateCategoriesModal();
        category = code;
      }
    } catch (err) {
      if (err.message.match(/UNIQUE constraint/)) {
        var description = $("#bulk-song-form-new-category").val();
        $("#bulk-song-form-new-category").val("");
        alert(
          `Couldn't add a category named "${description}" - apparently one already exists!`
        );
        return;
      }
    }
  }

  addSongsByPath(songs, category);
} 