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

function getProfilesDirectory() {
  return path.join(getUserDataDirectory(), 'profiles');
}

function getProfileRegistryPath() {
  return path.join(getUserDataDirectory(), 'profiles.json');
}

function getProfileDirectory(profileName) {
  return path.join(getProfilesDirectory(), sanitizeProfileName(profileName));
}

function getProfilePreferencesPath(profileName) {
  return path.join(getProfileDirectory(profileName), 'preferences.json');
}

function getProfileStatePath(profileName) {
  return path.join(getProfileDirectory(profileName), 'state.json');
}

function getBackupBaseDirectory() {
  return path.join(getUserDataDirectory(), 'profile-backups');
}

function getBackupDirectory(profileName) {
  return path.join(getBackupBaseDirectory(), sanitizeProfileName(profileName));
}

function getBackupMetadataPath(profileName) {
  return path.join(getBackupDirectory(profileName), 'backup-metadata.json');
}

export {
  getBackupBaseDirectory,
  getBackupDirectory,
  getBackupMetadataPath,
  getProfileDirectory,
  getProfileDirectoryKey,
  getProfilePreferencesPath,
  getProfileRegistryPath,
  getProfileStatePath,
  getProfilesDirectory,
  sanitizeProfileName
};
