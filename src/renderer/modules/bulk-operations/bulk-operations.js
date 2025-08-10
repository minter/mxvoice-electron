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

// Import secure adapters
import { secureFileSystem, secureDatabase, securePath, secureStore } from '../adapters/secure-adapter.js';

/**
 * Shows the bulk add modal with directory and category selection
 * 
 * @param {string} directory - The directory path to pre-populate
 */
export function showBulkAddModal(directory) {
  $("#bulk-add-path").val(directory);
  $("#bulk-add-category").empty();
  secureDatabase.query("SELECT * FROM categories ORDER BY description ASC").then(result => {
    const rows = result?.data || result || [];
    if (Array.isArray(rows)) {
      rows.forEach(row => {
        categories[row.code] = row.description;
        $("#bulk-add-category").append(
          `<option value="${row.code}">${row.description}</option>`
        );
      });
    }
  }).catch(() => {/* ignore for modal open */});
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
      const durationSeconds = metadata.format.duration.toFixed(0);
      const durationString = new Date(durationSeconds * 1000)
        .toISOString()
        .substr(14, 5);

      return securePath.parse(songSourcePath).then(parseRes => {
        const parsed = parseRes?.data || {};
        const title = metadata.common.title || parsed.name;
      if (!title) {
        return;
      }
      const artist = metadata.common.artist;
      const uuidPromise = (window.secureElectronAPI?.utils?.generateId)
        ? window.secureElectronAPI.utils.generateId()
        : Promise.resolve(Date.now().toString());
      return uuidPromise.then(uuid => {
        return securePath.extname(songSourcePath).then(extRes => {
          const ext = extRes?.data || extRes || '';
          const newFilename = `${artist}-${title}-${uuid}${ext}`.replace(/[^-.\w]/g, "");
      secureStore.get("music_directory").then(result => {
        if (!result.success || !result.value) {
          debugLog?.warn('Failed to get music directory:', { 
            module: 'bulk-operations',
            function: 'addSongsByPath',
            result: result
          });
          return;
        }
        const musicDirectory = result.value;
        securePath.join(musicDirectory, newFilename).then(joinRes => {
          const newPath = joinRes?.data || joinRes;
          secureDatabase.execute(
            "INSERT INTO mrvoice (title, artist, category, filename, time, modtime) VALUES (?, ?, ?, ?, ?, ?)",
            [title, artist, category, newFilename, durationString, Math.floor(Date.now() / 1000)]
          ).then(insRes => {
            const lastId = insRes?.data?.lastInsertRowid;
        debugLog?.info('Copying audio file', { 
          module: 'bulk-operations',
          function: 'addSongsByPath',
          songSourcePath: songSourcePath,
          newPath: newPath
        });
        secureFileSystem.copy(songSourcePath, newPath).then(result => {
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
            lastId || ''
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
      });
      });
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
  const dirname = $("#bulk-add-path").val();

  const walk = function (dir) {
    let results = [];
    secureFileSystem.readdir(dir).then(result => {
      if (result.success) {
        result.data.forEach(function (file) {
          file = dir + "/" + file;
          secureFileSystem.stat(file).then(statResult => {
            if (statResult.success) {
              const stat = statResult.data;
              if (stat && stat.isDirectory()) {
                /* Recurse into a subdirectory */
                results = results.concat(walk(file));
              } else {
                /* Is a file */
                securePath.parse(file).then(result => {
                    if (!result.success || !result.data) {
                      debugLog?.warn('Path parse failed:', { 
                        module: 'bulk-operations',
                        function: 'saveBulkUpload',
                        file: file,
                        result: result
                      });
                      return;
                    }
                    const pathData = result.data;
                    if (
                      [".mp3", ".mp4", ".m4a", ".wav", ".ogg"].includes(
                        pathData.ext.toLowerCase()
                      )
                    ) {
                      results.push(file);
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

  const songs = walk(dirname);

  $("#search_results tbody").find("tr").remove();
  $("#search_results thead").show();

  const category = $("#bulk-add-category").val();

  if (category == "--NEW--") {
    const description = $("#bulk-song-form-new-category").val();
    let baseCode = description.replace(/\s/g, "").substr(0, 4).toUpperCase();
    const findUnique = async (base, i = 1) => {
      const test = i === 1 ? base : `${base}${i}`;
      const existsRes = await secureDatabase.query("SELECT 1 FROM categories WHERE code = ?", [test]);
      const exists = Array.isArray(existsRes?.data || existsRes) && (existsRes.data || existsRes).length > 0;
      return exists ? findUnique(base, i + 1) : test;
    };
    (async () => {
      const finalCode = await findUnique(baseCode);
      const ins = await secureDatabase.execute("INSERT INTO categories VALUES (?, ?)", [finalCode, description]);
      if (ins?.success) {
        debugLog?.info('Added new row into database', { module: 'bulk-operations', function: 'saveBulkUpload', code: finalCode, description });
        if (typeof populateCategorySelect === 'function') populateCategorySelect();
        if (typeof populateCategoriesModal === 'function') populateCategoriesModal();
        category = finalCode;
      } else {
        const desc = $("#bulk-song-form-new-category").val();
        $("#bulk-song-form-new-category").val("");
        alert(`Couldn't add a category named "${desc}" - apparently one already exists!`);
        return;
      }
    })();
  }

  addSongsByPath(songs, category);
} 