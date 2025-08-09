/**
 * Secure Adapter Layer
 * 
 * Provides a unified interface that works in both insecure (current) and secure 
 * (context isolation) modes. This allows for gradual migration without breaking 
 * existing functionality.
 */

// Import debug logger safely
let debugLog = null;
try {
  if (window.debugLog) {
    debugLog = window.debugLog;
  }
} catch (error) {
  // Debug logger not available
}

/**
 * Secure Database Adapter
 * Provides database operations that work in both insecure and secure modes
 */
export const secureDatabase = {
  /**
   * Execute a database query
   * @param {string} sql - SQL query string
   * @param {Array} params - Query parameters
   * @returns {Promise<Object>} Query result
   */
  async query(sql, params = []) {
    try {
      if (window.secureElectronAPI) {
        // Secure mode - use contextBridge API
        debugLog?.debug('Using secure database API for query', { 
          module: 'secure-adapter',
          function: 'secureDatabase.query',
          sql: sql.substring(0, 50) + '...'
        });
        return await window.secureElectronAPI.database.query(sql, params);
      } else if (window.electronAPI?.database) {
        // Modern API fallback
        debugLog?.debug('Using modern database API for query', { 
          module: 'secure-adapter',
          function: 'secureDatabase.query' 
        });
        return await window.electronAPI.database.query(sql, params);
      } else if (window.db) {
        // Legacy direct access (current insecure mode)
        debugLog?.debug('Using legacy database API for query', { 
          module: 'secure-adapter',
          function: 'secureDatabase.query' 
        });
        try {
          const result = window.db.prepare(sql).all(params);
          return { success: true, data: result };
        } catch (error) {
          throw new Error(`Database query failed: ${error.message}`);
        }
      } else {
        throw new Error('No database API available');
      }
    } catch (error) {
      debugLog?.error('Database query error:', { 
        module: 'secure-adapter',
        function: 'secureDatabase.query',
        error: error.message 
      });
      throw error;
    }
  },
  
  /**
   * Execute a database statement (INSERT, UPDATE, DELETE)
   * @param {string} sql - SQL statement string
   * @param {Array} params - Statement parameters
   * @returns {Promise<Object>} Execution result
   */
  async execute(sql, params = []) {
    try {
      if (window.secureElectronAPI) {
        debugLog?.debug('Using secure database API for execute', { 
          module: 'secure-adapter',
          function: 'secureDatabase.execute' 
        });
        return await window.secureElectronAPI.database.execute(sql, params);
      } else if (window.electronAPI?.database) {
        debugLog?.debug('Using modern database API for execute', { 
          module: 'secure-adapter',
          function: 'secureDatabase.execute' 
        });
        return await window.electronAPI.database.execute(sql, params);
      } else if (window.db) {
        debugLog?.debug('Using legacy database API for execute', { 
          module: 'secure-adapter',
          function: 'secureDatabase.execute' 
        });
        try {
          const result = window.db.prepare(sql).run(params);
          return { 
            success: true, 
            data: result,
            changes: result.changes, 
            lastInsertRowid: result.lastInsertRowid 
          };
        } catch (error) {
          throw new Error(`Database execute failed: ${error.message}`);
        }
      } else {
        throw new Error('No database API available');
      }
    } catch (error) {
      debugLog?.error('Database execute error:', { 
        module: 'secure-adapter',
        function: 'secureDatabase.execute',
        error: error.message 
      });
      throw error;
    }
  },

  /**
   * Get all categories
   * @returns {Promise<Object>} Categories result
   */
  async getCategories() {
    try {
      if (window.secureElectronAPI) {
        return await window.secureElectronAPI.database.getCategories();
      } else if (window.electronAPI?.database) {
        return await window.electronAPI.database.getCategories();
      } else {
        return await this.query('SELECT * FROM categories ORDER BY description ASC');
      }
    } catch (error) {
      debugLog?.error('Get categories error:', { 
        module: 'secure-adapter',
        function: 'secureDatabase.getCategories',
        error: error.message 
      });
      throw error;
    }
  },

  /**
   * Add a new song
   * @param {Object} songData - Song data
   * @returns {Promise<Object>} Add result
   */
  async addSong(songData) {
    try {
      if (window.secureElectronAPI) {
        return await window.secureElectronAPI.database.addSong(songData);
      } else if (window.electronAPI?.database) {
        return await window.electronAPI.database.addSong(songData);
      } else {
        const sql = `
          INSERT INTO mrvoice (title, artist, category, info, filename, duration)
          VALUES (?, ?, ?, ?, ?, ?)
        `;
        return await this.execute(sql, [
          songData.title, songData.artist, songData.category,
          songData.info, songData.filename, songData.duration
        ]);
      }
    } catch (error) {
      debugLog?.error('Add song error:', { 
        module: 'secure-adapter',
        function: 'secureDatabase.addSong',
        error: error.message 
      });
      throw error;
    }
  }
};

