/**
 * Show Store
 *
 * Reads and writes a profile's shows.json. The first time a profile is opened
 * after the upgrade there is no shows.json, so the store migrates the
 * profile's state.json (or state.json.backup) into a single show. state.json
 * is never written or deleted. For "Default User" with neither state file, the
 * 3.x/4.0 hotkeys and holding tank in the global config.json are migrated
 * instead, once (the `migration_completed` preference); config.json is never
 * written.
 *
 * Recovery rules for shows.json: a file that fails to parse or fails
 * `parseDocument` with 'shape' is treated as corrupt; it is quarantined and
 * `<file>.prev` is tried. A future-version document ('version') or an I/O read
 * error ('io') throws and leaves every file untouched.
 *
 * A migration whose first write of shows.json fails with an I/O error (disk
 * full, read-only folder, a Windows lock) still opens the migrated show, marked
 * `unsaved` with UNSAVED_MIGRATION_NOTICE. Nothing is written or recorded, so
 * the next save writes shows.json and the next launch migrates again, to the
 * same show id.
 *
 * @module show-store
 */

import nodeFs from 'fs';
import path from 'path';
import { createHash } from 'node:crypto';
import { quarantine, writeJsonAtomic } from './atomic-json-file.js';
import { createDocument, normalizeLayout, parseDocument } from './show-document.js';
import { parseLegacyConfigLayout } from './legacy-config-layout.js';

/** The only profile that inherits the pre-profiles (3.x/4.0) hotkeys and holding tank. */
const LEGACY_PROFILE = 'Default User';

export const RECOVERY_NOTICE =
  "Mx. Voice couldn't read this profile's shows and opened the previous copy.";

export const UNSAVED_MIGRATION_NOTICE =
  "Mx. Voice couldn't save this show yet. Your layout is safe; it will be saved the next time you save the show or open Mx. Voice.";

/** Error thrown by the store; `code` is 'unreadable'|'version'|'unregistered'|'io'|'shape'. */
export class ShowStoreError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'ShowStoreError';
    this.code = code;
  }
}

/**
 * A deterministic, UUID-v4-shaped id for a profile's migrated Default Show, so
 * peek() (used by Import Show) and the real migration in load() agree.
 */
