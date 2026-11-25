import path from 'path';
import { randomUUID } from 'crypto';

const DIRECTORY_PREFERENCE_KEYS = new Set([
  'database_directory',
  'music_directory',
  'hotkey_directory'
]);

const AUTHORIZATION_TTL_MS = 10 * 60 * 1000;

function normalizeDirectory(directory) {
  if (typeof directory !== 'string' || directory.trim() === '') {
    throw new Error('Invalid directory path');
  }
  return path.resolve(directory);
}

function createDirectoryPreferenceAuthority({ store, now = () => Date.now() }) {
  let musicDirectory = null;
  function refreshFromStore() {
    const configuredMusicDirectory = store.get('music_directory');
    musicDirectory = typeof configuredMusicDirectory === 'string' && configuredMusicDirectory.trim() !== ''
      ? path.resolve(configuredMusicDirectory)
      : null;
    return musicDirectory;
  }
  refreshFromStore();

  const authorizations = new Map();

  function supports(key) {
    return DIRECTORY_PREFERENCE_KEYS.has(key);
  }

  function authorizeSelection(key, directory, sender) {
    if (!supports(key)) throw new Error('Unsupported directory preference');
    if (!sender) throw new Error('Directory selection is missing its IPC sender');

    const selectedDirectory = normalizeDirectory(directory);
    const token = randomUUID();
    authorizations.set(token, {
      key,
      directory: selectedDirectory,
      sender,
      expiresAt: now() + AUTHORIZATION_TTL_MS
    });
    return token;
  }

  function setDirectoryPreference(key, token, sender) {
    if (!supports(key)) throw new Error('Unsupported directory preference');
    if (typeof token !== 'string' || token === '') {
      throw new Error('Directory change requires a native picker authorization');
    }

    const authorization = authorizations.get(token);
    authorizations.delete(token);
    if (!authorization || authorization.expiresAt < now()) {
      throw new Error('Directory picker authorization is invalid or expired');
    }
    if (authorization.key !== key || authorization.sender !== sender) {
      throw new Error('Directory picker authorization does not match this request');
    }

    store.set(key, authorization.directory);
    if (key === 'music_directory') musicDirectory = authorization.directory;
    return authorization.directory;
  }

  return Object.freeze({
    supports,
    authorizeSelection,
    setDirectoryPreference,
    refreshFromStore,
    getMusicDirectory: () => musicDirectory
  });
}

export { DIRECTORY_PREFERENCE_KEYS, createDirectoryPreferenceAuthority };