/**
 * Secure File System Adapter
 * Provides file operations that work in both insecure and secure modes
 */
export const secureFileSystem = {
  /**
   * Read a file
   * @param {string} filePath - Path to file
   * @returns {Promise<Object>} File content result
   */
  async read(filePath) {
    try {
      if (window.secureElectronAPI) {
        debugLog?.debug('Using secure file API for read', { 
          module: 'secure-adapter',
          function: 'secureFileSystem.read' 
        });
        return await window.secureElectronAPI.fileSystem.read(filePath);
      } else if (window.electronAPI?.fileSystem) {
        debugLog?.debug('Using modern file API for read', { 
          module: 'secure-adapter',
          function: 'secureFileSystem.read' 
        });
        return await window.electronAPI.fileSystem.read(filePath);
      } else if (window.fs) {
        debugLog?.debug('Using legacy file API for read', { 
          module: 'secure-adapter',
          function: 'secureFileSystem.read' 
        });
        try {
          const data = window.fs.readFileSync(filePath, 'utf8');
          return { success: true, data };
        } catch (error) {
          throw new Error(`File read failed: ${error.message}`);
        }
      } else {
        throw new Error('No file system API available');
      }
    } catch (error) {
      debugLog?.error('File read error:', { 
        module: 'secure-adapter',
        function: 'secureFileSystem.read',
        error: error.message 
      });
      throw error;
    }
  },

  /**
   * Write a file
   * @param {string} filePath - Path to file
   * @param {string} data - File content
   * @returns {Promise<Object>} Write result
   */
  async write(filePath, data) {
    try {
      if (window.secureElectronAPI) {
        return await window.secureElectronAPI.fileSystem.write(filePath, data);
      } else if (window.electronAPI?.fileSystem) {
        return await window.electronAPI.fileSystem.write(filePath, data);
      } else if (window.fs) {
        try {
          window.fs.writeFileSync(filePath, data, 'utf8');
          return { success: true };
        } catch (error) {
          throw new Error(`File write failed: ${error.message}`);
        }
      } else {
        throw new Error('No file system API available');
      }
    } catch (error) {
      debugLog?.error('File write error:', { 
        module: 'secure-adapter',
        function: 'secureFileSystem.write',
        error: error.message 
      });
      throw error;
    }
  },

  /**
   * Check if file exists
   * @param {string} filePath - Path to file
   * @returns {Promise<Object>} Exists result
   */
  async exists(filePath) {
    try {
      if (window.secureElectronAPI) {
        return await window.secureElectronAPI.fileSystem.exists(filePath);
      } else if (window.electronAPI?.fileSystem) {
        return await window.electronAPI.fileSystem.exists(filePath);
      } else if (window.fs) {
        try {
          const exists = window.fs.existsSync(filePath);
          return { success: true, exists };
        } catch (error) {
          throw new Error(`File exists check failed: ${error.message}`);
        }
      } else {
        throw new Error('No file system API available');
      }
    } catch (error) {
      debugLog?.error('File exists error:', { 
        module: 'secure-adapter',
        function: 'secureFileSystem.exists',
        error: error.message 
      });
      throw error;
    }
  },

  /**
   * Copy a file
   * @param {string} sourcePath - Source file path
   * @param {string} destPath - Destination file path
   * @returns {Promise<Object>} Copy result
   */
  async copy(sourcePath, destPath) {
    try {
      if (window.secureElectronAPI) {
        debugLog?.debug('Using secure file API for copy', { 
          module: 'secure-adapter',
          function: 'secureFileSystem.copy' 
        });
        return await window.secureElectronAPI.fileSystem.copy(sourcePath, destPath);
      } else if (window.electronAPI?.fileSystem) {
        debugLog?.debug('Using modern file API for copy', { 
          module: 'secure-adapter',
          function: 'secureFileSystem.copy' 
        });
        return await window.electronAPI.fileSystem.copy(sourcePath, destPath);
      } else if (window.fs) {
        debugLog?.debug('Using legacy file API for copy', { 
          module: 'secure-adapter',
          function: 'secureFileSystem.copy' 
        });
        try {
          window.fs.copyFileSync(sourcePath, destPath);
          return { success: true };
        } catch (error) {
          throw new Error(`File copy failed: ${error.message}`);
        }
      } else {
        throw new Error('No file system API available');
      }
    } catch (error) {
      debugLog?.error('File copy error:', { 
        module: 'secure-adapter',
        function: 'secureFileSystem.copy',
        error: error.message 
      });
      throw error;
    }
  },

  /**
   * Read directory contents
   * @param {string} dirPath - Directory path
   * @returns {Promise<Object>} Directory listing result
   */
  async readdir(dirPath) {
    try {
      if (window.secureElectronAPI) {
        debugLog?.debug('Using secure file API for readdir', { 
          module: 'secure-adapter',
          function: 'secureFileSystem.readdir' 
        });
        return await window.secureElectronAPI.fileSystem.readdir(dirPath);
      } else if (window.electronAPI?.fileSystem) {
        debugLog?.debug('Using modern file API for readdir', { 
          module: 'secure-adapter',
          function: 'secureFileSystem.readdir' 
        });
        return await window.electronAPI.fileSystem.readdir(dirPath);
      } else if (window.fs) {
        debugLog?.debug('Using legacy file API for readdir', { 
          module: 'secure-adapter',
          function: 'secureFileSystem.readdir' 
        });
        try {
          const data = window.fs.readdirSync(dirPath);
          return { success: true, data };
        } catch (error) {
          throw new Error(`Directory read failed: ${error.message}`);
        }
      } else {
        throw new Error('No file system API available');
      }
    } catch (error) {
      debugLog?.error('Directory read error:', { 
        module: 'secure-adapter',
        function: 'secureFileSystem.readdir',
        error: error.message 
      });
      throw error;
    }
  },

  /**
   * Get file/directory stats
   * @param {string} filePath - File or directory path
   * @returns {Promise<Object>} File stat result
   */
  async stat(filePath) {
    try {
      if (window.secureElectronAPI) {
        debugLog?.debug('Using secure file API for stat', { 
          module: 'secure-adapter',
          function: 'secureFileSystem.stat' 
        });
        return await window.secureElectronAPI.fileSystem.stat(filePath);
      } else if (window.electronAPI?.fileSystem) {
        debugLog?.debug('Using modern file API for stat', { 
          module: 'secure-adapter',
          function: 'secureFileSystem.stat' 
        });
        return await window.electronAPI.fileSystem.stat(filePath);
      } else if (window.fs) {
        debugLog?.debug('Using legacy file API for stat', { 
          module: 'secure-adapter',
          function: 'secureFileSystem.stat' 
        });
        try {
          const data = window.fs.statSync(filePath);
          return { success: true, data };
        } catch (error) {
          throw new Error(`File stat failed: ${error.message}`);
        }
      } else {
        throw new Error('No file system API available');
      }
    } catch (error) {
      debugLog?.error('File stat error:', { 
        module: 'secure-adapter',
        function: 'secureFileSystem.stat',
        error: error.message 
      });
      throw error;
    }
  },

  /**
   * Delete a file
   * @param {string} filePath - File path to delete
   * @returns {Promise<Object>} Delete result
   */
  async delete(filePath) {
    try {
      if (window.secureElectronAPI) {
        debugLog?.debug('Using secure file API for delete', { 
          module: 'secure-adapter',
          function: 'secureFileSystem.delete' 
        });
        return await window.secureElectronAPI.fileSystem.delete(filePath);
      } else if (window.electronAPI?.fileSystem) {
        debugLog?.debug('Using modern file API for delete', { 
          module: 'secure-adapter',
          function: 'secureFileSystem.delete' 
        });
        return await window.electronAPI.fileSystem.delete(filePath);
      } else if (window.fs) {
        debugLog?.debug('Using legacy file API for delete', { 
          module: 'secure-adapter',
          function: 'secureFileSystem.delete' 
        });
        try {
          window.fs.unlinkSync(filePath);
          return { success: true };
        } catch (error) {
          throw new Error(`File delete failed: ${error.message}`);
        }
      } else {
        throw new Error('No file system API available');
      }
    } catch (error) {
      debugLog?.error('File delete error:', { 
        module: 'secure-adapter',
        function: 'secureFileSystem.delete',
        error: error.message 
      });
      throw error;
    }
  }
};

