/**
 * Library Transfer Manager Module
 *
 * Handles exporting and importing the entire Mx. Voice library (database, music,
 * profiles, hotkeys, config) as a single .mxvlib archive for transfer between machines.
 *
 * Archive format: ZIP with .mxvlib extension containing:
 *   manifest.json          - version info, content summary
 *   database/mxvoice.db    - SQLite database snapshot
 *   music/                 - MP3 files
 *   profiles/              - Profile directory tree
 *   profiles.json          - Profile registry
 *   config.json            - electron-store global config
 *   hotkeys/               - .mrv hotkey files
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import electron from 'electron';
import archiver from 'archiver';
import yauzl from 'yauzl';

const { app } = electron;

const MANIFEST_VERSION = 1;

let debugLog = null;
let db = null;
let store = null;

async function pathExists(p) {
  try { await fs.promises.access(p); return true; } catch { return false; }
}

async function copyDirectoryRecursive(src, dest) {
  await fs.promises.mkdir(dest, { recursive: true });
  const entries = await fs.promises.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDirectoryRecursive(srcPath, destPath);
    } else {
      await fs.promises.copyFile(srcPath, destPath);
    }
  }
}

/**
 * Initialize the Library Transfer Manager
 * @param {Object} dependencies - Module dependencies
 */
function initializeLibraryTransferManager(dependencies) {
  debugLog = dependencies.debugLog;
  db = dependencies.db;
  store = dependencies.store;

  debugLog?.info('Library Transfer Manager initialized', {
    module: 'library-transfer-manager',
    function: 'initializeLibraryTransferManager'
  });
}

/**
 * Count files matching a pattern in a directory
 */
async function countFiles(dirPath, extension) {
  if (!await pathExists(dirPath)) return 0;
  try {
    const entries = await fs.promises.readdir(dirPath);
    return entries.filter(f => f.toLowerCase().endsWith(extension)).length;
  } catch {
    return 0;
  }
}

/**
 * Count all files recursively in a directory
 */
async function countDirectoryFiles(dirPath) {
  if (!await pathExists(dirPath)) return 0;
  let count = 0;
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        count += await countDirectoryFiles(path.join(dirPath, entry.name));
      } else {
        count++;
      }
    }
  } catch {
    // Directory not readable
  }
  return count;
}

/**
 * Calculate total size of a directory recursively
 */
async function calculateDirectorySize(dirPath) {
  if (!await pathExists(dirPath)) return 0;
  let totalSize = 0;
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        totalSize += await calculateDirectorySize(fullPath);
      } else {
        const stat = await fs.promises.stat(fullPath);
        totalSize += stat.size;
      }
    }
  } catch {
    // Directory not readable
  }
  return totalSize;
}

/**
 * Get the paths to all library components
 */
function getLibraryPaths() {
  const userData = app.getPath('userData');
  const musicDir = store.get('music_directory') || path.join(userData, 'mp3');
  const hotkeyDir = store.get('hotkey_directory') || path.join(userData, 'hotkeys');
  const dbDir = store.get('database_directory') || userData;
  const profilesDir = path.join(userData, 'profiles');
  const profilesRegistry = path.join(userData, 'profiles.json');
  const configPath = store.path;

  // Find the actual database file — prefer mrvoice.db (legacy) over mxvoice.db,
  // matching the priority order in database-setup.js initializeMainDatabase()
  let dbPath = path.join(dbDir, 'mrvoice.db');
  if (!fs.existsSync(dbPath)) {
    dbPath = path.join(dbDir, 'mxvoice.db');
  }

  return { userData, musicDir, hotkeyDir, dbDir, dbPath, profilesDir, profilesRegistry, configPath };
}

/**
 * Build the manifest object
 */
