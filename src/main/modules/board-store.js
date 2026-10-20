/**
 * Board Store
 *
 * Reads and writes a profile's boards.json. The first time a profile is opened
 * after the upgrade there is no boards.json, so the store migrates the
 * profile's state.json (or state.json.backup) into a single board. state.json
 * is never written or deleted.
 *
 * Recovery rules for boards.json: a file that fails to parse or fails
 * `parseDocument` with 'shape' is treated as corrupt; it is quarantined and
 * `<file>.prev` is tried. A future-version document ('version') or an I/O read
 * error ('io') throws and leaves every file untouched.
 *
 * @module board-store
 */

import nodeFs from 'fs';
import path from 'path';
import { quarantine, writeJsonAtomic } from './atomic-json-file.js';
import { createDocument, normalizeLayout, parseDocument } from './board-document.js';

export const RECOVERY_NOTICE =
  "Mx. Voice couldn't read this profile's boards and opened the previous copy.";

/** Error thrown by the store; `code` is 'unreadable'|'version'|'unregistered'|'io'|'shape'. */
export class BoardStoreError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'BoardStoreError';
    this.code = code;
  }
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Read and JSON-parse a file: { missing } | { ioError } | { parseError } | { value }. */
async function readRaw(fs, filePath) {
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
    return { parseError: error.message };
  }
}

/**
 * Classify one boards file: 'missing', 'bad' (unparseable or wrong shape) or
 * 'good'. Throws BoardStoreError for 'version' and 'io'.
 */
async function classify(fs, filePath) {
  const raw = await readRaw(fs, filePath);
  if (raw.missing) return { state: 'missing' };
  if (raw.ioError) throw new BoardStoreError('io', raw.ioError);
  if (raw.parseError) return { state: 'bad' };
  const parsed = parseDocument(raw.value);
  if (parsed.ok) return { state: 'good', doc: parsed.doc };
  if (parsed.error === 'version') {
    throw new BoardStoreError('version', 'boards file was written by a newer version');
  }
  return { state: 'bad' };
}

/**
 * @param {Object} deps
 * @param {Object} [deps.fs]
 * @param {(profileName: string) => string} deps.getProfileBoardsPath
 * @param {(profileName: string) => string} deps.getProfileStatePath
 * @param {(profileName: string) => boolean|Promise<boolean>} deps.profileExists
 * @param {Object} [deps.debugLog]
 * @param {number|(() => number)} [deps.now]
 * @param {() => string} [deps.newId]
 */
