/**
 * Recovery Store
 *
 * One small JSON record per profile holding the live layout of a show in
 * progress, for crash recovery. Records live in userData/recovery, outside the
 * profile directories, so profile backups and switches never touch them.
 *
 * Record: { version: 1, boardId, savedAt, handoff, layout }. `handoff` is null
 * for a normal autosave, or 'update' / 'renderer-crash' once the main process
 * knows why the app is about to restart; a handed-off record also carries
 * `handoffAt`, when it was marked.
 *
 * Only `write` creates the recovery directory; `retire` and `markHandoff`
 * never create anything.
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

export function createRecoveryStore({
  fs = nodeFs,
  getRecoveryPath,
  getRecoveryDirectory,
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

  async function write(profileName, { boardId, layout }) {
    assertProfileName(profileName);
    await fs.promises.mkdir(getRecoveryDirectory(), { recursive: true });
    const record = {
      version: RECOVERY_VERSION,
      boardId,
      savedAt: now(),
      handoff: null,
      layout
    };
    await writeJsonAtomic(getRecoveryPath(profileName), record, { fs });
  }

  async function load(profileName, { quarantineBad }) {
    assertProfileName(profileName);
    const filePath = getRecoveryPath(profileName);
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

  return { write, read, markHandoff, clearHandoff, retire, clearAll };
}

export default { createRecoveryStore };
