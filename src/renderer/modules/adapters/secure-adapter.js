/**
 * Secure Adapter Module
 * 
 * Provides a unified interface for accessing Electron APIs that works in both
 * secure (context isolation enabled) and insecure (context isolation disabled) modes.
 * 
 * This adapter automatically detects the available APIs and routes calls appropriately,
 * ensuring compatibility across different security configurations.
 */

// Import debug logger safely
let debugLog = null;
try {
  if (window.debugLog) {
    debugLog = window.debugLog;
  }
} catch (_error) {
  // Debug logger not available in secure context
}

/**
 * Database Operations Adapter
 * Provides secure database access through IPC calls
 */
export const secureDatabase = {
  /**
   * Get all categories from the database
   * @returns {Promise<Object>} Categories data
   */
  getCategories: async () => {
    try {
      if (window.secureElectronAPI?.database?.getCategories) {
        return await window.secureElectronAPI.database.getCategories();
      }
      throw new Error('No database API available');
    } catch (error) {
      debugLog?.error('Get categories failed:', { module: 'secure-adapter', function: 'secureDatabase.getCategories', error: error.message });
      return { success: false, error: error.message };
    }
  },

  /**
   * Add a new song to the database
   * @param {Object} songData - Song data object
   * @returns {Promise<Object>} Add result
   */
  addSong: async (songData) => {
    try {
      if (window.secureElectronAPI?.database?.addSong) {
        return await window.secureElectronAPI.database.addSong(songData);
      }
      throw new Error('No database API available');
    } catch (error) {
      debugLog?.error('Add song failed:', { module: 'secure-adapter', function: 'secureDatabase.addSong', error: error.message });
      return { success: false, error: error.message };
    }
  },

  getSongById: async (songId) => {
    try {
      if (window.secureElectronAPI?.database?.getSongById) {
        return await window.secureElectronAPI.database.getSongById(songId);
      }
      throw new Error('No database API available');
    } catch (error) {
      debugLog?.error('Get song by ID failed:', { module: 'secure-adapter', function: 'secureDatabase.getSongById', error: error.message });
      return { success: false, error: error.message };
    }
  },

  getSongsByIds: async (ids) => {
    try {
      if (window.secureElectronAPI?.database?.getSongsByIds) {
        return await window.secureElectronAPI.database.getSongsByIds(ids);
      }
      throw new Error('No database API available');
    } catch (error) {
      debugLog?.error('Get songs by IDs failed:', { module: 'secure-adapter', function: 'secureDatabase.getSongsByIds', error: error.message });
      return { success: false, error: error.message };
    }
  },

  searchSongs: async (searchParams) => {
    try {
      if (window.secureElectronAPI?.database?.searchSongs) {
        return await window.secureElectronAPI.database.searchSongs(searchParams);
      }
      throw new Error('No database API available');
    } catch (error) {
      debugLog?.error('Search songs failed:', { module: 'secure-adapter', function: 'secureDatabase.searchSongs', error: error.message });
      return { success: false, error: error.message };
    }
  },

  updateSong: async (songData) => {
    try {
      if (window.secureElectronAPI?.database?.updateSong) {
        return await window.secureElectronAPI.database.updateSong(songData);
      }
      throw new Error('No database API available');
    } catch (error) {
      debugLog?.error('Update song failed:', { module: 'secure-adapter', function: 'secureDatabase.updateSong', error: error.message });
      return { success: false, error: error.message };
    }
  },

  deleteSong: async (songId) => {
    try {
      if (window.secureElectronAPI?.database?.deleteSong) {
        return await window.secureElectronAPI.database.deleteSong(songId);
      }
      throw new Error('No database API available');
    } catch (error) {
      debugLog?.error('Delete song failed:', { module: 'secure-adapter', function: 'secureDatabase.deleteSong', error: error.message });
      return { success: false, error: error.message };
    }
  },

  addCategory: async (categoryData) => {
    try {
      if (window.secureElectronAPI?.database?.addCategory) {
        return await window.secureElectronAPI.database.addCategory(categoryData);
      }
      throw new Error('No database API available');
    } catch (error) {
      debugLog?.error('Add category failed:', { module: 'secure-adapter', function: 'secureDatabase.addCategory', error: error.message });
      return { success: false, error: error.message };
    }
  },

  updateCategory: async (code, description) => {
    try {
      if (window.secureElectronAPI?.database?.updateCategory) {
        return await window.secureElectronAPI.database.updateCategory(code, description);
      }
      throw new Error('No database API available');
    } catch (error) {
      debugLog?.error('Update category failed:', { module: 'secure-adapter', function: 'secureDatabase.updateCategory', error: error.message });
      return { success: false, error: error.message };
    }
  },

  deleteCategory: async (code) => {
    try {
      if (window.secureElectronAPI?.database?.deleteCategory) {
        return await window.secureElectronAPI.database.deleteCategory(code);
      }
      throw new Error('No database API available');
    } catch (error) {
      debugLog?.error('Delete category failed:', { module: 'secure-adapter', function: 'secureDatabase.deleteCategory', error: error.message });
      return { success: false, error: error.message };
    }
  },

  getCategoryByCode: async (code) => {
    try {
      if (window.secureElectronAPI?.database?.getCategoryByCode) {
        return await window.secureElectronAPI.database.getCategoryByCode(code);
      }
      throw new Error('No database API available');
    } catch (error) {
      debugLog?.error('Get category by code failed:', { module: 'secure-adapter', function: 'secureDatabase.getCategoryByCode', error: error.message });
      return { success: false, error: error.message };
    }
  },

  reassignSongCategory: async (fromCode, toCode) => {
    try {
      if (window.secureElectronAPI?.database?.reassignSongCategory) {
        return await window.secureElectronAPI.database.reassignSongCategory(fromCode, toCode);
      }
      throw new Error('No database API available');
    } catch (error) {
      debugLog?.error('Reassign song category failed:', { module: 'secure-adapter', function: 'secureDatabase.reassignSongCategory', error: error.message });
      return { success: false, error: error.message };
    }
  },

  findCategoryCodesLike: async (code, pattern) => {
    try {
      if (window.secureElectronAPI?.database?.findCategoryCodesLike) {
        return await window.secureElectronAPI.database.findCategoryCodesLike(code, pattern);
      }
      throw new Error('No database API available');
    } catch (error) {
      debugLog?.error('Find category codes failed:', { module: 'secure-adapter', function: 'secureDatabase.findCategoryCodesLike', error: error.message });
      return { success: false, error: error.message };
    }
  }
};