export function createBoardStore({
  fs = nodeFs,
  getProfileBoardsPath,
  getProfileStatePath,
  profileExists,
  debugLog,
  now,
  newId
}) {
  const logCtx = (fn) => ({ module: 'board-store', function: fn });
  const docOptions = () => {
    const options = {};
    if (now !== undefined) options.now = typeof now === 'function' ? now() : now;
    if (newId) options.newId = newId;
    return options;
  };

  // One operation at a time per profile, so concurrent loads can't migrate twice.
  const queues = new Map();
  function serialized(profileName, task) {
    const previous = queues.get(profileName) || Promise.resolve();
    const run = previous.then(task, task);
    const tail = run.catch(() => {});
    queues.set(profileName, tail);
    tail.then(() => {
      if (queues.get(profileName) === tail) queues.delete(profileName);
    });
    return run;
  }

  async function requireRegistered(profileName) {
    if (!(await profileExists(profileName))) {
      throw new BoardStoreError('unregistered', `Profile "${profileName}" is not registered`);
    }
  }

  /**
   * Inspect the profile's boards files without writing.
   * Returns { kind: 'main'|'prev'|'none'|'unreadable', doc?, mainBad? }.
   */
  async function inspect(profileName) {
    const boardsPath = getProfileBoardsPath(profileName);
    const main = await classify(fs, boardsPath);
    if (main.state === 'good') return { kind: 'main', doc: main.doc };
    const prev = await classify(fs, `${boardsPath}.prev`);
    if (prev.state === 'good') return { kind: 'prev', doc: prev.doc, mainBad: main.state === 'bad' };
    if (main.state === 'missing' && prev.state === 'missing') return { kind: 'none' };
    return { kind: 'unreadable' };
  }

  /** Build the migrated document from state.json, then state.json.backup, in memory. */
  async function buildMigration(profileName) {
    const statePath = getProfileStatePath(profileName);
    const candidates = [
      [statePath, 'migrated-state'],
      [`${statePath}.backup`, 'migrated-state-backup']
    ];
    for (const [file, source] of candidates) {
      const raw = await readRaw(fs, file);
      // An unreadable (not absent) state file must not be replaced by an empty board.
      if (raw.ioError) throw new BoardStoreError('io', raw.ioError);
      if ('value' in raw && isObject(raw.value)) {
        return { doc: createDocument(normalizeLayout(raw.value), docOptions()), source };
      }
    }
    return { doc: createDocument(normalizeLayout(null), docOptions()), source: 'migrated-empty' };
  }

  async function writeNew(profileName, doc) {
    const boardsPath = getProfileBoardsPath(profileName);
    await fs.promises.mkdir(path.dirname(boardsPath), { recursive: true });
    await writeJsonAtomic(boardsPath, doc, { keepPrevious: false, fs });
  }

  function load(profileName) {
    return serialized(profileName, async () => {
      await requireRegistered(profileName);
      const found = await inspect(profileName);
      if (found.kind === 'main') return { doc: found.doc, source: 'boards' };
      if (found.kind === 'unreadable') {
        throw new BoardStoreError('unreadable', 'boards.json and its previous copy are unreadable');
      }
      if (found.kind === 'prev') {
        const boardsPath = getProfileBoardsPath(profileName);
        if (found.mainBad) {
          const moved = await quarantine(boardsPath, { fs });
          debugLog?.warn?.('Quarantined unreadable boards file', { ...logCtx('load'), moved });
        }
        // keepPrevious: false leaves .prev intact for the next recovery.
        await writeJsonAtomic(boardsPath, found.doc, { keepPrevious: false, fs });
        return { doc: found.doc, source: 'recovered', notice: RECOVERY_NOTICE };
      }
      const migrated = await buildMigration(profileName);
      await writeNew(profileName, migrated.doc);
      debugLog?.info?.('Migrated state.json into boards', { ...logCtx('load'), source: migrated.source });
      return migrated;
    });
  }

  async function peek(profileName) {
    try {
      if (!(await profileExists(profileName))) return null;
      const found = await inspect(profileName);
      if (found.kind === 'main' || found.kind === 'prev') return found.doc;
      if (found.kind === 'none') return (await buildMigration(profileName)).doc;
      return null;
    } catch (error) {
      if (error instanceof BoardStoreError) return null;
      throw error;
    }
  }

  /**
   * Quarantine whatever is left of boards.json and its previous copy, then
   * write an empty document. It does not try migration, because it is only
   * called after `load` threw 'unreadable'.
   */
  function resetUnreadable(profileName) {
    return serialized(profileName, async () => {
      await requireRegistered(profileName);
      const found = await inspect(profileName);
      // Never destroy a document that turned out to be readable after all.
      if (found.kind === 'main' || found.kind === 'prev') return { doc: found.doc };
      const boardsPath = getProfileBoardsPath(profileName);
      for (const file of [boardsPath, `${boardsPath}.prev`]) {
        try {
          await quarantine(file, { fs });
        } catch (error) {
          if (error?.code !== 'ENOENT') throw error;
        }
      }
      const doc = createDocument(normalizeLayout(null), docOptions());
      await writeNew(profileName, doc);
      return { doc };
    });
  }

  function save(profileName, doc) {
    return serialized(profileName, async () => {
      await requireRegistered(profileName);
      if (!parseDocument(doc).ok) throw new BoardStoreError('shape', 'Refusing to save an invalid board document');
      const boardsPath = getProfileBoardsPath(profileName);
      // Throws 'io' or 'version' for a main file we must not overwrite.
      await classify(fs, boardsPath);
      await writeJsonAtomic(boardsPath, doc, { keepPrevious: true, fs });
    });
  }

  return { load, peek, resetUnreadable, save };
}

export default { createBoardStore, BoardStoreError };
