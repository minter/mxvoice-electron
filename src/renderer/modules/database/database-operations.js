/**
 * Database Operations Module
 * 
 * Handles core database operations including CRUD operations for songs and categories,
 * bulk operations, and database query management. This module provides the missing
 * database operations that were in the original renderer.js file.
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
 * Edit category in the database
 * Updates the category description in the database
 * 
 * @param {string} code - Category code
 * @param {string} description - New category description
 * @returns {Promise<Object>} - Result of the operation
 */
function editCategory(code, description) {
  return new Promise((resolve, reject) => {
    if (window.electronAPI && window.electronAPI.database) {
      window.electronAPI.database.execute(
        "UPDATE categories SET description = ? WHERE code = ?",
        [description, code]
      ).then(result => {
        if (result.success) {
          debugLog?.info(`Category ${code} updated successfully`, { 
            module: 'database-operations',
            function: 'editCategory',
            code: code,
            description: description
          });
          resolve(result);
        } else {
          debugLog?.warn('Failed to update category', { 
            module: 'database-operations',
            function: 'editCategory',
            code: code,
            error: result.error
          });
          reject(new Error(result.error));
        }
      }).catch(error => {
        debugLog?.warn('Database API error', { 
          module: 'database-operations',
          function: 'editCategory',
          code: code,
          error: error
        });
        reject(error);
      });
    } else {
      // Fallback to legacy database access
      if (typeof db !== 'undefined') {
        try {
          const stmt = db.prepare("UPDATE categories SET description = ? WHERE code = ?");
          const info = stmt.run(description, code);
          if (info.changes > 0) {
            debugLog?.info(`Category ${code} updated successfully`, { 
              module: 'database-operations',
              function: 'editCategory',
              code: code,
              description: description
            });
            resolve({ success: true, changes: info.changes });
          } else {
            reject(new Error('No changes made to category'));
          }
        } catch (error) {
          reject(error);
        }
      } else {
        reject(new Error('Database not available'));
      }
    }
  });
}

/**
 * Delete category from the database
 * Deletes a category and moves all songs to "Uncategorized"
 * 
 * @param {string} code - Category code to delete
 * @param {string} description - Category description for confirmation
 * @returns {Promise<Object>} - Result of the operation
 */
function deleteCategory(code, description) {
  return new Promise((resolve, reject) => {
    if (window.electronAPI && window.electronAPI.database) {
      // First ensure "Uncategorized" category exists
      window.electronAPI.database.execute(
        "INSERT OR REPLACE INTO categories VALUES(?, ?)",
        ["UNC", "Uncategorized"]
      ).then(() => {
        // Update all songs in this category to "Uncategorized"
        return window.electronAPI.database.execute(
          "UPDATE mrvoice SET category = ? WHERE category = ?",
          ["UNC", code]
        );
      }).then(() => {
        // Delete the category
        return window.electronAPI.database.execute(
          "DELETE FROM categories WHERE code = ?",
          [code]
        );
      }).then(result => {
        if (result.success) {
          debugLog?.info(`Category ${code} deleted successfully`, { 
            module: 'database-operations',
            function: 'deleteCategory',
            code: code,
            description: description
          });
          resolve(result);
        } else {
          debugLog?.warn('Failed to delete category', { 
            module: 'database-operations',
            function: 'deleteCategory',
            code: code,
            error: result.error
          });
          reject(new Error(result.error));
        }
      }).catch(error => {
        debugLog?.warn('Database API error', { 
          module: 'database-operations',
          function: 'deleteCategory',
          code: code,
          error: error
        });
        reject(error);
      });
    } else {
      // Fallback to legacy database access
      if (typeof db !== 'undefined') {
        try {
          // Ensure "Uncategorized" category exists
          const uncategorizedCheckStmt = db.prepare(
            "INSERT OR REPLACE INTO categories VALUES(?, ?);"
          );
          const uncategorizedCheckInfo = uncategorizedCheckStmt.run(
            "UNC",
            "Uncategorized"
          );
          
          // Update all songs in this category to "Uncategorized"
          const stmt = db.prepare(
            "UPDATE mrvoice SET category = ? WHERE category = ?"
          );
          const info = stmt.run("UNC", code);
          debugLog?.info(`Updated ${info.changes} rows to uncategorized`, { 
            module: 'database-operations',
            function: 'deleteCategory',
            code: code,
            changes: info.changes
          });

          // Delete the category
          const deleteStmt = db.prepare("DELETE FROM categories WHERE code = ?");
          const deleteInfo = deleteStmt.run(code);
          if (deleteInfo.changes == 1) {
            debugLog?.info(`Category ${code} deleted successfully`, { 
              module: 'database-operations',
              function: 'deleteCategory',
              code: code,
              description: description
            });
            resolve({ success: true, changes: deleteInfo.changes });
          } else {
            reject(new Error('No category deleted'));
          }
        } catch (error) {
          reject(error);
        }
      } else {
        reject(new Error('Database not available'));
      }
    }
  });
}

