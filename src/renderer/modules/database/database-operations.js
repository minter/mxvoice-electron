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

    const result = await secureDatabase.updateCategory(code, description);

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

    // The delete-category IPC handler handles ensuring UNC exists and reassigning songs
    const result = await secureDatabase.deleteCategory(code);

    if (result.success !== false) {
      debugLog?.info(`Category ${code} deleted successfully`, {
        module: 'database-operations',
        function: 'deleteCategory',
        code: code,
        description: description,
        changes: result.changes || result.data?.changes
      });
      return result;
    } else {
      const error = new Error(result.error || 'Failed to delete category');
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

    // Find unique code with a single query instead of recursive individual lookups
    const { findUniqueCategoryCode } = await import('../categories/category-data.js');
    const finalCode = await findUniqueCategoryCode(code);
    
    debugLog?.info(`Adding category ${finalCode} :: ${description}`, { 
      module: 'database-operations',
      function: 'addNewCategory',
      code: finalCode,
      description: description
    });
    
    const result = await secureDatabase.addCategory({ code: finalCode, description });

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
async function saveEditedSong(songData) {
  try {
    debugLog?.debug('Updating song', {
      module: 'database-operations',
      function: 'saveEditedSong',
      songId: songData.id,
      title: songData.title
    });

    const result = await secureDatabase.updateSong({
      id: songData.id,
      title: songData.title,
      artist: songData.artist,
      category: songData.category,
      info: songData.info
    });

    if (result.success !== false) {
      debugLog?.info(`Song ${songData.id} updated successfully`, {
        module: 'database-operations',
        function: 'saveEditedSong',
        songId: songData.id,
        title: songData.title
      });
      return result;
    } else {
      const error = new Error(result.error || 'Failed to update song');
      debugLog?.warn('Failed to update song', {
        module: 'database-operations',
        function: 'saveEditedSong',
        songId: songData.id,
        error: error.message
      });
      throw error;
    }
  } catch (error) {
    debugLog?.error('Save edited song error', {
      module: 'database-operations',
      function: 'saveEditedSong',
      songId: songData.id,
      error: error.message
    });
    throw error;
  }
}

/**
 * Save new song to the database
 * Creates a new song record in the database
 * 
 * @param {Object} songData - Song data object
 * @returns {Promise<Object>} - Result of the operation
 */
async function saveNewSong(songData) {
  try {
    debugLog?.debug('Adding new song', {
      module: 'database-operations',
      function: 'saveNewSong',
      title: songData.title,
      artist: songData.artist
    });

    const result = await secureDatabase.addSong({
      title: songData.title,
      artist: songData.artist,
      category: songData.category,
      info: songData.info,
      filename: songData.filename,
      duration: songData.duration
    });

    if (result.success !== false) {
      debugLog?.info('New song added successfully', {
        module: 'database-operations',
        function: 'saveNewSong',
        title: songData.title,
        artist: songData.artist
      });
      return result;
    } else {
      const error = new Error(result.error || 'Failed to add song');
      debugLog?.warn('Failed to add song', {
        module: 'database-operations',
        function: 'saveNewSong',
        title: songData.title,
        error: error.message
      });
      throw error;
    }
  } catch (error) {
    debugLog?.error('Save new song error', {
      module: 'database-operations',
      function: 'saveNewSong',
      title: songData.title,
      error: error.message
    });
    throw error;
  }
}

/**
 * Delete song from the database
 * Removes a song record from the database
 * 
 * @param {string} songId - Song ID to delete
 * @returns {Promise<Object>} - Result of the operation
 */
async function deleteSong(songId) {
  try {
    debugLog?.debug('Deleting song', {
      module: 'database-operations',
      function: 'deleteSong',
      songId: songId
    });

    const result = await secureDatabase.deleteSong(songId);

    if (result.success !== false) {
      debugLog?.info(`Song ${songId} deleted successfully`, {
        module: 'database-operations',
        function: 'deleteSong',
        songId: songId
      });
      return result;
    } else {
      const error = new Error(result.error || 'Failed to delete song');
      debugLog?.warn('Failed to delete song', {
        module: 'database-operations',
        function: 'deleteSong',
        songId: songId,
        error: error.message
      });
      throw error;
    }
  } catch (error) {
    debugLog?.error('Delete song error', {
      module: 'database-operations',
      function: 'deleteSong',
      songId: songId,
      error: error.message
    });
    throw error;
  }
}

/**
 * Get song by ID from the database
 * Retrieves song information by ID
 * 
 * @param {string} songId - Song ID to retrieve
 * @returns {Promise<Object>} - Result of the operation
 */
async function getSongById(songId) {
  try {
    debugLog?.debug('Getting song by ID', {
      module: 'database-operations',
      function: 'getSongById',
      songId: songId
    });

    const result = await secureDatabase.getSongById(songId);

    if (result.success !== false) {
      if (result.data && (Array.isArray(result.data) ? result.data.length > 0 : true)) {
        debugLog?.info(`Song ${songId} retrieved successfully`, {
          module: 'database-operations',
          function: 'getSongById',
          songId: songId
        });
        return result;
      } else {
        throw new Error('Song not found');
      }
    } else {
      const error = new Error(result.error || 'Failed to get song');
      debugLog?.warn('Failed to get song', {
        module: 'database-operations',
        function: 'getSongById',
        songId: songId,
        error: error.message
      });
      throw error;
    }
  } catch (error) {
    debugLog?.error('Get song by ID error', {
      module: 'database-operations',
      function: 'getSongById',
      songId: songId,
      error: error.message
    });
    throw error;
  }
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

export {
  editCategory,
  deleteCategory,
  addNewCategory,
  saveEditedSong,
  saveNewSong,
  deleteSong,
  getSongById,
  addSongsByPath
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
  addSongsByPath
};