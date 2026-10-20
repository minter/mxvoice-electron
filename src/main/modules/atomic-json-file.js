/**
 * Atomic JSON file helpers: write via temp file + rename, keep an optional
 * previous generation, and read with fallback to that generation.
 *
 * @module atomic-json-file
 */

import nodeFs from 'fs';
import path from 'path';

const RENAME_MAX_ATTEMPTS = 5;
const RENAME_BASE_DELAY_MS = 20;
const TRANSIENT_RENAME_CODES = new Set(['EPERM', 'EBUSY', 'EACCES']);

let tempCounter = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Rename, retrying on Windows where antivirus or the indexer can briefly hold
 * the destination. Other platforms get a single attempt.
 */
async function renameWithRetry(fs, from, to, platform) {
  const attempts = platform === 'win32' ? RENAME_MAX_ATTEMPTS : 1;
  for (let attempt = 1; ; attempt++) {
    try {
      await fs.promises.rename(from, to);
      return;
    } catch (error) {
      if (attempt >= attempts || !TRANSIENT_RENAME_CODES.has(error?.code)) throw error;
      await sleep(RENAME_BASE_DELAY_MS * 2 ** (attempt - 1));
    }
  }
}

/**
 * Write `value` as JSON to `filePath` atomically: temp file, fsync, rename,
 * then fsync the directory where supported.
 *
 * @param {string} filePath
 * @param {*} value
 * @param {Object} [options]
 * @param {boolean} [options.keepPrevious] - copy the existing file to `<file>.prev` first
 * @param {Object} [options.fs] - fs implementation (tests)
 * @param {string} [options.platform] - process.platform override (tests)
 * @returns {Promise<void>}
 */
export async function writeJsonAtomic(
  filePath,
  value,
  { keepPrevious = false, fs = nodeFs, platform = process.platform } = {}
) {
  const json = JSON.stringify(value, null, 2);
  const tempPath = `${filePath}.tmp-${process.pid}-${++tempCounter}`;

  let prevTempPath = null;
  try {
    const handle = await fs.promises.open(tempPath, 'w');
    try {
      await handle.writeFile(json, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }

    if (keepPrevious) {
      // Only a main file that parses may become the previous generation, so a
      // corrupt main never replaces a good .prev.
      const current = await readParsed(fs, filePath);
      if ('value' in current) {
        // Copy to a temp sibling and rename, so a crash mid-copy can't leave
        // a truncated .prev.
        prevTempPath = `${tempPath}.prev`;
        await fs.promises.copyFile(filePath, prevTempPath);
        const prevHandle = await fs.promises.open(prevTempPath, 'r+');
        try {
          await prevHandle.sync();
        } finally {
          await prevHandle.close();
        }
        await renameWithRetry(fs, prevTempPath, `${filePath}.prev`, platform);
        prevTempPath = null;
      }
    }

    await renameWithRetry(fs, tempPath, filePath, platform);
  } catch (error) {
    await fs.promises.rm(tempPath, { force: true }).catch(() => {});
    if (prevTempPath) await fs.promises.rm(prevTempPath, { force: true }).catch(() => {});
    throw error;
  }

  if (platform !== 'win32') {
    try {
      const dirHandle = await fs.promises.open(path.dirname(filePath), 'r');
      try {
        await dirHandle.sync();
      } finally {
        await dirHandle.close();
      }
    } catch {
      // Directory fsync is best effort; the rename already happened.
    }
  }
}

async function readParsed(fs, filePath) {
  let text;
  try {
    text = await fs.promises.readFile(filePath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return { missing: true };
    return { ioError: error.message };
  }
  try {
    return { value: JSON.parse(text) };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Read JSON from `filePath`, falling back to `<file>.prev`.
 *
 * @param {string} filePath
 * @param {Object} [options]
 * @param {Object} [options.fs]
 * @returns {Promise<{status: 'ok'|'missing'|'recovered'|'unreadable'|'error', value?: *, error?: string}>}
 */
export async function readJsonWithFallback(filePath, { fs = nodeFs } = {}) {
  const main = await readParsed(fs, filePath);
  if ('value' in main) return { status: 'ok', value: main.value };
  // An existing main file we couldn't read (locked, permissions) must never be
  // replaced by stale .prev data.
  if (main.ioError) return { status: 'error', error: main.ioError };

  const prev = await readParsed(fs, `${filePath}.prev`);
  if (main.missing) {
    if ('value' in prev) return { status: 'recovered', value: prev.value };
    return prev.missing ? { status: 'missing' } : { status: 'unreadable', error: prev.error };
  }
  if ('value' in prev) return { status: 'recovered', value: prev.value };
  return { status: 'unreadable', error: main.error };
}

/**
 * Move a bad file aside as `<file>.corrupt-<ISO timestamp>`. Characters that
 * are illegal in Windows file names (':' and '.') are replaced with '-'.
 *
 * @param {string} filePath
 * @param {Object} [options]
 * @param {Object} [options.fs]
 * @returns {Promise<string>} the new path
 */
export async function quarantine(filePath, { fs = nodeFs } = {}) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = `${filePath}.corrupt-${stamp}`;
  await fs.promises.rename(filePath, target);
  return target;
}

export default { writeJsonAtomic, readJsonWithFallback, quarantine };