export function migratedShowId(directoryKey) {
  const hex = createHash('sha256').update(`mxvoice:migrated-show:${directoryKey}`).digest('hex').slice(0, 32).split('');
  hex[12] = '4';
  hex[16] = '89ab'[parseInt(hex[16], 16) % 4];
  const h = hex.join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
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
 * Classify one shows file: 'missing', 'bad' (unparseable or wrong shape) or
 * 'good'. Throws ShowStoreError for 'version' and 'io'.
 */
async function classify(fs, filePath) {
  const raw = await readRaw(fs, filePath);
  if (raw.missing) return { state: 'missing' };
  if (raw.ioError) throw new ShowStoreError('io', raw.ioError);
  if (raw.parseError) return { state: 'bad' };
  const parsed = parseDocument(raw.value);
  if (parsed.ok) return { state: 'good', doc: parsed.doc };
  if (parsed.error === 'version') {
    throw new ShowStoreError('version', 'shows file was written by a newer version');
  }
  return { state: 'bad' };
}

/**
 * @param {Object} deps
 * @param {Object} [deps.fs]
 * @param {(profileName: string) => string} deps.getProfileShowsPath
 * @param {(profileName: string) => string} deps.getProfileStatePath
 * @param {(profileName: string) => boolean|Promise<boolean>} deps.profileExists
 * @param {Object} [deps.debugLog]
 * @param {number|(() => number)} [deps.now]
 * @param {() => string} [deps.newId]
 * @param {(profileName: string) => string} [deps.getProfileDirectoryKey] - keys the migrated show id
 * @param {() => string} [deps.getLegacyConfigPath] - the global config.json; omitted, no legacy migration
 * @param {(profileName: string) => Object|null|Promise<Object|null>} [deps.loadProfilePreferences]
 * @param {(profileName: string) => void|Promise<void>} [deps.markMigrationCompleted] - sets migration_completed
 */
export function createShowStore({
  fs = nodeFs,
  getProfileShowsPath,
  getProfileStatePath,
  profileExists,
  getProfileDirectoryKey = (name) => String(name),
  hasUsableDirectoryKey = (name) => getProfileDirectoryKey(name) !== '',
  getLegacyConfigPath,
  loadProfilePreferences = () => null,
  markMigrationCompleted = () => {},
  debugLog,
  now,
  newId
}) {
  const logCtx = (fn) => ({ module: 'show-store', function: fn });
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
      throw new ShowStoreError('unregistered', `Profile "${profileName}" is not registered`);
    }
  }

  // A name that sanitizes to nothing has no folder, so its shows are unreachable
  // and nothing may be written for it (its path would be the shared profiles folder).
  function requireUsableFolder(profileName) {
    if (!hasUsableDirectoryKey(profileName)) {
      throw new ShowStoreError('unreadable', "This profile's name can't be used for a folder");
    }
  }

  /**
   * Inspect the profile's shows files without writing.
   * Returns { kind: 'main'|'prev'|'none'|'unreadable', doc?, mainBad? }.
   */
  async function inspect(profileName) {
    const showsPath = getProfileShowsPath(profileName);
    const main = await classify(fs, showsPath);
    if (main.state === 'good') return { kind: 'main', doc: main.doc };
    const prev = await classify(fs, `${showsPath}.prev`);
    if (prev.state === 'good') return { kind: 'prev', doc: prev.doc, mainBad: main.state === 'bad' };
    if (main.state === 'missing' && prev.state === 'missing') return { kind: 'none' };
    return { kind: 'unreadable' };
  }

  // Migration-created documents get a per-profile id (not newId) so peek and load agree.
  const migrationOptions = (profileName) => ({
    ...docOptions(),
    newId: () => migratedShowId(getProfileDirectoryKey(profileName))
  });

  /**
   * The 3.x/4.0 layout in config.json, or null. Applies only to Default User,
   * once (until migration_completed is true). Throws 'io' when config.json
   * exists but can't be read, so an empty show isn't saved in its place.
   */
  async function legacyConfigLayout(profileName) {
    if (profileName !== LEGACY_PROFILE || !getLegacyConfigPath) return null;
    const preferences = await loadProfilePreferences(profileName);
    if (preferences?.migration_completed === true) return null;
    const raw = await readRaw(fs, getLegacyConfigPath());
    if (raw.ioError) throw new ShowStoreError('io', raw.ioError);
    if (!('value' in raw)) return null;
    return parseLegacyConfigLayout(raw.value);
  }

  /**
   * Build the migrated document in memory from state.json, then
   * state.json.backup, then (Default User only, when neither exists) the
   * legacy config.json.
   */
  async function buildMigration(profileName) {
    const statePath = getProfileStatePath(profileName);
    const candidates = [
      [statePath, 'migrated-state'],
      [`${statePath}.backup`, 'migrated-state-backup']
    ];
    let anyStateFile = false;
    for (const [file, source] of candidates) {
      const raw = await readRaw(fs, file);
      // An unreadable (not absent) state file must not be replaced by an empty show.
      if (raw.ioError) throw new ShowStoreError('io', raw.ioError);
      if (!raw.missing) anyStateFile = true;
      if ('value' in raw && isObject(raw.value)) {
        return { doc: createDocument(normalizeLayout(raw.value), migrationOptions(profileName)), source };
      }
    }
    const legacy = anyStateFile ? null : await legacyConfigLayout(profileName);
    if (legacy) {
      return { doc: createDocument(normalizeLayout(legacy), migrationOptions(profileName)), source: 'migrated-legacy-config' };
    }
    return { doc: createDocument(normalizeLayout(null), migrationOptions(profileName)), source: 'migrated-empty' };
  }

  /** Record that config.json was migrated, so it is never migrated again. */
  async function recordLegacyMigration(profileName) {
    try {
      await markMigrationCompleted(profileName);
    } catch (error) {
      // The show is saved, so the next load reads it; only a lost shows.json would re-migrate.
      debugLog?.warn?.('Could not record migration_completed', { ...logCtx('load'), error: error?.message });
    }
  }

  async function writeNew(profileName, doc) {
    const showsPath = getProfileShowsPath(profileName);
    await fs.promises.mkdir(path.dirname(showsPath), { recursive: true });
    await writeJsonAtomic(showsPath, doc, { keepPrevious: false, fs });
  }

  // An fs failure (it carries a string code such as 'ENOSPC'), not a store refusal or a bug
  const isWriteFailure = (error) => !(error instanceof ShowStoreError) && typeof error?.code === 'string';

  function load(profileName) {
    return serialized(profileName, async () => {
      await requireRegistered(profileName);
      requireUsableFolder(profileName);
      const found = await inspect(profileName);
      if (found.kind === 'main') return { doc: found.doc, source: 'shows' };
      if (found.kind === 'unreadable') {
        throw new ShowStoreError('unreadable', 'shows.json and its previous copy are unreadable');
      }
      if (found.kind === 'prev') {
        const showsPath = getProfileShowsPath(profileName);
        try {
          if (found.mainBad) {
            const moved = await quarantine(showsPath, { fs });
            debugLog?.warn?.('Quarantined unreadable shows file', { ...logCtx('load'), moved });
          }
          // keepPrevious: false leaves .prev intact for the next recovery.
          await writeJsonAtomic(showsPath, found.doc, { keepPrevious: false, fs });
        } catch (error) {
          if (!isWriteFailure(error)) throw error;
          // Open the previous copy anyway, as an unsaved migration does: .prev
          // is untouched, and the next save writes shows.json
          debugLog?.warn?.('Could not restore shows.json from its previous copy', { ...logCtx('load'), code: error.code, error: error.message });
          return { doc: found.doc, source: 'recovered', unsaved: true, notice: RECOVERY_NOTICE };
        }
        return { doc: found.doc, source: 'recovered', notice: RECOVERY_NOTICE };
      }
      const migrated = await buildMigration(profileName);
      try {
        await writeNew(profileName, migrated.doc);
      } catch (error) {
        if (!isWriteFailure(error)) throw error;
        // Open the migrated show anyway; migration_completed stays unset so it migrates again
        debugLog?.warn?.('Could not save the migrated show', { ...logCtx('load'), source: migrated.source, code: error.code, error: error.message });
        return { ...migrated, unsaved: true, notice: UNSAVED_MIGRATION_NOTICE };
      }
      debugLog?.info?.('Migrated state.json into shows', { ...logCtx('load'), source: migrated.source });
      if (migrated.source === 'migrated-legacy-config') await recordLegacyMigration(profileName);
      return migrated;
    });
  }

  async function peek(profileName) {
    try {
      if (!(await profileExists(profileName))) return null;
      if (!hasUsableDirectoryKey(profileName)) return null;
      const found = await inspect(profileName);
      if (found.kind === 'main' || found.kind === 'prev') return found.doc;
      if (found.kind === 'none') return (await buildMigration(profileName)).doc;
      return null;
    } catch (error) {
      if (error instanceof ShowStoreError) return null;
      throw error;
    }
  }

  /**
   * Quarantine whatever is left of shows.json and its previous copy, then
   * write an empty document. It does not try migration, because it is only
   * called after `load` threw 'unreadable'.
   */
  function resetUnreadable(profileName) {
    return serialized(profileName, async () => {
      await requireRegistered(profileName);
      // No folder to quarantine or write: offer an empty show that is never saved
      if (!hasUsableDirectoryKey(profileName)) return { doc: createDocument(normalizeLayout(null), docOptions()) };
      const found = await inspect(profileName);
      // Never destroy a document that turned out to be readable after all.
      if (found.kind === 'main' || found.kind === 'prev') return { doc: found.doc };
      const showsPath = getProfileShowsPath(profileName);
      for (const file of [showsPath, `${showsPath}.prev`]) {
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
      requireUsableFolder(profileName);
      if (!parseDocument(doc).ok) throw new ShowStoreError('shape', 'Refusing to save an invalid show document');
      const showsPath = getProfileShowsPath(profileName);
      // Throws 'io' or 'version' for a main file we must not overwrite.
      await classify(fs, showsPath);
      // A migration that couldn't be saved may not have created the folder
      await fs.promises.mkdir(path.dirname(showsPath), { recursive: true });
      await writeJsonAtomic(showsPath, doc, { keepPrevious: true, fs });
    });
  }

  return { load, peek, resetUnreadable, save };
}

export default { createShowStore, ShowStoreError };
