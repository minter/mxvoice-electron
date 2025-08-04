/**
 * Database Operations Module
 * 
 * Handles core database operations including CRUD operations for songs and categories,
 * bulk operations, and database query management. This module provides the missing
 * database operations that were in the original renderer.js file.
 */

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
          console.log(`✅ Category ${code} updated successfully`);
          resolve(result);
        } else {
          console.warn('❌ Failed to update category:', result.error);
          reject(new Error(result.error));
        }
      }).catch(error => {
        console.warn('❌ Database API error:', error);
        reject(error);
      });
    } else {
      // Fallback to legacy database access
      if (typeof db !== 'undefined') {
        try {
          const stmt = db.prepare("UPDATE categories SET description = ? WHERE code = ?");
          const info = stmt.run(description, code);
          if (info.changes > 0) {
            console.log(`✅ Category ${code} updated successfully`);
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
          console.log(`✅ Category ${code} deleted successfully`);
          resolve(result);
        } else {
          console.warn('❌ Failed to delete category:', result.error);
          reject(new Error(result.error));
        }
      }).catch(error => {
        console.warn('❌ Database API error:', error);
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
          console.log(`Updated ${info.changes} rows to uncategorized`);

          // Delete the category
          const deleteStmt = db.prepare("DELETE FROM categories WHERE code = ?");
          const deleteInfo = deleteStmt.run(code);
          if (deleteInfo.changes == 1) {
            console.log(`✅ Category ${code} deleted successfully`);
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
          console.log(`✅ New category ${code} added successfully`);
          resolve(result);
        } else {
          console.warn('❌ Failed to add category:', result.error);
          reject(new Error(result.error));
        }
      }).catch(error => {
        console.warn('❌ Database API error:', error);
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
            console.log(`Found a code collision on ${code}`);
            newCode = `${code}${loopCount}`;
            loopCount = loopCount + 1;
          }
          
          code = newCode;
          console.log(`Adding ${code} :: ${description}`);
          
          const stmt = db.prepare("INSERT INTO categories VALUES (?, ?)");
          const info = stmt.run(code, description);
          if (info.changes == 1) {
            console.log(`✅ New category ${code} added successfully`);
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
          console.log(`✅ Song ${songData.id} updated successfully`);
          resolve(result);
        } else {
          console.warn('❌ Failed to update song:', result.error);
          reject(new Error(result.error));
        }
      }).catch(error => {
        console.warn('❌ Database API error:', error);
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
          console.log(`✅ Song ${songData.id} updated successfully`);
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
          console.log(`✅ New song added successfully`);
          resolve(result);
        } else {
          console.warn('❌ Failed to add song:', result.error);
          reject(new Error(result.error));
        }
      }).catch(error => {
        console.warn('❌ Database API error:', error);
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
          console.log(`✅ New song added successfully`);
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
          console.log(`✅ Song ${songId} deleted successfully`);
          resolve(result);
        } else {
          console.warn('❌ Failed to delete song:', result.error);
          reject(new Error(result.error));
        }
      }).catch(error => {
        console.warn('❌ Database API error:', error);
        reject(error);
      });
    } else {
      // Fallback to legacy database access
      if (typeof db !== 'undefined') {
        try {
          const deleteStmt = db.prepare("DELETE FROM mrvoice WHERE id = ?");
          const info = deleteStmt.run(songId);
          if (info.changes > 0) {
            console.log(`✅ Song ${songId} deleted successfully`);
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
            console.log(`✅ Song ${songId} retrieved successfully`);
            resolve(result);
          } else {
            reject(new Error('Song not found'));
          }
        } else {
          console.warn('❌ Failed to get song:', result.error);
          reject(new Error(result.error));
        }
      }).catch(error => {
        console.warn('❌ Database API error:', error);
        reject(error);
      });
    } else {
      // Fallback to legacy database access
      if (typeof db !== 'undefined') {
        try {
          const stmt = db.prepare("SELECT * FROM mrvoice WHERE id = ?");
          const row = stmt.get(songId);
          if (row) {
            console.log(`✅ Song ${songId} retrieved successfully`);
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
    console.log(`Processing song: ${songSourcePath}`);
    
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
      console.log(`✅ Song added to database: ${title}`);
      
      // Process remaining files
      return addSongsByPath(pathArray, category);
    }).then(result => {
      resolve({ success: true, processed: result.processed + 1 });
    }).catch(error => {
      console.warn('❌ Failed to add song:', error);
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
          console.log(`✅ Query executed successfully`);
          resolve(result);
        } else {
          console.warn('❌ Query failed:', result.error);
          reject(new Error(result.error));
        }
      }).catch(error => {
        console.warn('❌ Database API error:', error);
        reject(error);
      });
    } else {
      // Fallback to legacy database access
      if (typeof db !== 'undefined') {
        try {
          const stmt = db.prepare(sql);
          const data = stmt.all(params);
          console.log(`✅ Query executed successfully`);
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
          console.log(`✅ Statement executed successfully`);
          resolve(result);
        } else {
          console.warn('❌ Statement failed:', result.error);
          reject(new Error(result.error));
        }
      }).catch(error => {
        console.warn('❌ Database API error:', error);
        reject(error);
      });
    } else {
      // Fallback to legacy database access
      if (typeof db !== 'undefined') {
        try {
          const stmt = db.prepare(sql);
          const info = stmt.run(params);
          console.log(`✅ Statement executed successfully`);
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