/**
 * Secure Path Adapter
 * Provides path operations that work in both insecure and secure modes
 */
export const securePath = {
  /**
   * Join path segments
   * @param {...string} paths - Path segments to join
   * @returns {Promise<string>} Joined path
   */
  async join(...paths) {
    try {
      if (window.secureElectronAPI) {
        const result = await window.secureElectronAPI.path.join(...paths);
        return result.data || result;
      } else if (window.electronAPI?.path) {
        const result = await window.electronAPI.path.join(...paths);
        return result.data || result;
      } else if (window.path) {
        return window.path.join(...paths);
      } else {
        throw new Error('No path API available');
      }
    } catch (error) {
      debugLog?.error('Path join error:', { 
        module: 'secure-adapter',
        function: 'securePath.join',
        error: error.message 
      });
      throw error;
    }
  },

  /**
   * Get file extension
   * @param {string} filePath - File path
   * @returns {Promise<string>} File extension
   */
  async extname(filePath) {
    try {
      if (window.secureElectronAPI) {
        const result = await window.secureElectronAPI.path.extname(filePath);
        return result.data || result;
      } else if (window.electronAPI?.path) {
        const result = await window.electronAPI.path.extname(filePath);
        return result.data || result;
      } else if (window.path) {
        return window.path.extname(filePath);
      } else {
        throw new Error('No path API available');
      }
    } catch (error) {
      debugLog?.error('Path extname error:', { 
        module: 'secure-adapter',
        function: 'securePath.extname',
        error: error.message 
      });
      throw error;
    }
  },

  /**
   * Get directory name
   * @param {string} filePath - File path
   * @returns {Promise<string>} Directory name
   */
  async dirname(filePath) {
    try {
      if (window.secureElectronAPI) {
        const result = await window.secureElectronAPI.path.dirname(filePath);
        return result.data || result;
      } else if (window.electronAPI?.path) {
        const result = await window.electronAPI.path.dirname(filePath);
        return result.data || result;
      } else if (window.path) {
        return window.path.dirname(filePath);
      } else {
        throw new Error('No path API available');
      }
    } catch (error) {
      debugLog?.error('Path dirname error:', { 
        module: 'secure-adapter',
        function: 'securePath.dirname',
        error: error.message 
      });
      throw error;
    }
  },

  /**
   * Parse a file path into components
   * @param {string} filePath - File path to parse
   * @returns {Promise<Object>} Path components (dir, name, ext, base, root)
   */
  async parse(filePath) {
    try {
      if (window.secureElectronAPI) {
        const result = await window.secureElectronAPI.path.parse(filePath);
        return result.data || result;
      } else if (window.electronAPI?.path) {
        const result = await window.electronAPI.path.parse(filePath);
        return result.data || result;
      } else if (window.path) {
        return window.path.parse(filePath);
      } else {
        throw new Error('No path API available');
      }
    } catch (error) {
      debugLog?.error('Path parse error:', { 
        module: 'secure-adapter',
        function: 'securePath.parse',
        error: error.message 
      });
      throw error;
    }
  },

  /**
   * Get the basename of a path
   * @param {string} filePath - File path
   * @param {string} [ext] - Optional extension to remove
   * @returns {Promise<string>} Base name
   */
  async basename(filePath, ext) {
    try {
      if (window.secureElectronAPI) {
        const result = await window.secureElectronAPI.path.basename(filePath, ext);
        return result.data || result;
      } else if (window.electronAPI?.path) {
        const result = await window.electronAPI.path.basename(filePath, ext);
        return result.data || result;
      } else if (window.path) {
        return window.path.basename(filePath, ext);
      } else {
        throw new Error('No path API available');
      }
    } catch (error) {
      debugLog?.error('Path basename error:', { 
        module: 'secure-adapter',
        function: 'securePath.basename',
        error: error.message 
      });
      throw error;
    }
  },

  /**
   * Resolve path segments into an absolute path
   * @param {...string} paths - Path segments to resolve
   * @returns {Promise<string>} Resolved absolute path
   */
  async resolve(...paths) {
    try {
      if (window.secureElectronAPI) {
        const result = await window.secureElectronAPI.path.resolve(...paths);
        return result.data || result;
      } else if (window.electronAPI?.path) {
        const result = await window.electronAPI.path.resolve(...paths);
        return result.data || result;
      } else if (window.path) {
        return window.path.resolve(...paths);
      } else {
        throw new Error('No path API available');
      }
    } catch (error) {
      debugLog?.error('Path resolve error:', { 
        module: 'secure-adapter',
        function: 'securePath.resolve',
        error: error.message 
      });
      throw error;
    }
  }
};