async function buildManifest(paths) {
  const mp3Count = await countFiles(paths.musicDir, '.mp3');
  const hotkeyCount = await countFiles(paths.hotkeyDir, '.mrv');
  const profileFileCount = await countDirectoryFiles(paths.profilesDir);

  // Count profiles from registry
  let profileCount = 0;
  if (await pathExists(paths.profilesRegistry)) {
    try {
      const registry = JSON.parse(await fs.promises.readFile(paths.profilesRegistry, 'utf-8'));
      profileCount = Array.isArray(registry.profiles) ? registry.profiles.length : 0;
    } catch {
      // Registry not parsable
    }
  }

  return {
    version: MANIFEST_VERSION,
    appVersion: app.getVersion(),
    createdAt: new Date().toISOString(),
    platform: process.platform,
    contents: {
      hasDatabase: await pathExists(paths.dbPath),
      mp3Count,
      hotkeyCount,
      profileCount,
      profileFileCount
    }
  };
}

/**
 * Export the entire library to a .mxvlib archive
 * @param {string} outputPath - Path to save the archive
 * @param {Function} progressCallback - Called with { percent, message }
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function exportLibrary(outputPath, progressCallback = () => {}) {
  const logCtx = { module: 'library-transfer-manager', function: 'exportLibrary' };

  try {
    const paths = getLibraryPaths();
    progressCallback({ percent: 0, message: 'Preparing export...' });

    debugLog?.info('Starting library export', { ...logCtx, outputPath, paths: {
      musicDir: paths.musicDir, hotkeyDir: paths.hotkeyDir, dbPath: paths.dbPath
    }});

    // Build manifest
    const manifest = await buildManifest(paths);
    debugLog?.info('Manifest built', { ...logCtx, manifest });

    // Copy database to temp location for safe snapshot
    let tempDbPath = null;
    if (manifest.contents.hasDatabase) {
      tempDbPath = path.join(os.tmpdir(), `mxvoice-export-${Date.now()}.db`);
      await fs.promises.copyFile(paths.dbPath, tempDbPath);
      debugLog?.info('Database snapshot created', { ...logCtx, tempDbPath });
    }

    progressCallback({ percent: 5, message: 'Creating archive...' });

    // Create archive
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 5 } });

    const archivePromise = new Promise((resolve, reject) => {
      output.on('close', () => resolve());
      archive.on('error', (err) => reject(err));
      archive.on('warning', (err) => {
        debugLog?.warn('Archive warning', { ...logCtx, error: err.message });
      });
    });

    // Track progress based on data processed
    let totalSourceSize = 0;
    if (manifest.contents.hasDatabase && tempDbPath) {
      const dbStat = await fs.promises.stat(tempDbPath);
      totalSourceSize += dbStat.size;
    }
    totalSourceSize += await calculateDirectorySize(paths.musicDir);
    totalSourceSize += await calculateDirectorySize(paths.profilesDir);
    totalSourceSize += await calculateDirectorySize(paths.hotkeyDir);

    let processedBytes = 0;
    archive.on('progress', (progress) => {
      processedBytes = progress.fs.processedBytes;
      const percent = totalSourceSize > 0
        ? Math.min(95, Math.round(5 + (processedBytes / totalSourceSize) * 90))
        : 50;
      progressCallback({ percent, message: 'Archiving files...' });
    });

    archive.pipe(output);

    // Add manifest
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

    // Add database snapshot
    if (tempDbPath) {
      archive.file(tempDbPath, { name: 'database/mxvoice.db' });
    }

    // Add music files
    if (await pathExists(paths.musicDir)) {
      archive.directory(paths.musicDir, 'music');
    }

    // Add profiles directory
    if (await pathExists(paths.profilesDir)) {
      archive.directory(paths.profilesDir, 'profiles');
    }

    // Add profiles registry
    if (await pathExists(paths.profilesRegistry)) {
      archive.file(paths.profilesRegistry, { name: 'profiles.json' });
    }

    // Add config
    if (await pathExists(paths.configPath)) {
      archive.file(paths.configPath, { name: 'config.json' });
    }

    // Add hotkeys
    if (await pathExists(paths.hotkeyDir)) {
      archive.directory(paths.hotkeyDir, 'hotkeys');
    }

    await archive.finalize();
    await archivePromise;

    // Clean up temp database
    if (tempDbPath) {
      try { await fs.promises.unlink(tempDbPath); } catch { /* ignore */ }
    }

    const archiveStat = await fs.promises.stat(outputPath);
    progressCallback({ percent: 100, message: 'Export complete!' });

    debugLog?.info('Library export complete', {
      ...logCtx,
      outputPath,
      archiveSize: archiveStat.size,
      manifest
    });

    return { success: true, archiveSize: archiveStat.size, manifest };
  } catch (error) {
    debugLog?.error('Library export failed', { ...logCtx, error: error.message });
    // Clean up partial output file
    try { if (await pathExists(outputPath)) await fs.promises.unlink(outputPath); } catch { /* ignore */ }
    return { success: false, error: error.message };
  }
}