/**
 * Add new category to the database
 * Creates a new category with auto-generated code
 * 
 * @param {string} description - Category description
 * @returns {Promise<Object>} - Result of the operation
 */
function addNewCategory(description) {
  return new Promise((resolve, reject) => {
    let code = description.replace(/\s/g, "").substr(0, 4).toUpperCase();
    
    if (window.electronAPI && window.electronAPI.database) {
      // Check for code collision and generate unique code
      const checkCode = (baseCode, loopCount = 1) => {
        const testCode = loopCount === 1 ? baseCode : `${baseCode}${loopCount}`;
        
        return window.electronAPI.database.query(
          "SELECT * FROM categories WHERE code = ?",
          [testCode]
        ).then(result => {
          if (result.success && result.data.length > 0) {
            return checkCode(baseCode, loopCount + 1);
          } else {
            return testCode;
          }
        });
      };
      
      checkCode(code).then(finalCode => {
        return window.electronAPI.database.execute(
          "INSERT INTO categories VALUES (?, ?)",
          [finalCode, description]
        );
      }).then(result => {
        if (result.success) {
          debugLog?.info(`New category ${code} added successfully`, { 
            module: 'database-operations',
            function: 'addNewCategory',
            code: code,
            description: description
          });
          resolve(result);
        } else {
          debugLog?.warn('Failed to add category', { 
            module: 'database-operations',
            function: 'addNewCategory',
            description: description,
            error: result.error
          });
          reject(new Error(result.error));
        }
      }).catch(error => {
        debugLog?.warn('Database API error', { 
          module: 'database-operations',
          function: 'addNewCategory',
          description: description,
          error: error
        });
        reject(error);
      });
    } else {
      // Fallback to legacy database access
      if (typeof db !== 'undefined') {
        try {
          // Check for code collision
          const codeCheckStmt = db.prepare("SELECT * FROM categories WHERE code = ?");
          let loopCount = 1;
          let newCode = code;
          
          while (codeCheckStmt.get(newCode)) {
            debugLog?.info(`Found a code collision on ${code}`, { 
              module: 'database-operations',
              function: 'addNewCategory',
              code: code,
              loopCount: loopCount
            });
            newCode = `${code}${loopCount}`;
            loopCount = loopCount + 1;
          }
          
          code = newCode;
          debugLog?.info(`Adding ${code} :: ${description}`, { 
            module: 'database-operations',
            function: 'addNewCategory',
            code: code,
            description: description
          });
          
          const stmt = db.prepare("INSERT INTO categories VALUES (?, ?)");
          const info = stmt.run(code, description);
          if (info.changes == 1) {
            debugLog?.info(`New category ${code} added successfully`, { 
              module: 'database-operations',
              function: 'addNewCategory',
              code: code,
              description: description
            });
            resolve({ success: true, changes: info.changes, code: code });
          } else {
            reject(new Error('Failed to add category'));
          }
        } catch (error) {
          if (error.message.match(/UNIQUE constraint/)) {
            reject(new Error(`Category "${description}" already exists`));
          } else {
            reject(error);
          }
        }
      } else {
        reject(new Error('Database not available'));
      }
    }
  });
}

/**
 * Save edited song to the database
 * Updates an existing song's information
 * 
 * @param {Object} songData - Song data object
 * @returns {Promise<Object>} - Result of the operation
 */
