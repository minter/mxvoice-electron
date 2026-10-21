/**
 * Recovery Store
 *
 * One small JSON record per profile holding the live layout of a show in
 * progress, for crash recovery. Records live in userData/recovery, outside the
 * profile directories, so profile backups and switches never touch them.
 *
 * Record: { version: 1, showId, savedAt, handoff, layout }. `handoff` is null
 * for a normal autosave, or 'update' / 'renderer-crash' once the main process
 * knows why the app is about to restart; a handed-off record also carries
 * `handoffAt`, when it was marked.
 *
 * Only `write` creates the recovery directory; `retire`, `discard` and `markHandoff`
 * never create anything.
 *
 * Next to it, `<key>.played.json` holds the night's per-song played counts:
 * { version: 1, savedAt, handoff, counts: { <songId>: n } }, with `handoffAt`
 * once handed off. It is a separate file so retiring the layout record (a
 * layout equal to the saved show) never loses the counts. `clearAll` removes
 * it with the rest, since it ends in .json.
 *
 * `discard` sets both files aside instead of deleting them, as
 * `<key>.discarded.json` and `<key>.played.discarded.json`, replacing any older
 * copy, so a show in progress declined at the crash prompt can still be dug
 * out by hand. Nothing reads them back; `clearAll` removes them too.
 *
 * @module recovery-store
 */

import nodeFs from 'fs';
import path from 'path';
import { quarantine, writeJsonAtomic } from './atomic-json-file.js';

export const RECOVERY_VERSION = 1;
const HANDOFF_REASONS = new Set(['update', 'renderer-crash']);

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function assertProfileName(name) {
  if (typeof name !== 'string' || name.trim() === '') {
    throw new Error('Recovery store requires a non-empty profile name');
  }
}

const SONG_ID = /^\d+$/;

/** Only digit-string song ids with a positive whole count; null when none are left. */
function validCounts(counts) {
  if (!isObject(counts)) return null;
  const entries = Object.entries(counts).filter(([id, n]) => SONG_ID.test(id) && Number.isInteger(n) && n > 0);
  return entries.length ? Object.fromEntries(entries) : null;
}

