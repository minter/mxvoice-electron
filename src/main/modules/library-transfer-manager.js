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
import { createRequire } from 'module';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';
import yauzl from 'yauzl';

const { app } = electron;
const require = createRequire(import.meta.url);
const { ZipArchive } = require('archiver');

const MANIFEST_VERSION = 1;
const MEBIBYTE = 1024 ** 2;
const GIBIBYTE = 1024 ** 3;
// Finite bounds on untrusted ZIP work, sized for real libraries. Every song is
// one archive entry, and installs report libraries of 15,000+ songs (tens to
// hundreds of GiB), so these are ceilings for abuse, not for normal use. The
// export side has no matching limit: a library you can export must import.
const ARCHIVE_LIMITS = Object.freeze({
  compressedArchiveBytes: 512 * GIBIBYTE,
  entryCount: 250_000,
  manifestBytes: MEBIBYTE,
  entryUncompressedBytes: 8 * GIBIBYTE,
  totalUncompressedBytes: 512 * GIBIBYTE,
  compressionRatio: 200,
  diskHeadroomBytes: 256 * MEBIBYTE
});

class ArchiveLimitError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ArchiveLimitError';
  }
}

function isArchiveLimitError(error) {
  return error instanceof ArchiveLimitError || error?.name === 'ArchiveLimitError';
}

let debugLog = null;
let getDb = () => null;
let setDb = () => {};
let store = null;
let showSession = null;
let recoveryStore = null;

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
  getDb = dependencies.getDb;
  setDb = dependencies.setDb || (() => {});
  store = dependencies.store;
  showSession = dependencies.showSession || null;
  recoveryStore = dependencies.recoveryStore || null;

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
    const archive = new ZipArchive({ zlib: { level: 5 } });

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

function entryByteLimit(entry) {
  return entry.fileName === 'manifest.json'
    ? ARCHIVE_LIMITS.manifestBytes
    : ARCHIVE_LIMITS.entryUncompressedBytes;
}

function validateArchiveSize(archiveSize) {
  if (!Number.isSafeInteger(archiveSize) || archiveSize < 0) {
    throw new ArchiveLimitError('Archive has an invalid compressed size');
  }
  if (archiveSize > ARCHIVE_LIMITS.compressedArchiveBytes) {
    throw new ArchiveLimitError('Archive exceeds the maximum compressed size');
  }
}

function validateArchiveEntryCount(entryCount) {
  if (!Number.isSafeInteger(entryCount) || entryCount < 0) {
    throw new ArchiveLimitError('Archive has an invalid entry count');
  }
  if (entryCount > ARCHIVE_LIMITS.entryCount) {
    throw new ArchiveLimitError('Archive contains too many entries');
  }
}

/**
 * Validate declared entry sizes and add the entry to the aggregate budget.
 * @returns {number} the updated declared uncompressed byte count
 */
function validateArchiveEntryMetadata(entry, totalUncompressedBytes = 0) {
  const { compressedSize, uncompressedSize } = entry;
  if (!Number.isSafeInteger(compressedSize) || compressedSize < 0 ||
      !Number.isSafeInteger(uncompressedSize) || uncompressedSize < 0) {
    throw new ArchiveLimitError(`Archive entry has invalid size metadata: ${entry.fileName}`);
  }

  if (uncompressedSize > entryByteLimit(entry)) {
    const label = entry.fileName === 'manifest.json' ? 'manifest.json' : 'Archive entry';
    throw new ArchiveLimitError(`${label} exceeds its uncompressed size limit`);
  }

  if (uncompressedSize > 0 &&
      (compressedSize === 0 || uncompressedSize / compressedSize > ARCHIVE_LIMITS.compressionRatio)) {
    throw new ArchiveLimitError(`Archive entry exceeds the compression ratio limit: ${entry.fileName}`);
  }

  if (!Number.isSafeInteger(totalUncompressedBytes) || totalUncompressedBytes < 0 ||
      totalUncompressedBytes > ARCHIVE_LIMITS.totalUncompressedBytes - uncompressedSize) {
    throw new ArchiveLimitError('Archive exceeds the total uncompressed size limit');
  }

  return totalUncompressedBytes + uncompressedSize;
}

/**
 * Validate actual decompressed bytes while an entry is streaming.
 */
function validateArchiveStreamBytes(entry, entryBytes, totalBytes) {
  if (!Number.isSafeInteger(entryBytes) || entryBytes < 0 ||
      !Number.isSafeInteger(totalBytes) || totalBytes < entryBytes) {
    throw new ArchiveLimitError(`Archive entry has invalid streamed size: ${entry.fileName}`);
  }
  if (entryBytes > entry.uncompressedSize) {
    throw new ArchiveLimitError(`Archive entry exceeded its declared uncompressed size: ${entry.fileName}`);
  }
  if (entryBytes > entryByteLimit(entry)) {
    const label = entry.fileName === 'manifest.json' ? 'manifest.json' : 'Archive entry';
    throw new ArchiveLimitError(`${label} exceeded its streamed size limit`);
  }
  if (totalBytes > ARCHIVE_LIMITS.totalUncompressedBytes) {
    throw new ArchiveLimitError('Archive exceeded the streamed uncompressed size limit');
  }
  if (entryBytes > 0 &&
      (entry.compressedSize === 0 || entryBytes / entry.compressedSize > ARCHIVE_LIMITS.compressionRatio)) {
    throw new ArchiveLimitError(`Archive entry exceeded the streamed compression ratio limit: ${entry.fileName}`);
  }
}