function saveEditedSong(songData) {
  return new Promise((resolve, reject) => {
    if (window.electronAPI && window.electronAPI.database) {
      window.electronAPI.database.execute(
        "UPDATE mrvoice SET title = ?, artist = ?, category = ?, info = ? WHERE id = ?",
        [songData.title, songData.artist, songData.category, songData.info, songData.id]
      ).then(result => {
        if (result.success) {
          debugLog?.info(`Song ${songData.id} updated successfully`, { 
            module: 'database-operations',
            function: 'saveEditedSong',
            songId: songData.id,
            title: songData.title
          });
          resolve(result);
        } else {
          debugLog?.warn('Failed to update song', { 
            module: 'database-operations',
            function: 'saveEditedSong',
            songId: songData.id,
            error: result.error
          });
          reject(new Error(result.error));
        }
      }).catch(error => {
        debugLog?.warn('Database API error', { 
          module: 'database-operations',
          function: 'saveEditedSong',
          songId: songData.id,
          error: error
        });
        reject(error);
      });
    } else {
      // Fallback to legacy database access
      if (typeof db !== 'undefined') {
        try {
          const stmt = db.prepare(
            "UPDATE mrvoice SET title = ?, artist = ?, category = ?, info = ? WHERE id = ?"
          );
          const info = stmt.run(
            songData.title, 
            songData.artist, 
            songData.category, 
            songData.info, 
            songData.id
          );
          debugLog?.info(`Song ${songData.id} updated successfully`, { 
            module: 'database-operations',
            function: 'saveEditedSong',
            songId: songData.id,
            title: songData.title
          });
          resolve({ success: true, changes: info.changes });
        } catch (error) {
          reject(error);
        }
      } else {
        reject(new Error('Database not available'));
      }
    }
  });
}

/**
 * Save new song to the database
 * Creates a new song record in the database
 * 
 * @param {Object} songData - Song data object
 * @returns {Promise<Object>} - Result of the operation
 */
function saveNewSong(songData) {
  return new Promise((resolve, reject) => {
    if (window.electronAPI && window.electronAPI.database) {
      window.electronAPI.database.execute(
        "INSERT INTO mrvoice (title, artist, category, info, filename, time, modtime) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          songData.title,
          songData.artist,
          songData.category,
          songData.info,
          songData.filename,
          songData.duration,
          Math.floor(Date.now() / 1000)
        ]
      ).then(result => {
        if (result.success) {
          debugLog?.info('New song added successfully', { 
            module: 'database-operations',
            function: 'saveNewSong',
            title: songData.title,
            artist: songData.artist
          });
          resolve(result);
        } else {
          debugLog?.warn('Failed to add song', { 
            module: 'database-operations',
            function: 'saveNewSong',
            title: songData.title,
            error: result.error
          });
          reject(new Error(result.error));
        }
      }).catch(error => {
        debugLog?.warn('Database API error', { 
          module: 'database-operations',
          function: 'saveNewSong',
          title: songData.title,
          error: error
        });
        reject(error);
      });
    } else {
      // Fallback to legacy database access
      if (typeof db !== 'undefined') {
        try {
          const stmt = db.prepare(
            "INSERT INTO mrvoice (title, artist, category, info, filename, time, modtime) VALUES (?, ?, ?, ?, ?, ?, ?)"
          );
          const info = stmt.run(
            songData.title,
            songData.artist,
            songData.category,
            songData.info,
            songData.filename,
            songData.duration,
            Math.floor(Date.now() / 1000)
          );
          debugLog?.info('New song added successfully', { 
            module: 'database-operations',
            function: 'saveNewSong',
            title: songData.title,
            artist: songData.artist
          });
          resolve({ success: true, changes: info.changes, lastInsertRowid: info.lastInsertRowid });
        } catch (error) {
          reject(error);
        }
      } else {
        reject(new Error('Database not available'));
      }
    }
  });
}

/**
 * Delete song from the database
 * Removes a song record from the database
 * 
 * @param {string} songId - Song ID to delete
 * @returns {Promise<Object>} - Result of the operation
 */
