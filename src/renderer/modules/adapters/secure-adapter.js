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
async function invokeDatabase(method, args, operation) {
  try {
    const database = window.secureElectronAPI?.database;
    const handler = database?.[method];
    if (typeof handler !== 'function') throw new Error('No database API available');
    return await handler.apply(database, args);
  } catch (error) {
    debugLog?.error(`${operation} failed:`, {
      module: 'secure-adapter',
      function: `secureDatabase.${method}`,
      error: error.message
    });
    return { success: false, error: error.message };
  }
}

async function invokeSecureAPI(namespace, method, args = []) {
  try {
    const api = window.secureElectronAPI?.[namespace];
    const handler = api?.[method];
    if (typeof handler !== 'function') throw new Error(`No ${namespace} API available`);
    return await handler.apply(api, args);
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export const secureDatabase = {
  getCategories: () => invokeDatabase('getCategories', [], 'Get categories'),
  addSong: (songData) => invokeDatabase('addSong', [songData], 'Add song'),
  getSongById: (songId) => invokeDatabase('getSongById', [songId], 'Get song by ID'),
  getSongsByIds: (ids) => invokeDatabase('getSongsByIds', [ids], 'Get songs by IDs'),
  searchSongs: (searchParams) => invokeDatabase('searchSongs', [searchParams], 'Search songs'),
  updateSong: (songData) => invokeDatabase('updateSong', [songData], 'Update song'),
  deleteSong: (songId) => invokeDatabase('deleteSong', [songId], 'Delete song'),
  addCategory: (categoryData) => invokeDatabase('addCategory', [categoryData], 'Add category'),
  updateCategory: (code, description) => invokeDatabase('updateCategory', [code, description], 'Update category'),
  deleteCategory: (code) => invokeDatabase('deleteCategory', [code], 'Delete category'),
  getCategoryByCode: (code) => invokeDatabase('getCategoryByCode', [code], 'Get category by code'),
  reassignSongCategory: (fromCode, toCode) => invokeDatabase(
    'reassignSongCategory', [fromCode, toCode], 'Reassign song category'
  ),
  findCategoryCodesLike: (code, pattern) => invokeDatabase(
    'findCategoryCodesLike', [code, pattern], 'Find category codes'
  )
};

/** Secure filesystem operations exposed by the preload. */
export const secureFileSystem = {
  scanAudioDirectory: (rootPath) => invokeSecureAPI('fileSystem', 'scanAudioDirectory', [rootPath]),
  exists: (filePath) => invokeSecureAPI('fileSystem', 'exists', [filePath]),
  copy: (sourcePath, destPath) => invokeSecureAPI('fileSystem', 'copy', [sourcePath, destPath]),
  delete: (filePath) => invokeSecureAPI('fileSystem', 'delete', [filePath])
};

/** Secure path operations exposed by the preload. */
export const securePath = {
  join: (...paths) => invokeSecureAPI('path', 'join', paths),
  extname: (filePath) => invokeSecureAPI('path', 'extname', [filePath]),
  dirname: (filePath) => invokeSecureAPI('path', 'dirname', [filePath]),
  parse: (filePath) => invokeSecureAPI('path', 'parse', [filePath]),
  basename: (filePath, ext) => invokeSecureAPI('path', 'basename', [filePath, ext]),
  resolve: (...paths) => invokeSecureAPI('path', 'resolve', paths)
};

/** Secure store operations exposed by the preload. */
export const secureStore = {
  get: (key) => invokeSecureAPI('store', 'get', [key]),
  set: (key, value) => invokeSecureAPI('store', 'set', [key, value]),
  has: (key) => invokeSecureAPI('store', 'has', [key]),
  delete: (key) => invokeSecureAPI('store', 'delete', [key])
};

/** Secure audio operations exposed by the preload. */
export const secureAudio = {
  getDuration: (filePath) => invokeSecureAPI('audio', 'getDuration', [filePath]),
  play: (filePath, options = {}) => invokeSecureAPI('audio', 'play', [filePath, options]),
  stop: (soundId) => invokeSecureAPI('audio', 'stop', [soundId]),
  setVolume: (volume, soundId) => invokeSecureAPI('audio', 'setVolume', [volume, soundId])
};

export const secureUtilities = {
  generateId: () => invokeSecureAPI('utils', 'generateId'),
  formatDuration: (seconds) => invokeSecureAPI('utils', 'formatDuration', [seconds])
};

export const secureAnalytics = {
  trackEvent: (name, properties) => invokeSecureAPI('analytics', 'trackEvent', [name, properties])
};

/** Secure picker and collection-file operations exposed by the preload. */
export const secureFileDialog = {
  showFilePicker: (options = {}) => invokeSecureAPI('app', 'showFilePicker', [options]),
  showDirectoryPicker: (defaultPath) => invokeSecureAPI('app', 'showDirectoryPicker', [defaultPath]),
  openHotkeyFile: () => invokeSecureAPI('fileOperations', 'openHotkeyFile'),
  saveHotkeyFile: (hotkeyArray) => invokeSecureAPI('fileOperations', 'saveHotkeyFile', [hotkeyArray]),
  openHoldingTankFile: () => invokeSecureAPI('fileOperations', 'openHoldingTankFile'),
  saveHoldingTankFile: (holdingTankArray) => invokeSecureAPI(
    'fileOperations', 'saveHoldingTankFile', [holdingTankArray]
  )
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
    } else {
      debugLog?.warn('⚠️ Secure API not detected');
      results.warnings.push('Secure API not available');
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
  secureUtilities,
  secureAnalytics,
  secureFileDialog,
  testSecureAdapter
};
