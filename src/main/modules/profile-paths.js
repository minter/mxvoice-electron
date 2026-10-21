import path from 'path';
import electron from 'electron';

const { app } = electron;

function getUserDataDirectory() {
  return app.getPath('userData');
}

function sanitizeProfileName(name) {
  return name.replace(/[^a-zA-Z0-9\s\-_]/g, '').trim();
}

function getProfileDirectoryKey(name) {
  return sanitizeProfileName(name).toLocaleLowerCase('en-US');
}

/**
 * False for a name that sanitizes to nothing (for example only non-Latin
 * characters or emoji). Such a name would map to the shared parent folder,
 * so no per-profile path may be built from it.
 */
function hasUsableDirectoryKey(name) {
  return typeof name === 'string' && getProfileDirectoryKey(name) !== '';
}

function requireUsableDirectoryKey(name) {
  if (!hasUsableDirectoryKey(name)) throw new Error('Profile name has no usable folder name');
}

function getProfilesDirectory() {
  return path.join(getUserDataDirectory(), 'profiles');
}

function getProfileRegistryPath() {
  return path.join(getUserDataDirectory(), 'profiles.json');
}

function getProfileDirectory(profileName) {
  requireUsableDirectoryKey(profileName);
  return path.join(getProfilesDirectory(), sanitizeProfileName(profileName));
}

function getProfilePreferencesPath(profileName) {
  return path.join(getProfileDirectory(profileName), 'preferences.json');
}

function getProfileStatePath(profileName) {
  return path.join(getProfileDirectory(profileName), 'state.json');
}

function getProfileShowsPath(profileName) {
  return path.join(getProfileDirectory(profileName), 'shows.json');
}

function getRecoveryDirectory() {
  return path.join(getUserDataDirectory(), 'recovery');
}

function getRecoveryPath(profileName) {
  requireUsableDirectoryKey(profileName);
  return path.join(getRecoveryDirectory(), `${getProfileDirectoryKey(profileName)}.json`);
}

function getBackupBaseDirectory() {
  return path.join(getUserDataDirectory(), 'profile-backups');
}

function getBackupDirectory(profileName) {
  requireUsableDirectoryKey(profileName);
  return path.join(getBackupBaseDirectory(), sanitizeProfileName(profileName));
}

function getBackupMetadataPath(profileName) {
  return path.join(getBackupDirectory(profileName), 'backup-metadata.json');
}

export {
  getBackupBaseDirectory,
  getBackupDirectory,
  getBackupMetadataPath,
  getProfileShowsPath,
  getProfileDirectory,
  getProfileDirectoryKey,
  getProfilePreferencesPath,
  getProfileRegistryPath,
  getProfileStatePath,
  getProfilesDirectory,
  getRecoveryDirectory,
  getRecoveryPath,
  hasUsableDirectoryKey,
  sanitizeProfileName
};