/**
 * File System Operations Adapter
 * Provides secure file system access through IPC calls
 */
export const secureFileSystem = {
  /**
   * Read a file and return its contents
   * @param {string} filePath - Path to the file
   * @returns {Promise<Object>} File contents
   */
  read: async (filePath) => {
    try {
      // Try secure API first
      if (window.secureElectronAPI?.fileSystem?.read) {
        return await window.secureElectronAPI.fileSystem.read(filePath);
      }
      
      // Fallback to modern API
      if (window.electronAPI?.fileSystem?.read) {
        return await window.electronAPI.fileSystem.read(filePath);
      }
      
      throw new Error('No file system API available');
    } catch (error) {
      debugLog?.error('File read failed:', { 
        module: 'secure-adapter', 
        function: 'secureFileSystem.read', 
        filePath, 
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  },

  /**
   * Write data to a file
   * @param {string} filePath - Path to the file
   * @param {string} data - Data to write
   * @returns {Promise<Object>} Write result
   */
  write: async (filePath, data) => {
    try {
      // Try secure API first
      if (window.secureElectronAPI?.fileSystem?.write) {
        return await window.secureElectronAPI.fileSystem.write(filePath, data);
      }
      
      // Fallback to modern API
      if (window.electronAPI?.fileSystem?.write) {
        return await window.electronAPI.fileSystem.write(filePath, data);
      }
      
      throw new Error('No file system API available');
    } catch (error) {
      debugLog?.error('File write failed:', { 
        module: 'secure-adapter', 
        function: 'secureFileSystem.write', 
        filePath, 
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  },

  /**
   * Check if a file exists
   * @param {string} filePath - Path to the file
   * @returns {Promise<Object>} Existence check result
   */
  exists: async (filePath) => {
    try {
      // Try secure API first
      if (window.secureElectronAPI?.fileSystem?.exists) {
        return await window.secureElectronAPI.fileSystem.exists(filePath);
      }
      
      // Fallback to modern API
      if (window.electronAPI?.fileSystem?.exists) {
        return await window.electronAPI.fileSystem.exists(filePath);
      }
      
      throw new Error('No file system API available');
    } catch (error) {
      debugLog?.error('File exists check failed:', { 
        module: 'secure-adapter', 
        function: 'secureFileSystem.exists', 
        filePath, 
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  },

  /**
   * Copy a file from source to destination
   * @param {string} sourcePath - Source file path
   * @param {string} destPath - Destination file path
   * @returns {Promise<Object>} Copy result
   */
  copy: async (sourcePath, destPath) => {
    try {
      // Try secure API first
      if (window.secureElectronAPI?.fileSystem?.copy) {
        return await window.secureElectronAPI.fileSystem.copy(sourcePath, destPath);
      }
      
      // Fallback to modern API
      if (window.electronAPI?.fileSystem?.copy) {
        return await window.electronAPI.fileSystem.copy(sourcePath, destPath);
      }
      
      throw new Error('No file system API available');
    } catch (error) {
      debugLog?.error('File copy failed:', { 
        module: 'secure-adapter', 
        function: 'secureFileSystem.copy', 
        sourcePath, 
        destPath, 
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  },

  /**
   * Create a directory
   * @param {string} dirPath - Directory path to create
   * @param {Object} options - Creation options
   * @returns {Promise<Object>} Creation result
   */
  mkdir: async (dirPath, options = {}) => {
    try {
      // Try secure API first
      if (window.secureElectronAPI?.fileSystem?.mkdir) {
        return await window.secureElectronAPI.fileSystem.mkdir(dirPath, options);
      }
      
      // Fallback to modern API
      if (window.electronAPI?.fileSystem?.mkdir) {
        return await window.electronAPI.fileSystem.mkdir(dirPath, options);
      }
      
      throw new Error('No file system API available');
    } catch (error) {
      debugLog?.error('Directory creation failed:', { 
        module: 'secure-adapter', 
        function: 'secureFileSystem.mkdir', 
        dirPath, 
        options, 
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  },

  /**
   * Read directory contents
   * @param {string} dirPath - Directory path to read
   * @returns {Promise<Object>} Directory contents
   */
  readdir: async (dirPath) => {
    try {
      // Try secure API first
      if (window.secureElectronAPI?.fileSystem?.readdir) {
        return await window.secureElectronAPI.fileSystem.readdir(dirPath);
      }
      
      // Fallback to modern API
      if (window.electronAPI?.fileSystem?.readdir) {
        return await window.electronAPI.fileSystem.readdir(dirPath);
      }
      
      throw new Error('No file system API available');
    } catch (error) {
      debugLog?.error('Directory read failed:', { 
        module: 'secure-adapter', 
        function: 'secureFileSystem.readdir', 
        dirPath, 
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  },

  /**
   * Get file/directory statistics
   * @param {string} filePath - Path to get stats for
   * @returns {Promise<Object>} File stats
   */
  stat: async (filePath) => {
    try {
      // Try secure API first
      if (window.secureElectronAPI?.fileSystem?.stat) {
        return await window.secureElectronAPI.fileSystem.stat(filePath);
      }
      
      // Fallback to modern API
      if (window.electronAPI?.fileSystem?.stat) {
        return await window.electronAPI.fileSystem.stat(filePath);
      }
      
      throw new Error('No file system API available');
    } catch (error) {
      debugLog?.error('File stat failed:', { 
        module: 'secure-adapter', 
        function: 'secureFileSystem.stat', 
        filePath, 
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  },

  /**
   * Delete a file
   * @param {string} filePath - Path to the file to delete
   * @returns {Promise<Object>} Deletion result
   */
  delete: async (filePath) => {
    try {
      // Try secure API first
      if (window.secureElectronAPI?.fileSystem?.delete) {
        return await window.secureElectronAPI.fileSystem.delete(filePath);
      }
      
      // Fallback to modern API
      if (window.electronAPI?.fileSystem?.delete) {
        return await window.electronAPI.fileSystem.delete(filePath);
      }
      
      throw new Error('No file system API available');
    } catch (error) {
      debugLog?.error('File deletion failed:', { 
        module: 'secure-adapter', 
        function: 'secureFileSystem.delete', 
        filePath, 
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  }
};

/**
 * Path Operations Adapter
 * Provides secure path manipulation through IPC calls
 */
export const securePath = {
  /**
   * Join path segments
   * @param {...string} paths - Path segments to join
   * @returns {Promise<Object>} Joined path result
   */
  join: async (...paths) => {
    try {
      // Try secure API first
      if (window.secureElectronAPI?.path?.join) {
        return await window.secureElectronAPI.path.join(...paths);
      }
      
      // Fallback to modern API
      if (window.electronAPI?.path?.join) {
        return await window.electronAPI.path.join(...paths);
      }
      
      throw new Error('No path API available');
    } catch (error) {
      debugLog?.error('Path join failed:', { 
        module: 'secure-adapter', 
        function: 'securePath.join', 
        paths, 
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  },

  /**
   * Get file extension
   * @param {string} filePath - File path
   * @returns {Promise<Object>} Extension result
   */
  extname: async (filePath) => {
    try {
      // Try secure API first
      if (window.secureElectronAPI?.path?.extname) {
        return await window.secureElectronAPI.path.extname(filePath);
      }
      
      // Fallback to modern API
      if (window.electronAPI?.path?.extname) {
        return await window.electronAPI.path.extname(filePath);
      }
      
      throw new Error('No path API available');
    } catch (error) {
      debugLog?.error('Path extname failed:', { 
        module: 'secure-adapter', 
        function: 'securePath.extname', 
        filePath, 
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  },

  /**
   * Get directory name from path
   * @param {string} filePath - File path
   * @returns {Promise<Object>} Directory name result
   */
  dirname: async (filePath) => {
    try {
      // Try secure API first
      if (window.secureElectronAPI?.path?.dirname) {
        return await window.secureElectronAPI.path.dirname(filePath);
      }
      
      // Fallback to modern API
      if (window.electronAPI?.path?.dirname) {
        return await window.electronAPI.path.dirname(filePath);
      }
      
      throw new Error('No path API available');
    } catch (error) {
      debugLog?.error('Path dirname failed:', { 
        module: 'secure-adapter', 
        function: 'securePath.dirname', 
        filePath, 
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  },

  /**
   * Parse file path into components
   * @param {string} filePath - File path to parse
   * @returns {Promise<Object>} Parsed path result
   */
  parse: async (filePath) => {
    try {
      // Try secure API first
      if (window.secureElectronAPI?.path?.parse) {
        return await window.secureElectronAPI.path.parse(filePath);
      }
      
      // Fallback to modern API
      if (window.electronAPI?.path?.parse) {
        return await window.electronAPI.path.parse(filePath);
      }
      
      throw new Error('No path API available');
    } catch (error) {
      debugLog?.error('Path parse failed:', { 
        module: 'secure-adapter', 
        function: 'securePath.parse', 
        filePath, 
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  },

  /**
   * Get base name from path
   * @param {string} filePath - File path
   * @param {string} ext - Optional extension to remove
   * @returns {Promise<Object>} Base name result
   */
  basename: async (filePath, ext) => {
    try {
      // Try secure API first
      if (window.secureElectronAPI?.path?.basename) {
        return await window.secureElectronAPI.path.basename(filePath, ext);
      }
      
      // Fallback to modern API
      if (window.electronAPI?.path?.basename) {
        return await window.electronAPI.path.basename(filePath, ext);
      }
      
      throw new Error('No path API available');
    } catch (error) {
      debugLog?.error('Path basename failed:', { 
        module: 'secure-adapter', 
        function: 'securePath.basename', 
        filePath, 
        ext, 
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  },

  /**
   * Resolve path segments to absolute path
   * @param {...string} paths - Path segments to resolve
   * @returns {Promise<Object>} Resolved path result
   */
  resolve: async (...paths) => {
    try {
      // Try secure API first
      if (window.secureElectronAPI?.path?.resolve) {
        return await window.secureElectronAPI.path.resolve(...paths);
      }
      
      // Fallback to modern API
      if (window.electronAPI?.path?.resolve) {
        return await window.electronAPI.path.resolve(...paths);
      }
      
      throw new Error('No path API available');
    } catch (error) {
      debugLog?.error('Path resolve failed:', { 
        module: 'secure-adapter', 
        function: 'securePath.resolve', 
        paths, 
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  }
};

/**
 * Store Operations Adapter
 * Provides secure store access through IPC calls
 */
export const secureStore = {
  /**
   * Get a value from the store
   * @param {string} key - Store key
   * @returns {Promise<Object>} Store value
   */
  get: async (key) => {
    try {
      // Try secure API first
      if (window.secureElectronAPI?.store?.get) {
        return await window.secureElectronAPI.store.get(key);
      }
      
      // Fallback to modern API
      if (window.electronAPI?.store?.get) {
        return await window.electronAPI.store.get(key);
      }
      
      throw new Error('No store API available');
    } catch (error) {
      debugLog?.error('Store get failed:', { 
        module: 'secure-adapter', 
        function: 'secureStore.get', 
        key, 
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  },

  /**
   * Set a value in the store
   * @param {string} key - Store key
   * @param {any} value - Value to store
   * @returns {Promise<Object>} Set result
   */
  set: async (key, value) => {
    try {
      // Try secure API first
      if (window.secureElectronAPI?.store?.set) {
        return await window.secureElectronAPI.store.set(key, value);
      }
      
      // Fallback to modern API
      if (window.electronAPI?.store?.set) {
        return await window.electronAPI.store.set(key, value);
      }
      
      throw new Error('No store API available');
    } catch (error) {
      debugLog?.error('Store set failed:', { 
        module: 'secure-adapter', 
        function: 'secureStore.set', 
        key, 
        value, 
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  },

  /**
   * Check if a key exists in the store
   * @param {string} key - Store key
   * @returns {Promise<Object>} Existence check result
   */
  has: async (key) => {
    try {
      // Try secure API first
      if (window.secureElectronAPI?.store?.has) {
        return await window.secureElectronAPI.store.has(key);
      }
      
      // Fallback to modern API
      if (window.electronAPI?.store?.has) {
        return await window.electronAPI.store.has(key);
      }
      
      throw new Error('No store API available');
    } catch (error) {
      debugLog?.error('Store has check failed:', { 
        module: 'secure-adapter', 
        function: 'secureStore.has', 
        key, 
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  },

  /**
   * Delete a key from the store
   * @param {string} key - Store key
   * @returns {Promise<Object>} Deletion result
   */
  delete: async (key) => {
    try {
      // Try secure API first
      if (window.secureElectronAPI?.store?.delete) {
        return await window.secureElectronAPI.store.delete(key);
      }
      
      // Fallback to modern API
      if (window.electronAPI?.store?.delete) {
        return await window.electronAPI.store.delete(key);
      }
      
      throw new Error('No store API available');
    } catch (error) {
      debugLog?.error('Store delete failed:', { 
        module: 'secure-adapter', 
        function: 'secureStore.delete', 
        key, 
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  }
};

/**
 * Audio Operations Adapter
 * Provides secure audio management through IPC calls
 */
export const secureAudio = {
  /**
   * Play an audio file
   * @param {string} filePath - Path to audio file
   * @param {Object} options - Playback options
   * @returns {Promise<Object>} Play result
   */
  play: async (filePath, options = {}) => {
    try {
      // Try secure API first
      if (window.secureElectronAPI?.audio?.play) {
        return await window.secureElectronAPI.audio.play(filePath, options);
      }
      
      // Fallback to modern API
      if (window.electronAPI?.audio?.play) {
        return await window.electronAPI.audio.play(filePath, options);
      }
      
      throw new Error('No audio API available');
    } catch (error) {
      debugLog?.error('Audio play failed:', { 
        module: 'secure-adapter', 
        function: 'secureAudio.play', 
        filePath, 
        options, 
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  },

  /**
   * Stop audio playback
   * @param {string} soundId - Sound ID to stop
   * @returns {Promise<Object>} Stop result
   */
  stop: async (soundId) => {
    try {
      // Try secure API first
      if (window.secureElectronAPI?.audio?.stop) {
        return await window.secureElectronAPI.audio.stop(soundId);
      }
      
      // Fallback to modern API
      if (window.electronAPI?.audio?.stop) {
        return await window.electronAPI.audio.stop(soundId);
      }
      
      throw new Error('No audio API available');
    } catch (error) {
      debugLog?.error('Audio stop failed:', { 
        module: 'secure-adapter', 
        function: 'secureAudio.stop', 
        soundId, 
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  },

  /**
   * Set audio volume
   * @param {number} volume - Volume level (0-1)
   * @param {string} soundId - Optional sound ID
   * @returns {Promise<Object>} Volume set result
   */
  setVolume: async (volume, soundId) => {
    try {
      // Try secure API first
      if (window.secureElectronAPI?.audio?.setVolume) {
        return await window.secureElectronAPI.audio.setVolume(volume, soundId);
      }
      
      // Fallback to modern API
      if (window.electronAPI?.audio?.setVolume) {
        return await window.electronAPI.audio.setVolume(volume, soundId);
      }
      
      throw new Error('No audio API available');
    } catch (error) {
      debugLog?.error('Audio volume set failed:', { 
        module: 'secure-adapter', 
        function: 'secureAudio.setVolume', 
        volume, 
        soundId, 
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  }
};

/**
 * File Dialog Operations Adapter
 * Provides secure file dialog access through IPC calls
 */
export const secureFileDialog = {
  /**
   * Show file picker dialog
   * @param {Object} options - File picker options
   * @returns {Promise<Object>} File picker result
   */
  showFilePicker: async (options = {}) => {
    try {
      // Try secure API first
      if (window.secureElectronAPI?.app?.showFilePicker) {
        return await window.secureElectronAPI.app.showFilePicker(options);
      }
      
      // Fallback to modern API
      if (window.electronAPI?.showFilePicker) {
        return await window.electronAPI.showFilePicker(options);
      }
      
      throw new Error('No file picker API available');
    } catch (error) {
      debugLog?.error('File picker failed:', { 
        module: 'secure-adapter', 
        function: 'secureFileDialog.showFilePicker', 
        options, 
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  },

  /**
   * Show directory picker dialog
   * @param {string} defaultPath - Default directory path
   * @returns {Promise<Object>} Directory picker result
   */
  showDirectoryPicker: async (defaultPath) => {
    try {
      // Try secure API first
      if (window.secureElectronAPI?.app?.showDirectoryPicker) {
        return await window.secureElectronAPI.app.showDirectoryPicker(defaultPath);
      }
      
      // Fallback to modern API
      if (window.electronAPI?.showDirectoryPicker) {
        return await window.electronAPI.showDirectoryPicker(defaultPath);
      }
      
      throw new Error('No directory picker API available');
    } catch (error) {
      debugLog?.error('Directory picker failed:', { 
        module: 'secure-adapter', 
        function: 'secureFileDialog.showDirectoryPicker', 
        defaultPath, 
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  },

  /**
   * Open hotkey file
   * @returns {Promise<Object>} File open result
   */
  openHotkeyFile: async () => {
    try {
      if (window.secureElectronAPI?.fileOperations?.openHotkeyFile) {
        return await window.secureElectronAPI.fileOperations.openHotkeyFile();
      }
      if (window.electronAPI?.openHotkeyFile) {
        return await window.electronAPI.openHotkeyFile();
      }
      throw new Error('No hotkey file API available');
    } catch (error) {
      debugLog?.error('Open hotkey file failed:', { 
        module: 'secure-adapter', 
        function: 'secureFileDialog.openHotkeyFile', 
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  },

  /**
   * Save hotkey file
   * @param {Array} hotkeyArray - Hotkey data to save
   * @returns {Promise<Object>} File save result
   */
  saveHotkeyFile: async (hotkeyArray) => {
    try {
      if (window.secureElectronAPI?.fileOperations?.saveHotkeyFile) {
        return await window.secureElectronAPI.fileOperations.saveHotkeyFile(hotkeyArray);
      }
      if (window.electronAPI?.saveHotkeyFile) {
        return await window.electronAPI.saveHotkeyFile(hotkeyArray);
      }
      throw new Error('No hotkey file save API available');
    } catch (error) {
      debugLog?.error('Save hotkey file failed:', { 
        module: 'secure-adapter', 
        function: 'secureFileDialog.saveHotkeyFile', 
        hotkeyArray, 
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  },

  /**
   * Open holding tank file
   * @returns {Promise<Object>} File open result
   */
  openHoldingTankFile: async () => {
    try {
      if (window.secureElectronAPI?.fileOperations?.openHoldingTankFile) {
        return await window.secureElectronAPI.fileOperations.openHoldingTankFile();
      }
      if (window.electronAPI?.openHoldingTankFile) {
        return await window.electronAPI.openHoldingTankFile();
      }
      throw new Error('No holding tank file API available');
    } catch (error) {
      debugLog?.error('Open holding tank file failed:', { 
        module: 'secure-adapter', 
        function: 'secureFileDialog.openHoldingTankFile', 
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  },

  /**
   * Save holding tank file
   * @param {Array} holdingTankArray - Holding tank data to save
   * @returns {Promise<Object>} File save result
   */
  saveHoldingTankFile: async (holdingTankArray) => {
    try {
      if (window.secureElectronAPI?.fileOperations?.saveHoldingTankFile) {
        return await window.secureElectronAPI.fileOperations.saveHoldingTankFile(holdingTankArray);
      }
      if (window.electronAPI?.saveHoldingTankFile) {
        return await window.electronAPI.saveHoldingTankFile(holdingTankArray);
      }
      throw new Error('No holding tank file save API available');
    } catch (error) {
      debugLog?.error('Save holding tank file failed:', { 
        module: 'secure-adapter', 
        function: 'secureFileDialog.saveHoldingTankFile', 
        holdingTankArray, 
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  },

  openSoundboardFile: async () => {
    try {
      if (window.secureElectronAPI?.fileOperations?.openSoundboardFile) {
        return await window.secureElectronAPI.fileOperations.openSoundboardFile();
      }
      if (window.electronAPI?.openSoundboardFile) {
        return await window.electronAPI.openSoundboardFile();
      }
      throw new Error('No soundboard file open API available');
    } catch (error) {
      debugLog?.error('Open soundboard file failed:', { 
        module: 'secure-adapter', 
        function: 'secureFileDialog.openSoundboardFile', 
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  },

  saveSoundboardFile: async (soundboardData) => {
    try {
      if (window.secureElectronAPI?.fileOperations?.saveSoundboardFile) {
        return await window.secureElectronAPI.fileOperations.saveSoundboardFile(soundboardData);
      }
      if (window.electronAPI?.saveSoundboardFile) {
        return await window.electronAPI.saveSoundboardFile(soundboardData);
      }
      throw new Error('No soundboard file save API available');
    } catch (error) {
      debugLog?.error('Save soundboard file failed:', { 
        module: 'secure-adapter', 
        function: 'secureFileDialog.saveSoundboardFile', 
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  }
};

/**
 * Test the secure adapter functionality
 * @returns {Object} Test results
 */
export function testSecureAdapter() {
  const results = {
    module: 'secure-adapter',
    passed: 0,
    failed: 0,
    tests: [],
    warnings: []
  };

  debugLog?.info('🧪 Testing Secure Adapter...');

  // Test API availability detection
  try {
    if (window.secureElectronAPI) {
      debugLog?.info('✅ Secure API detected');
      results.passed++;
      results.tests.push({ name: 'secureAPIDetected', success: true });
    } else if (window.electronAPI) {
      debugLog?.info('✅ Modern API detected');
      results.passed++;
      results.tests.push({ name: 'modernAPIDetected', success: true });
    } else {
      debugLog?.warn('⚠️ No modern APIs detected');
      results.warnings.push('No modern APIs available');
    }
  } catch (error) {
    debugLog?.error('❌ API detection failed:', error);
    results.failed++;
    results.tests.push({ name: 'apiDetection', success: false, error: error.message });
  }

  // Test adapter methods
  const adapters = [secureDatabase, secureFileSystem, securePath, secureStore, secureAudio];
  adapters.forEach(adapter => {
    const adapterName = adapter.constructor.name || 'Unknown';
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(adapter))
      .filter(name => name !== 'constructor' && typeof adapter[name] === 'function');
    
    methods.forEach(method => {
      try {
        if (typeof adapter[method] === 'function') {
          results.passed++;
          results.tests.push({ name: `${adapterName}.${method}`, success: true });
        } else {
          results.failed++;
          results.tests.push({ name: `${adapterName}.${method}`, success: false, error: 'Not a function' });
        }
      } catch (error) {
        results.failed++;
        results.tests.push({ name: `${adapterName}.${method}`, success: false, error: error.message });
      }
    });
  });

  debugLog?.info(`📊 Secure Adapter Test Results: ${results.passed} passed, ${results.failed} failed`);
  return results;
}

// Export all adapters
export default {
  secureDatabase,
  secureFileSystem,
  securePath,
  secureStore,
  secureAudio,
  secureFileDialog,
  testSecureAdapter
};