export function createRecoveryStore({
  fs = nodeFs,
  getRecoveryPath,
  getRecoveryDirectory,
  getPlayedPath = (profileName) => getRecoveryPath(profileName).replace(/\.json$/, '.played.json'),
  debugLog = null,
  now = Date.now
} = {}) {
  const log = (level, message, extra) =>
    debugLog?.[level]?.(message, { module: 'recovery-store', ...extra });

  /** Read the raw record: { missing } | { ioError } | { parseError } | { value }. */
  async function readRaw(filePath) {
    let text;
    try {
      text = await fs.promises.readFile(filePath, 'utf8');
    } catch (error) {
      if (error?.code === 'ENOENT') return { missing: true };
      return { ioError: error };
    }
    try {
      return { value: JSON.parse(text) };
    } catch (error) {
      return { parseError: error };
    }
  }

  async function write(profileName, { showId, layout }) {
    assertProfileName(profileName);
    await fs.promises.mkdir(getRecoveryDirectory(), { recursive: true });
    const record = {
      version: RECOVERY_VERSION,
      showId,
      savedAt: now(),
      handoff: null,
      layout
    };
    await writeJsonAtomic(getRecoveryPath(profileName), record, { fs });
  }

  async function load(profileName, { quarantineBad, filePath = getRecoveryPath(profileName) }) {
    assertProfileName(profileName);
    const raw = await readRaw(filePath);
    if (raw.missing) return null;
    if (raw.ioError) {
      log('warn', 'Could not read recovery record', {
        function: 'read',
        error: raw.ioError.message
      });
      return null;
    }
    if (raw.parseError || !isObject(raw.value) || raw.value.version !== RECOVERY_VERSION) {
      if (!quarantineBad) return null;
      try {
        const target = await quarantine(filePath, { fs });
        log('warn', 'Quarantined unreadable recovery record', { function: 'read', target });
      } catch (error) {
        log('warn', 'Could not quarantine recovery record', {
          function: 'read',
          error: error.message
        });
      }
      return null;
    }
    return raw.value;
  }

  const read = (profileName) => load(profileName, { quarantineBad: true });

  async function markHandoff(profileName, reason) {
    assertProfileName(profileName);
    if (!HANDOFF_REASONS.has(reason)) {
      throw new Error(`Invalid recovery handoff reason: ${String(reason)}`);
    }
    // An unreadable record is left untouched here; read() is what quarantines.
    const record = await load(profileName, { quarantineBad: false });
    if (!record) return false;
    await writeJsonAtomic(getRecoveryPath(profileName), { ...record, handoff: reason, handoffAt: now() }, { fs });
    return true;
  }

  /** Make a handed-off record an ordinary one, keeping savedAt and the layout. */
  async function clearHandoff(profileName) {
    assertProfileName(profileName);
    const record = await load(profileName, { quarantineBad: false });
    if (!record) return false;
    const { handoffAt: _handoffAt, ...rest } = record;
    await writeJsonAtomic(getRecoveryPath(profileName), { ...rest, handoff: null }, { fs });
    return true;
  }

  async function retire(profileName) {
    assertProfileName(profileName);
    await fs.promises.rm(getRecoveryPath(profileName), { force: true });
  }

  /** Rename a file to its .discarded.json copy, replacing an older one; a missing file is fine. */
  async function setAside(filePath) {
    try {
      await fs.promises.rename(filePath, filePath.replace(/\.json$/, '.discarded.json'));
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }

  /** Set the layout record and the played counts aside as discarded copies. */
  async function discard(profileName) {
    assertProfileName(profileName);
    await setAside(getRecoveryPath(profileName));
    await setAside(getPlayedPath(profileName));
  }

  async function clearAll() {
    const dir = getRecoveryDirectory();
    let entries;
    try {
      entries = await fs.promises.readdir(dir);
    } catch (error) {
      if (error?.code === 'ENOENT') return;
      throw error;
    }
    await Promise.all(
      entries
        .filter((name) => name.endsWith('.json'))
        .map((name) => fs.promises.rm(path.join(dir, name), { force: true }))
    );
  }

  /**
   * Write the played counts, replacing the file; no counts removes it.
   * @param {Object} counts - { <songId>: n }
   * @param {{ handoff?: string|null }} [options]
   */
  async function writePlayed(profileName, counts, { handoff = null } = {}) {
    assertProfileName(profileName);
    if (handoff !== null && !HANDOFF_REASONS.has(handoff)) {
      throw new Error(`Invalid recovery handoff reason: ${String(handoff)}`);
    }
    const valid = validCounts(counts);
    if (!valid) {
      await retirePlayed(profileName);
      return;
    }
    await fs.promises.mkdir(getRecoveryDirectory(), { recursive: true });
    const at = now();
    const record = { version: RECOVERY_VERSION, savedAt: at, handoff, ...(handoff ? { handoffAt: at } : {}), counts: valid };
    await writeJsonAtomic(getPlayedPath(profileName), record, { fs });
  }

  /** The played record, or null when missing, unreadable or empty. */
  async function readPlayed(profileName) {
    const record = await load(profileName, { quarantineBad: true, filePath: getPlayedPath(profileName) });
    const counts = validCounts(record?.counts);
    return counts ? { ...record, counts } : null;
  }

  async function retirePlayed(profileName) {
    assertProfileName(profileName);
    await fs.promises.rm(getPlayedPath(profileName), { force: true });
  }

  return { write, read, markHandoff, clearHandoff, retire, discard, clearAll, writePlayed, readPlayed, retirePlayed };
}

export default { createRecoveryStore };