/**
 * Read a single entry from a zip archive by name using yauzl.
 * Returns the entry contents as a string, or null if not found.
 * @param {string} archivePath - Path to the zip file
 * @param {string} entryName - Name of the entry to read (e.g. 'manifest.json')
 * @returns {Promise<string|null>}
 */
function readZipEntry(archivePath, entryName) {
  return new Promise((resolve, reject) => {
    yauzl.open(archivePath, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err);

      let found = false;
      zipfile.readEntry();

      zipfile.on('entry', (entry) => {
        if (entry.fileName === entryName) {
          found = true;
          zipfile.openReadStream(entry, (streamErr, readStream) => {
            if (streamErr) return reject(streamErr);
            const chunks = [];
            readStream.on('data', (chunk) => chunks.push(chunk));
            readStream.on('end', () => {
              zipfile.close();
              resolve(Buffer.concat(chunks).toString('utf-8'));
            });
            readStream.on('error', reject);
          });
        } else {
          zipfile.readEntry();
        }
      });

      zipfile.on('end', () => {
        if (!found) resolve(null);
      });

      zipfile.on('error', reject);
    });
  });
}

/**
 * Characters illegal in Windows filenames. Matches the pattern used by the
 * sanitize-filename IPC handler in ipc-handlers.js.
 */