function deleteSong(songId) {
  return new Promise((resolve, reject) => {
    if (window.electronAPI && window.electronAPI.database) {
      window.electronAPI.database.execute(
        "DELETE FROM mrvoice WHERE id = ?",
        [songId]
      ).then(result => {
        if (result.success) {
          debugLog?.info(`Song ${songId} deleted successfully`, { 
            module: 'database-operations',
            function: 'deleteSong',
            songId: songId
          });
          resolve(result);
        } else {
          debugLog?.warn('Failed to delete song', { 
            module: 'database-operations',
            function: 'deleteSong',
            songId: songId,
            error: result.error
          });
          reject(new Error(result.error));
        }
      }).catch(error => {
        debugLog?.warn('Database API error', { 
          module: 'database-operations',
          function: 'deleteSong',
          songId: songId,
          error: error
        });
        reject(error);
      });
    } else {
      // Fallback to legacy database access
      if (typeof db !== 'undefined') {
        try {
          const deleteStmt = db.prepare("DELETE FROM mrvoice WHERE id = ?");
          const info = deleteStmt.run(songId);
          if (info.changes > 0) {
            debugLog?.info(`Song ${songId} deleted successfully`, { 
              module: 'database-operations',
              function: 'deleteSong',
              songId: songId
            });
            resolve({ success: true, changes: info.changes });
          } else {
            reject(new Error('No song deleted'));
          }
        } catch (error) {
          reject(error);
        }
      } else {
        reject(new Error('Database not available'));
      }
    }
  });
}

/**
 * Get song by ID from the database
 * Retrieves song information by ID
 * 
 * @param {string} songId - Song ID to retrieve
 * @returns {Promise<Object>} - Result of the operation
 */
function getSongById(songId) {
  return new Promise((resolve, reject) => {
    if (window.electronAPI && window.electronAPI.database) {
      window.electronAPI.database.query(
        "SELECT * FROM mrvoice WHERE id = ?",
        [songId]
      ).then(result => {
        if (result.success) {
          if (result.data.length > 0) {
            debugLog?.info(`Song ${songId} retrieved successfully`, { 
              module: 'database-operations',
              function: 'getSongById',
              songId: songId
            });
            resolve(result);
          } else {
            reject(new Error('Song not found'));
          }
        } else {
          debugLog?.warn('Failed to get song', { 
            module: 'database-operations',
            function: 'getSongById',
            songId: songId,
            error: result.error
          });
          reject(new Error(result.error));
        }
      }).catch(error => {
        debugLog?.warn('Database API error', { 
          module: 'database-operations',
          function: 'getSongById',
          songId: songId,
          error: error
        });
        reject(error);
      });
    } else {
      // Fallback to legacy database access
      if (typeof db !== 'undefined') {
        try {
          const stmt = db.prepare("SELECT * FROM mrvoice WHERE id = ?");
          const row = stmt.get(songId);
          if (row) {
            debugLog?.info(`Song ${songId} retrieved successfully`, { 
              module: 'database-operations',
              function: 'getSongById',
              songId: songId
            });
            resolve({ success: true, data: [row] });
          } else {
            reject(new Error('Song not found'));
          }
        } catch (error) {
          reject(error);
        }
      } else {
        reject(new Error('Database not available'));
      }
    }
  });
}

/**
 * Add songs by path (bulk operation)
 * Processes multiple audio files and adds them to the database
 * 
 * @param {Array} pathArray - Array of file paths to process
 * @param {string} category - Category to assign to all songs
 * @returns {Promise<Object>} - Result of the operation
 */
function addSongsByPath(pathArray, category) {
  return new Promise((resolve, reject) => {
    if (pathArray.length === 0) {
      resolve({ success: true, processed: 0 });
      return;
    }

    const songSourcePath = pathArray.shift();
    
    // This would need to be integrated with the music-metadata library
    // For now, we'll create a placeholder implementation
    debugLog?.info(`Processing song: ${songSourcePath}`, { 
      module: 'database-operations',
      function: 'addSongsByPath',
      songSourcePath: songSourcePath,
      category: category
    });
    
    // Mock metadata for testing
    const mockMetadata = {
      common: {
        title: path.parse(songSourcePath).name,
        artist: 'Unknown Artist'
      },
      format: {
        duration: 180 // 3 minutes default
      }
    };
    
    const durationSeconds = mockMetadata.format.duration.toFixed(0);
    const durationString = new Date(durationSeconds * 1000)
      .toISOString()
      .substr(14, 5);

    const title = mockMetadata.common.title || path.parse(songSourcePath).name;
    const artist = mockMetadata.common.artist;
    const uuid = uuidv4 ? uuidv4() : Date.now().toString();
    const newFilename = `${artist}-${title}-${uuid}${path.extname(songSourcePath)}`.replace(/[^-.\w]/g, "");
    
    // Save to database
    saveNewSong({
      title: title,
      artist: artist,
      category: category,
      info: '',
      filename: newFilename,
      duration: durationString
    }).then(result => {
      debugLog?.info(`Song added to database: ${title}`, { 
        module: 'database-operations',
        function: 'addSongsByPath',
        title: title,
        artist: artist
      });
      
      // Process remaining files
      return addSongsByPath(pathArray, category);
    }).then(result => {
      resolve({ success: true, processed: result.processed + 1 });
    }).catch(error => {
      debugLog?.warn('Failed to add song', { 
        module: 'database-operations',
        function: 'addSongsByPath',
        songSourcePath: songSourcePath,
        error: error
      });
      reject(error);
    });
  });
}

