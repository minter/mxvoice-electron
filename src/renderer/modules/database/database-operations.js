/**
 * Database Operations Module
 * 
 * Handles core database operations including CRUD operations for songs and categories,
 * bulk operations, and database query management. This module provides the missing
 * database operations that were in the original renderer.js file.
 * 
 * PHASE 2 SECURITY MIGRATION: Now uses secure adapters for all database operations
 */

// Import secure adapters for Phase 2 migration
import { secureDatabase, securePath, secureFileSystem, secureStore } from '../adapters/secure-adapter.js';

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
async function editCategory(code, description) {
  try {
    debugLog?.debug('Updating category', { 
      module: 'database-operations',
      function: 'editCategory',
      code: code,
      description: description
    });

    const result = await secureDatabase.execute(
      "UPDATE categories SET description = ? WHERE code = ?",
      [description, code]
    );

    if (result.success !== false) {
      debugLog?.info(`Category ${code} updated successfully`, { 
        module: 'database-operations',
        function: 'editCategory',
        code: code,
        description: description,
        changes: result.changes || result.data?.changes
      });
      return result;
    } else {
      const error = new Error(result.error || 'Failed to update category');
      debugLog?.warn('Failed to update category', { 
        module: 'database-operations',
        function: 'editCategory',
        code: code,
        error: error.message
      });
      throw error;
    }
  } catch (error) {
    debugLog?.error('Edit category error', { 
      module: 'database-operations',
      function: 'editCategory',
      code: code,
      error: error.message
    });
    throw error;
  }
}

/**
 * Delete category from the database
 * Deletes a category and moves all songs to "Uncategorized"
 * 
 * @param {string} code - Category code to delete
 * @param {string} description - Category description for confirmation
 * @returns {Promise<Object>} - Result of the operation
 */
async function deleteCategory(code, description) {
  try {
    debugLog?.debug('Deleting category', { 
      module: 'database-operations',
      function: 'deleteCategory',
      code: code,
      description: description
    });

    // First ensure "Uncategorized" category exists
    await secureDatabase.execute(
      "INSERT OR REPLACE INTO categories VALUES(?, ?)",
      ["UNC", "Uncategorized"]
    );

    // Update all songs in this category to "Uncategorized"
    const updateResult = await secureDatabase.execute(
      "UPDATE mrvoice SET category = ? WHERE category = ?",
      ["UNC", code]
    );

    debugLog?.info(`Updated ${updateResult.changes || updateResult.data?.changes || 0} songs to uncategorized`, { 
      module: 'database-operations',
      function: 'deleteCategory',
      code: code,
      changes: updateResult.changes || updateResult.data?.changes
    });

    // Delete the category
    const deleteResult = await secureDatabase.execute(
      "DELETE FROM categories WHERE code = ?",
      [code]
    );

    if (deleteResult.success !== false) {
      debugLog?.info(`Category ${code} deleted successfully`, { 
        module: 'database-operations',
        function: 'deleteCategory',
        code: code,
        description: description,
        changes: deleteResult.changes || deleteResult.data?.changes
      });
      return deleteResult;
    } else {
      const error = new Error(deleteResult.error || 'Failed to delete category');
      debugLog?.warn('Failed to delete category', { 
        module: 'database-operations',
        function: 'deleteCategory',
        code: code,
        error: error.message
      });
      throw error;
    }
  } catch (error) {
    debugLog?.error('Delete category error', { 
      module: 'database-operations',
      function: 'deleteCategory',
      code: code,
      error: error.message
    });
    throw error;
  }
}

/**
 * Add new category to the database
 * Creates a new category with auto-generated code
 * 
 * @param {string} description - Category description
 * @returns {Promise<Object>} - Result of the operation
 */