const ILLEGAL_FILENAME_CHARS = /[<>:"/\\|?*]/g;

/**
 * Sanitize a zip entry path for the current platform.
 * On Windows, replaces illegal characters in each path segment with '_'.
 * Returns { sanitized, wasRenamed } so callers can track renames.
 */
function sanitizeEntryPath(entryFileName) {
  if (process.platform !== 'win32') {
    return { sanitized: entryFileName, wasRenamed: false };
  }

  // Split into segments, sanitize each filename part (not the separators)
  const segments = entryFileName.split('/');
  let wasRenamed = false;
  const sanitizedSegments = segments.map((seg) => {
    if (seg === '') return seg; // trailing slash for directories
    const clean = seg.replace(ILLEGAL_FILENAME_CHARS, '_');
    if (clean !== seg) wasRenamed = true;
    return clean;
  });

  return { sanitized: sanitizedSegments.join('/'), wasRenamed };
}

/**
 * Extract a zip archive to a directory using yauzl, with progress reporting.
 * Sanitizes filenames for the current platform and continues past per-file errors.
 * @param {string} archivePath - Path to the zip file
 * @param {string} destDir - Directory to extract into
 * @param {Function} onProgress - Called with (entriesProcessed, totalEntries) after each entry
 * @returns {Promise<{renamedFiles: Map<string,string>, errors: Array<{entry: string, error: string}>}>}
 *   renamedFiles maps original zip entry name → sanitized name (only entries that changed)
 *   errors lists entries that could not be extracted
 */
function extractZipWithProgress(archivePath, destDir, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    yauzl.open(archivePath, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err);

      const totalEntries = zipfile.entryCount;
      let entriesProcessed = 0;
      const renamedFiles = new Map();
      const errors = [];

      function advance() {
        entriesProcessed++;
        onProgress(entriesProcessed, totalEntries);
        zipfile.readEntry();
      }

      function handleEntryError(entryName, entryErr) {
        debugLog?.warn('Failed to extract entry, skipping', {
          module: 'library-transfer-manager',
          function: 'extractZipWithProgress',
          entry: entryName,
          error: entryErr.message
        });
        errors.push({ entry: entryName, error: entryErr.message });
        advance();
      }

      zipfile.readEntry();

      zipfile.on('entry', (entry) => {
        const { sanitized, wasRenamed } = sanitizeEntryPath(entry.fileName);
        if (wasRenamed) {
          renamedFiles.set(entry.fileName, sanitized);
        }

        const destPath = path.join(destDir, sanitized);

        // Prevent zip slip (path traversal)
        const normalizedDest = path.resolve(destPath);
        const normalizedDir = path.resolve(destDir);
        if (!normalizedDest.startsWith(normalizedDir + path.sep) && normalizedDest !== normalizedDir) {
          advance();
          return;
        }

        if (/\/$/.test(entry.fileName)) {
          // Directory entry
          fs.promises.mkdir(destPath, { recursive: true })
            .then(advance)
            .catch((dirErr) => handleEntryError(entry.fileName, dirErr));
        } else {
          // File entry — ensure parent directory exists, then extract
          fs.promises.mkdir(path.dirname(destPath), { recursive: true }).then(() => {
            zipfile.openReadStream(entry, (streamErr, readStream) => {
              if (streamErr) {
                handleEntryError(entry.fileName, streamErr);
                return;
              }

              const writeStream = fs.createWriteStream(destPath);
              readStream.pipe(writeStream);

              writeStream.on('close', advance);
              writeStream.on('error', (writeErr) => handleEntryError(entry.fileName, writeErr));
              readStream.on('error', (readErr) => handleEntryError(entry.fileName, readErr));
            });
          }).catch((mkdirErr) => handleEntryError(entry.fileName, mkdirErr));
        }
      });

      zipfile.on('end', () => resolve({ renamedFiles, errors }));
      zipfile.on('error', reject);
    });
  });
}

/**
 * Validate an archive and return its manifest.
 * Only reads manifest.json from the zip — does not extract the full archive.
 * @param {string} archivePath - Path to the .mxvlib file
 * @returns {Promise<{success: boolean, manifest?: Object, error?: string}>}
 */
async function validateArchive(archivePath) {
  const logCtx = { module: 'library-transfer-manager', function: 'validateArchive' };

  try {
    if (!await pathExists(archivePath)) {
      return { success: false, error: 'Archive file not found' };
    }

    // Read only the manifest entry from the zip (no full extraction)
    const manifestContent = await readZipEntry(archivePath, 'manifest.json');

    if (manifestContent === null) {
      return { success: false, error: 'Invalid archive: missing manifest.json' };
    }

    const manifest = JSON.parse(manifestContent);

    if (!manifest.version || manifest.version > MANIFEST_VERSION) {
      return {
        success: false,
        error: `Archive was created by a newer version of Mx. Voice (manifest v${manifest.version}). Please update the application.`
      };
    }

    // Get archive file size
    const archiveStat = await fs.promises.stat(archivePath);
    manifest.archiveSize = archiveStat.size;

    debugLog?.info('Archive validated successfully', { ...logCtx, manifest });
    return { success: true, manifest };
  } catch (error) {
    debugLog?.error('Archive validation failed', { ...logCtx, error: error.message });
    return { success: false, error: `Invalid archive: ${error.message}` };
  }
}

/**
 * Import a library from a .mxvlib archive
 * @param {string} archivePath - Path to the .mxvlib file
 * @param {Function} progressCallback - Called with { percent, message }
 * @returns {Promise<{success: boolean, error?: string, requiresRestart?: boolean}>}
 */