/**
 * Secure Store Adapter
 * Provides store operations that work in both insecure and secure modes
 */
export const secureStore = {
  /**
   * Get a value from store
   * @param {string} key - Store key
   * @returns {Promise<any>} Store value
   */
  async get(key) {
    try {
      if (window.secureElectronAPI) {
        const result = await window.secureElectronAPI.store.get(key);
        return result.value !== undefined ? result.value : result.data;
      } else if (window.electronAPI?.store) {
        const result = await window.electronAPI.store.get(key);
        return result.value !== undefined ? result.value : result.data;
      } else if (window.store) {
        return window.store.get(key);
      } else {
        throw new Error('No store API available');
      }
    } catch (error) {
      debugLog?.error('Store get error:', { 
        module: 'secure-adapter',
        function: 'secureStore.get',
        error: error.message 
      });
      throw error;
    }
  },

  /**
   * Set a value in store
   * @param {string} key - Store key
   * @param {any} value - Store value
   * @returns {Promise<Object>} Set result
   */
  async set(key, value) {
    try {
      if (window.secureElectronAPI) {
        return await window.secureElectronAPI.store.set(key, value);
      } else if (window.electronAPI?.store) {
        return await window.electronAPI.store.set(key, value);
      } else if (window.store) {
        window.store.set(key, value);
        return { success: true };
      } else {
        throw new Error('No store API available');
      }
    } catch (error) {
      debugLog?.error('Store set error:', { 
        module: 'secure-adapter',
        function: 'secureStore.set',
        error: error.message 
      });
      throw error;
    }
  },

  /**
   * Check if key exists in store
   * @param {string} key - Store key
   * @returns {Promise<boolean>} Whether key exists
   */
  async has(key) {
    try {
      if (window.secureElectronAPI) {
        const result = await window.secureElectronAPI.store.has(key);
        return result.has !== undefined ? result.has : result.data;
      } else if (window.electronAPI?.store) {
        const result = await window.electronAPI.store.has(key);
        return result.has !== undefined ? result.has : result.data;
      } else if (window.store) {
        return window.store.has(key);
      } else {
        throw new Error('No store API available');
      }
    } catch (error) {
      debugLog?.error('Store has error:', { 
        module: 'secure-adapter',
        function: 'secureStore.has',
        error: error.message 
      });
      throw error;
    }
  },

  /**
   * Delete a key from store
   * @param {string} key - Store key
   * @returns {Promise<Object>} Delete result
   */
  async delete(key) {
    try {
      if (window.secureElectronAPI) {
        return await window.secureElectronAPI.store.delete(key);
      } else if (window.electronAPI?.store) {
        return await window.electronAPI.store.delete(key);
      } else if (window.store) {
        window.store.delete(key);
        return { success: true };
      } else {
        throw new Error('No store API available');
      }
    } catch (error) {
      debugLog?.error('Store delete error:', { 
        module: 'secure-adapter',
        function: 'secureStore.delete',
        error: error.message 
      });
      throw error;
    }
  }
};