async function addNewCategory(description) {
  try {
    let code = description.replace(/\s/g, "").substr(0, 4).toUpperCase();
    
    debugLog?.debug('Adding new category', { 
      module: 'database-operations',
      function: 'addNewCategory',
      description: description,
      baseCode: code
    });

    // Check for code collision and generate unique code
    const checkCode = async (baseCode, loopCount = 1) => {
      const testCode = loopCount === 1 ? baseCode : `${baseCode}${loopCount}`;
      
      const result = await secureDatabase.query(
        "SELECT * FROM categories WHERE code = ?",
        [testCode]
      );
      
      const data = result.data || result;
      if (data && data.length > 0) {
        debugLog?.debug(`Code collision found for ${testCode}`, { 
          module: 'database-operations',
          function: 'addNewCategory',
          testCode: testCode,
          loopCount: loopCount
        });
        return checkCode(baseCode, loopCount + 1);
      } else {
        return testCode;
      }
    };
    
    const finalCode = await checkCode(code);
    
    debugLog?.info(`Adding category ${finalCode} :: ${description}`, { 
      module: 'database-operations',
      function: 'addNewCategory',
      code: finalCode,
      description: description
    });
    
    const result = await secureDatabase.execute(
      "INSERT INTO categories VALUES (?, ?)",
      [finalCode, description]
    );

    if (result.success !== false) {
      debugLog?.info(`New category ${finalCode} added successfully`, { 
        module: 'database-operations',
        function: 'addNewCategory',
        code: finalCode,
        description: description,
        changes: result.changes || result.data?.changes
      });
      return { ...result, code: finalCode };
    } else {
      const error = new Error(result.error || 'Failed to add category');
      debugLog?.warn('Failed to add category', { 
        module: 'database-operations',
        function: 'addNewCategory',
        description: description,
        error: error.message
      });
      throw error;
    }
  } catch (error) {
    if (error.message && error.message.match(/UNIQUE constraint/)) {
      const uniqueError = new Error(`Category "${description}" already exists`);
      debugLog?.warn('Category already exists', { 
        module: 'database-operations',
        function: 'addNewCategory',
        description: description,
        error: uniqueError.message
      });
      throw uniqueError;
    } else {
      debugLog?.error('Add category error', { 
        module: 'database-operations',
        function: 'addNewCategory',
        description: description,
        error: error.message
      });
      throw error;
    }
  }
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
    if (window.secureElectronAPI && window.secureElectronAPI.database) {
      window.secureElectronAPI.database.execute(
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
      reject(new Error('Database not available'));
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
    if (window.secureElectronAPI && window.secureElectronAPI.database) {
      window.secureElectronAPI.database.execute(
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
      reject(new Error('Database not available'));
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
    if (window.secureElectronAPI && window.secureElectronAPI.database) {
      window.secureElectronAPI.database.execute(
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
      reject(new Error('Database not available'));
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
    if (window.secureElectronAPI && window.secureElectronAPI.database) {
      window.secureElectronAPI.database.query(
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
      reject(new Error('Database not available'));
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
async function executeQuery(sql, params = []) {
  try {
    debugLog?.debug('Executing database query', { 
      module: 'database-operations',
      function: 'executeQuery',
      sql: sql.substring(0, 50) + '...'
    });

    const result = await secureDatabase.query(sql, params);

    if (result.success !== false) {
      debugLog?.info('Query executed successfully', { 
        module: 'database-operations',
        function: 'executeQuery',
        sql: sql.substring(0, 50) + '...'
      });
      return result;
    } else {
      const error = new Error(result.error || 'Query failed');
      debugLog?.warn('Query failed', { 
        module: 'database-operations',
        function: 'executeQuery',
        sql: sql.substring(0, 50) + '...',
        error: error.message
      });
      throw error;
    }
  } catch (error) {
    debugLog?.error('Execute query error', { 
      module: 'database-operations',
      function: 'executeQuery',
      sql: sql.substring(0, 50) + '...',
      error: error.message
    });
    throw error;
  }
}

/**
 * Execute a custom database statement
 * Allows execution of custom SQL statements (INSERT, UPDATE, DELETE)
 * 
 * @param {string} sql - SQL statement to execute
 * @param {Array} params - Statement parameters
 * @returns {Promise<Object>} - Result of the operation
 */
async function executeStatement(sql, params = []) {
  try {
    debugLog?.debug('Executing database statement', { 
      module: 'database-operations',
      function: 'executeStatement',
      sql: sql.substring(0, 50) + '...'
    });

    const result = await secureDatabase.execute(sql, params);

    if (result.success !== false) {
      debugLog?.info('Statement executed successfully', { 
        module: 'database-operations',
        function: 'executeStatement',
        sql: sql.substring(0, 50) + '...',
        changes: result.changes || result.data?.changes
      });
      return result;
    } else {
      const error = new Error(result.error || 'Statement failed');
      debugLog?.warn('Statement failed', { 
        module: 'database-operations',
        function: 'executeStatement',
        sql: sql.substring(0, 50) + '...',
        error: error.message
      });
      throw error;
    }
  } catch (error) {
    debugLog?.error('Execute statement error', { 
      module: 'database-operations',
      function: 'executeStatement',
      sql: sql.substring(0, 50) + '...',
      error: error.message
    });
    throw error;
  }
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