async function importLibrary(archivePath, progressCallback = () => {}) {
  const logCtx = { module: 'library-transfer-manager', function: 'importLibrary' };

  try {
    progressCallback({ percent: 0, message: 'Validating archive...' });

    // Validate first
    const validation = await validateArchive(archivePath);
    if (!validation.success) {
      return { success: false, error: validation.error };
    }

    const manifest = validation.manifest;
    debugLog?.info('Starting library import', { ...logCtx, archivePath, manifest });

    progressCallback({ percent: 5, message: 'Extracting archive...' });

    // Extract to temp directory with progress reporting
    const tempDir = path.join(os.tmpdir(), `mxvlib-import-${Date.now()}`);
    await fs.promises.mkdir(tempDir, { recursive: true });

    try {
      const { renamedFiles, errors: extractErrors } = await extractZipWithProgress(
        archivePath, tempDir, (processed, total) => {
          // Extraction spans 5%–50% of total progress
          const extractPercent = 5 + Math.round((processed / total) * 45);
          progressCallback({
            percent: extractPercent,
            message: `Extracting archive (${processed}/${total} entries)...`
          });
        }
      );

      if (extractErrors.length > 0) {
        debugLog?.warn('Some entries could not be extracted', {
          ...logCtx, errorCount: extractErrors.length, errors: extractErrors
        });
      }
      if (renamedFiles.size > 0) {
        debugLog?.info('Sanitized filenames for platform compatibility', {
          ...logCtx, renamedCount: renamedFiles.size,
          renames: Object.fromEntries(renamedFiles)
        });
      }

      progressCallback({ percent: 50, message: 'Preparing import...' });

      const userData = app.getPath('userData');
      const defaultMusicDir = path.join(userData, 'mp3');
      const defaultHotkeyDir = path.join(userData, 'hotkeys');
      const defaultDbDir = userData;

      // Import database
      const extractedDb = path.join(tempDir, 'database', 'mxvoice.db');
      if (await pathExists(extractedDb)) {
        progressCallback({ percent: 55, message: 'Importing database...' });

        // Close existing database if open
        if (db && typeof db.close === 'function') {
          try {
            db.close();
            debugLog?.info('Closed existing database for import', logCtx);
          } catch (closeErr) {
            debugLog?.warn('Could not close existing database', { ...logCtx, error: closeErr.message });
          }
        }

        const targetDbPath = path.join(defaultDbDir, 'mxvoice.db');
        await fs.promises.copyFile(extractedDb, targetDbPath);
        debugLog?.info('Database imported', { ...logCtx, targetDbPath });

        // Update database filenames for any music files that were renamed during extraction
        // (e.g., colons replaced with underscores on Windows)
        const musicRenames = new Map();
        for (const [original, sanitized] of renamedFiles) {
          if (original.startsWith('music/')) {
            const origName = path.basename(original);
            const sanitizedName = path.basename(sanitized);
            musicRenames.set(origName, sanitizedName);
          }
        }

        if (musicRenames.size > 0) {
          try {
            const { Database } = await import('node-sqlite3-wasm');
            const importedDb = new Database(targetDbPath);
            let updatedCount = 0;
            for (const [origName, sanitizedName] of musicRenames) {
              const stmt = importedDb.prepare('UPDATE mrvoice SET filename = ? WHERE filename = ?');
              const result = stmt.run([sanitizedName, origName]);
              updatedCount += result.changes || 0;
              stmt.finalize();
            }
            importedDb.close();
            debugLog?.info('Updated sanitized filenames in database', {
              ...logCtx, renamedCount: musicRenames.size, updatedRows: updatedCount
            });
          } catch (dbFixErr) {
            debugLog?.warn('Could not update sanitized filenames in database', {
              ...logCtx, error: dbFixErr.message
            });
          }
        }
      }

      // Import music files
      const extractedMusic = path.join(tempDir, 'music');
      if (await pathExists(extractedMusic)) {
        progressCallback({ percent: 60, message: 'Importing music files...' });
        await fs.promises.mkdir(defaultMusicDir, { recursive: true });

        const musicFiles = await fs.promises.readdir(extractedMusic);
        const totalMusic = musicFiles.length;
        for (let i = 0; i < totalMusic; i++) {
          const file = musicFiles[i];
          const src = path.join(extractedMusic, file);
          const dest = path.join(defaultMusicDir, file);
          await fs.promises.copyFile(src, dest);

          const musicPercent = 60 + Math.round(((i + 1) / totalMusic) * 15);
          progressCallback({ percent: musicPercent, message: `Importing music files (${i + 1}/${totalMusic})...` });
        }
        debugLog?.info('Music files imported', { ...logCtx, count: totalMusic });
      }

      // Import profiles
      const extractedProfiles = path.join(tempDir, 'profiles');
      if (await pathExists(extractedProfiles)) {
        progressCallback({ percent: 78, message: 'Importing profiles...' });
        const targetProfilesDir = path.join(userData, 'profiles');

        // Remove existing profiles directory and replace
        if (await pathExists(targetProfilesDir)) {
          await fs.promises.rm(targetProfilesDir, { recursive: true, force: true });
        }
        await copyDirectoryRecursive(extractedProfiles, targetProfilesDir);
        debugLog?.info('Profiles imported', logCtx);
      }

      // Import profiles registry
      const extractedRegistry = path.join(tempDir, 'profiles.json');
      if (await pathExists(extractedRegistry)) {
        progressCallback({ percent: 83, message: 'Importing profile registry...' });
        await fs.promises.copyFile(extractedRegistry, path.join(userData, 'profiles.json'));
      }

      // Import hotkeys
      const extractedHotkeys = path.join(tempDir, 'hotkeys');
      if (await pathExists(extractedHotkeys)) {
        progressCallback({ percent: 87, message: 'Importing hotkeys...' });
        await fs.promises.mkdir(defaultHotkeyDir, { recursive: true });

        const hotkeyFiles = await fs.promises.readdir(extractedHotkeys);
        for (const file of hotkeyFiles) {
          await fs.promises.copyFile(
            path.join(extractedHotkeys, file),
            path.join(defaultHotkeyDir, file)
          );
        }
        debugLog?.info('Hotkeys imported', { ...logCtx, count: hotkeyFiles.length });
      }

      // Import config with path remapping
      const extractedConfig = path.join(tempDir, 'config.json');
      if (await pathExists(extractedConfig)) {
        progressCallback({ percent: 93, message: 'Importing settings...' });

        try {
          const importedConfig = JSON.parse(await fs.promises.readFile(extractedConfig, 'utf-8'));

          // Remap directory paths to this machine's defaults
          importedConfig.music_directory = defaultMusicDir;
          importedConfig.hotkey_directory = defaultHotkeyDir;
          importedConfig.database_directory = defaultDbDir;

          // Preserve window dimensions from current machine if they exist
          const currentWidth = store.get('browser_width');
          const currentHeight = store.get('browser_height');
          if (currentWidth) importedConfig.browser_width = currentWidth;
          if (currentHeight) importedConfig.browser_height = currentHeight;

          // Write remapped config to the store's file location
          await fs.promises.writeFile(store.path, JSON.stringify(importedConfig, null, 2));
          debugLog?.info('Config imported with remapped paths', logCtx);
        } catch (configErr) {
          debugLog?.warn('Could not import config, using existing', { ...logCtx, error: configErr.message });
        }
      }

      progressCallback({ percent: 100, message: 'Import complete! Restarting...' });

      debugLog?.info('Library import complete', { ...logCtx, manifest });

      return { success: true, requiresRestart: true };
    } finally {
      // Clean up temp directory
      try {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      } catch {
        debugLog?.warn('Could not clean up temp directory', { ...logCtx, tempDir });
      }
    }
  } catch (error) {
    debugLog?.error('Library import failed', { ...logCtx, error: error.message });
    return { success: false, error: error.message };
  }
}

export {
  initializeLibraryTransferManager,
  exportLibrary,
  importLibrary,
  validateArchive
};