/**
 * Secure OS Adapter
 * Provides OS operations that work in both insecure and secure modes
 */
export const secureOS = {
  /**
   * Get home directory
   * @returns {Promise<string>} Home directory path
   */
  async homedir() {
    try {
      if (window.secureElectronAPI) {
        const result = await window.secureElectronAPI.os.homedir();
        return result.data || result;
      } else if (window.electronAPI?.os) {
        const result = await window.electronAPI.os.homedir();
        return result.data || result;
      } else if (window.homedir) {
        return window.homedir;
      } else {
        throw new Error('No OS API available');
      }
    } catch (error) {
      debugLog?.error('OS homedir error:', { 
        module: 'secure-adapter',
        function: 'secureOS.homedir',
        error: error.message 
      });
      throw error;
    }
  }
};

/**
 * Test function to verify adapter functionality
 * @returns {Object} Test results
 */
export function testSecureAdapter() {
  const results = {
    success: true,
    tests: [],
    errors: [],
    apis: {}
  };

  console.log('🧪 Testing Secure Adapter Layer...');

  // Test API availability
  const apiTests = [
    { name: 'secureElectronAPI', obj: window.secureElectronAPI },
    { name: 'electronAPI', obj: window.electronAPI },
    { name: 'db', obj: window.db },
    { name: 'store', obj: window.store },
    { name: 'path', obj: window.path },
    { name: 'fs', obj: window.fs },
    { name: 'homedir', obj: window.homedir }
  ];

  apiTests.forEach(test => {
    const available = typeof test.obj !== 'undefined';
    results.apis[test.name] = available;
    results.tests.push({ name: test.name, available });
    
    if (available) {
      console.log(`✅ ${test.name} API available`);
    } else {
      console.log(`❌ ${test.name} API not available`);
    }
  });

  // Test adapter functions
  const adapters = [
    { name: 'secureDatabase', obj: secureDatabase },
    { name: 'secureFileSystem', obj: secureFileSystem },
    { name: 'securePath', obj: securePath },
    { name: 'secureStore', obj: secureStore },
    { name: 'secureOS', obj: secureOS }
  ];

  adapters.forEach(adapter => {
    if (adapter.obj) {
      console.log(`✅ ${adapter.name} adapter available`);
      results.tests.push({ name: `${adapter.name}Available`, success: true });
    } else {
      console.log(`❌ ${adapter.name} adapter missing`);
      results.tests.push({ name: `${adapter.name}Available`, success: false });
      results.errors.push(`${adapter.name} adapter not available`);
    }
  });

  // Determine which API mode we're in
  if (window.secureElectronAPI) {
    console.log('🔒 Running in SECURE mode (contextBridge)');
    results.mode = 'secure';
  } else if (window.electronAPI) {
    console.log('🔄 Running in MODERN mode (hybrid)');
    results.mode = 'modern';
  } else if (window.db || window.store) {
    console.log('⚠️ Running in LEGACY mode (insecure)');
    results.mode = 'legacy';
  } else {
    console.log('❌ No recognized API mode');
    results.mode = 'unknown';
    results.success = false;
  }

  console.log(`🧪 Adapter test completed: ${results.tests.length} tests run`);
  
  return results;
}

// Export all adapters as a single object for convenience
export const secureAdapters = {
  database: secureDatabase,
  fileSystem: secureFileSystem,
  path: securePath,
  store: secureStore,
  os: secureOS,
  test: testSecureAdapter
};