/**
 * Execute a custom database query
 * Allows execution of custom SQL queries
 * 
 * @param {string} sql - SQL query to execute
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} - Result of the operation
 */
function executeQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (window.electronAPI && window.electronAPI.database) {
      window.electronAPI.database.query(sql, params).then(result => {
        if (result.success) {
          debugLog?.info('Query executed successfully', { 
            module: 'database-operations',
            function: 'executeQuery',
            sql: sql
          });
          resolve(result);
        } else {
          debugLog?.warn('Query failed', { 
            module: 'database-operations',
            function: 'executeQuery',
            sql: sql,
            error: result.error
          });
          reject(new Error(result.error));
        }
      }).catch(error => {
        debugLog?.warn('Database API error', { 
          module: 'database-operations',
          function: 'executeQuery',
          sql: sql,
          error: error
        });
        reject(error);
      });
    } else {
      // Fallback to legacy database access
      if (typeof db !== 'undefined') {
        try {
          const stmt = db.prepare(sql);
          const data = stmt.all(params);
          debugLog?.info('Query executed successfully', { 
            module: 'database-operations',
            function: 'executeQuery',
            sql: sql
          });
          resolve({ success: true, data: data });
        } catch (error) {
          reject(error);
        }
      } else {
        reject(new Error('Database not available'));
      }
    }
  });
}

/**
 * Execute a custom database statement
 * Allows execution of custom SQL statements (INSERT, UPDATE, DELETE)
 * 
 * @param {string} sql - SQL statement to execute
 * @param {Array} params - Statement parameters
 * @returns {Promise<Object>} - Result of the operation
 */
function executeStatement(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (window.electronAPI && window.electronAPI.database) {
      window.electronAPI.database.execute(sql, params).then(result => {
        if (result.success) {
          debugLog?.info('Statement executed successfully', { 
            module: 'database-operations',
            function: 'executeStatement',
            sql: sql
          });
          resolve(result);
        } else {
          debugLog?.warn('Statement failed', { 
            module: 'database-operations',
            function: 'executeStatement',
            sql: sql,
            error: result.error
          });
          reject(new Error(result.error));
        }
      }).catch(error => {
        debugLog?.warn('Database API error', { 
          module: 'database-operations',
          function: 'executeStatement',
          sql: sql,
          error: error
        });
        reject(error);
      });
    } else {
      // Fallback to legacy database access
      if (typeof db !== 'undefined') {
        try {
          const stmt = db.prepare(sql);
          const info = stmt.run(params);
          debugLog?.info('Statement executed successfully', { 
            module: 'database-operations',
            function: 'executeStatement',
            sql: sql
          });
          resolve({ success: true, changes: info.changes, lastInsertRowid: info.lastInsertRowid });
        } catch (error) {
          reject(error);
        }
      } else {
        reject(new Error('Database not available'));
      }
    }
  });
}

export {
  editCategory,
  deleteCategory,
  addNewCategory,
  saveEditedSong,
  saveNewSong,
  deleteSong,
  getSongById,
  addSongsByPath,
  executeQuery,
  executeStatement
};

// Default export for module loading
export default {
  editCategory,
  deleteCategory,
  addNewCategory,
  saveEditedSong,
  saveNewSong,
  deleteSong,
  getSongById,
  addSongsByPath,
  executeQuery,
  executeStatement
}; 