/**
 * Inspect the central directory without extracting data and enforce declared budgets.
 */
async function inspectArchiveMetadata(archivePath) {
  const archiveStat = await fs.promises.stat(archivePath);
  validateArchiveSize(archiveStat.size);

  return new Promise((resolve, reject) => {
    yauzl.open(archivePath, { lazyEntries: true, validateEntrySizes: true }, (err, zipfile) => {
      if (err) return reject(err);

      let settled = false;
      let entriesSeen = 0;
      let manifestCount = 0;
      let totalUncompressedBytes = 0;

      const fail = (inspectionError) => {
        if (settled) return;
        settled = true;
        zipfile.close();
        reject(inspectionError);
      };

      try {
        validateArchiveEntryCount(zipfile.entryCount);
      } catch (limitError) {
        fail(limitError);
        return;
      }

      zipfile.on('entry', (entry) => {
        try {
          entriesSeen++;
          validateArchiveEntryCount(entriesSeen);
          totalUncompressedBytes = validateArchiveEntryMetadata(entry, totalUncompressedBytes);

          if (entry.fileName === 'manifest.json') {
            manifestCount++;
            if (manifestCount > 1) {
              throw new ArchiveLimitError('Archive contains multiple manifest.json entries');
            }
          }

          zipfile.readEntry();
        } catch (entryError) {
          fail(entryError);
        }
      });

      zipfile.on('end', () => {
        if (settled) return;
        settled = true;
        resolve({
          archiveSize: archiveStat.size,
          entryCount: entriesSeen,
          totalUncompressedBytes,
          hasManifest: manifestCount === 1
        });
      });
      zipfile.on('error', fail);
      zipfile.readEntry();
    });
  });
}

/**
 * Read a single bounded entry from a zip archive by name using yauzl.
 * Returns the entry contents as a string, or null if not found.
 * @param {string} archivePath - Path to the zip file
 * @param {string} entryName - Name of the entry to read (e.g. 'manifest.json')
 * @returns {Promise<string|null>}
 */
