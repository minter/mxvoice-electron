import fs from 'fs';
import path from 'path';

// Same rule as sanitizeProfileName in src/main/modules/profile-paths.js,
// copied because that module needs electron.
function sanitizeProfileName(name) {
  return name.replace(/[^a-zA-Z0-9\s\-_]/g, '').trim();
}

export function profileShowsPath(userDataDir, profileName) {
  return path.join(userDataDir, 'profiles', sanitizeProfileName(profileName), 'shows.json');
}

/**
 * A shows document with one active show holding `layout`.
 * Layout tabs use the state.json shapes; missing tabs are filled in on load.
 */
export function showsDocument(layout, { name = 'Show', id = 'seeded-show' } = {}) {
  const now = Date.now();
  return {
    version: 1,
    activeShowId: id,
    shows: [{ id, name, createdAt: now, updatedAt: now, layout }]
  };
}

/** Hotkey F-key assignments on tab 1, e.g. { f1: '1001' }, as a layout. */
export function hotkeyLayout(hotkeys, { tabName = null } = {}) {
  return {
    hotkeys: [{ tabNumber: 1, tabName, hotkeys }],
    holdingTank: [{ tabNumber: 1, tabName: null, songIds: [] }],
    selected: { hotkeyTab: 1, holdingTankTab: 1 }
  };
}

/**
 * Write a profile's shows.json directly. Until Phase 3 adds Update, this is
 * the only way for an E2E to have a saved show that differs from the live one.
 */
export function seedShows(userDataDir, profileName, doc) {
  const file = profileShowsPath(userDataDir, profileName);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(doc, null, 2));
  return file;
}

/** The crash-recovery record's path, as recovery-store names it. */
export function recoveryRecordPath(userDataDir, profileName) {
  const key = sanitizeProfileName(profileName).toLocaleLowerCase('en-US');
  return path.join(userDataDir, 'recovery', `${key}.json`);
}

export function readRecovery(userDataDir, profileName) {
  try {
    return JSON.parse(fs.readFileSync(recoveryRecordPath(userDataDir, profileName), 'utf8'));
  } catch {
    return null;
  }
}

export function readShows(userDataDir, profileName) {
  return JSON.parse(fs.readFileSync(profileShowsPath(userDataDir, profileName), 'utf8'));
}