function readZipEntry(archivePath, entryName) {
  return new Promise((resolve, reject) => {
    yauzl.open(archivePath, { lazyEntries: true, validateEntrySizes: true }, (err, zipfile) => {
      if (err) return reject(err);

      let settled = false;
      let found = false;
      let entriesSeen = 0;

      const finish = (value) => {
        if (settled) return;
        settled = true;
        zipfile.close();
        resolve(value);
      };
      const fail = (readError) => {
        if (settled) return;
        settled = true;
        zipfile.close();
        reject(readError);
      };

      try {
        validateArchiveEntryCount(zipfile.entryCount);
      } catch (limitError) {
        fail(limitError);
        return;
      }

      zipfile.readEntry();

      zipfile.on('entry', (entry) => {
        try {
          entriesSeen++;
          validateArchiveEntryCount(entriesSeen);
        } catch (limitError) {
          fail(limitError);
          return;
        }

        if (entry.fileName === entryName) {
          found = true;
          try {
            validateArchiveEntryMetadata(entry);
          } catch (limitError) {
            fail(limitError);
            return;
          }

          zipfile.openReadStream(entry, (streamErr, readStream) => {
            if (streamErr) return fail(streamErr);
            const chunks = [];
            let totalBytes = 0;
            readStream.on('data', (chunk) => {
              try {
                const nextTotal = totalBytes + chunk.length;
                validateArchiveStreamBytes(entry, nextTotal, nextTotal);
                totalBytes = nextTotal;
                chunks.push(chunk);
              } catch (limitError) {
                readStream.destroy(limitError);
              }
            });
            readStream.on('end', () => {
              finish(Buffer.concat(chunks, totalBytes).toString('utf-8'));
            });
            readStream.on('error', fail);
          });
        } else {
          zipfile.readEntry();
        }
      });

      zipfile.on('end', () => {
        if (!found) finish(null);
      });

      zipfile.on('error', fail);
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
 * Sanitizes filenames, bounds resource use, and continues past per-file I/O errors.
 * @param {string} archivePath - Path to the zip file
 * @param {string} destDir - Directory to extract into
 * @param {Function} onProgress - Called with (entriesProcessed, totalEntries) after each entry
 * @returns {Promise<{renamedFiles: Map<string,string>, errors: Array<{entry: string, error: string}>}>}
 *   renamedFiles maps original zip entry name → sanitized name (only entries that changed)
 *   errors lists entries that could not be extracted
 */
async function extractZipWithProgress(archivePath, destDir, onProgress = () => {}) {
  const metadata = await inspectArchiveMetadata(archivePath);
  const diskStats = await fs.promises.statfs(destDir, { bigint: true });
  const availableBytes = diskStats.bavail * diskStats.bsize;
  const requiredBytes = BigInt(metadata.totalUncompressedBytes + ARCHIVE_LIMITS.diskHeadroomBytes);
  if (availableBytes < requiredBytes) {
    throw new ArchiveLimitError('Insufficient disk space to extract archive with required headroom');
  }

  return new Promise((resolve, reject) => {
    yauzl.open(archivePath, { lazyEntries: true, validateEntrySizes: true }, (err, zipfile) => {
      if (err) return reject(err);

      const totalEntries = zipfile.entryCount;
      let settled = false;
      let entriesProcessed = 0;
      let entriesSeen = 0;
      let declaredBytes = 0;
      const streamedBytes = { total: 0 };
      const renamedFiles = new Map();
      const errors = [];

      function failExtraction(extractError) {
        if (settled) return;
        settled = true;
        zipfile.close();
        reject(extractError);
      }

      function advance() {
        if (settled) return;
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

      try {
        validateArchiveEntryCount(totalEntries);
      } catch (limitError) {
        failExtraction(limitError);
        return;
      }

      zipfile.readEntry();

      zipfile.on('entry', (entry) => {
        try {
          entriesSeen++;
          validateArchiveEntryCount(entriesSeen);
          declaredBytes = validateArchiveEntryMetadata(entry, declaredBytes);
        } catch (limitError) {
          failExtraction(limitError);
          return;
        }

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
              let entryBytes = 0;
              const limitStream = new Transform({
                transform(chunk, _encoding, callback) {
                  try {
                    const nextEntryBytes = entryBytes + chunk.length;
                    const nextTotalBytes = streamedBytes.total + chunk.length;
                    validateArchiveStreamBytes(entry, nextEntryBytes, nextTotalBytes);
                    entryBytes = nextEntryBytes;
                    streamedBytes.total = nextTotalBytes;
                    callback(null, chunk);
                  } catch (limitError) {
                    callback(limitError);
                  }
                }
              });

              pipeline(readStream, limitStream, writeStream)
                .then(advance)
                .catch(async (streamError) => {
                  try { await fs.promises.rm(destPath, { force: true }); } catch { /* best effort */ }
                  if (isArchiveLimitError(streamError)) {
                    failExtraction(streamError);
                  } else {
                    handleEntryError(entry.fileName, streamError);
                  }
                });
            });
          }).catch((mkdirErr) => handleEntryError(entry.fileName, mkdirErr));
        }
      });

      zipfile.on('end', () => {
        if (settled) return;
        settled = true;
        resolve({ renamedFiles, errors });
      });
      zipfile.on('error', failExtraction);
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

    // Inspect every central-directory record before decompressing any content.
    const metadata = await inspectArchiveMetadata(archivePath);
    if (!metadata.hasManifest) {
      return { success: false, error: 'Invalid archive: missing manifest.json' };
    }

    // Read only the bounded manifest entry from the zip (no full extraction)
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

    manifest.archiveSize = metadata.archiveSize;

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
  // Once the session has ended, a failure must say so: the page reloads to
  // reopen the session from disk, or Shows and autosave stay disabled
  let sessionEnded = false;

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
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'mxvlib-import-'));

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

      // An archive without a database can't be imported. Checked before the
      // session ends, so a refused import leaves the show running.
      const extractedDb = path.join(tempDir, 'database', 'mxvoice.db');
      if (!await pathExists(extractedDb)) {
        debugLog?.warn('Archive has no database', logCtx);
        return { success: false, error: 'Invalid archive: it has no database.' };
      }

      // The library is replaced, so every crash-recovery record is stale.
      // End the session first: its fence stops a late write from recreating
      // one before the database or any profile file moves. The records are
      // cleared once the import has committed. A failed end may not stop it.
      sessionEnded = Boolean(showSession);
      try {
        await showSession?.end('library-import');
      } catch (endErr) {
        debugLog?.warn('Could not end the show session before importing the library', {
          ...logCtx, error: endErr.message
        });
      }

      // Import database
      progressCallback({ percent: 55, message: 'Importing database...' });

      // Close existing database if open
      const currentDb = getDb();
      if (currentDb && typeof currentDb.close === 'function') {
        try {
          currentDb.close();
          setDb(null);
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

      // Committed: every record is stale now. Cleared directly, since end()
      // leaves them (and with no open session, or one already ended, it never
      // ran). A failure here may not fail the import.
      try {
        await recoveryStore?.clearAll();
      } catch (clearErr) {
        debugLog?.warn('Could not clear crash-recovery records after importing the library', {
          ...logCtx, error: clearErr.message
        });
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
    debugLog?.error('Library import failed', { ...logCtx, error: error.message, sessionEnded });
    return sessionEnded
      ? { success: false, error: error.message, sessionEnded: true }
      : { success: false, error: error.message };
  }
}

export {
  ARCHIVE_LIMITS,
  initializeLibraryTransferManager,
  exportLibrary,
  importLibrary,
  validateArchive,
  validateArchiveEntryMetadata,
  validateArchiveStreamBytes
};
