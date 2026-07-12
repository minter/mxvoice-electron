const TAB_COUNT = 5;
const KEY_COUNT = 12;

function assertTabNumber(tabNumber) {
  if (!Number.isInteger(tabNumber) || tabNumber < 1 || tabNumber > TAB_COUNT) {
    throw new RangeError(`tabNumber must be between 1 and ${TAB_COUNT}`);
  }
}

function normalizeKey(key) {
  const normalized = String(key).toLowerCase();
  if (!/^f(?:[1-9]|1[0-2])$/.test(normalized)) {
    throw new RangeError(`key must be between f1 and f${KEY_COUNT}`);
  }
  return normalized;
}

function normalizeSongId(songId) {
  if (songId === null || songId === undefined || String(songId).trim() === '') {
    throw new TypeError('songId must be a non-empty value');
  }
  return String(songId);
}

function createTab(tabNumber) {
  return { tabNumber, tabName: null, assignments: new Map() };
}

/**
 * Pure in-memory model for the five hotkey tabs.
 *
 * Song metadata, rendering, and persistence deliberately live outside this
 * class. Subscribers receive one notification after each logical mutation.
 */
export class HotkeyState {
  constructor(snapshot = []) {
    this.tabs = Array.from({ length: TAB_COUNT }, (_, index) => createTab(index + 1));
    this.listeners = new Set();
    this.batchDepth = 0;
    this.batchChanged = false;
    this.loadFromSnapshot(snapshot, { notify: false });
  }

  subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('listener must be a function');
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  batch(operation) {
    if (typeof operation !== 'function') throw new TypeError('operation must be a function');
    this.batchDepth += 1;
    try {
      return operation();
    } finally {
      this.batchDepth -= 1;
      if (this.batchDepth === 0 && this.batchChanged) {
        this.batchChanged = false;
        this.#notify();
      }
    }
  }

  getAssignment(tabNumber, key) {
    return this.#getTab(tabNumber).assignments.get(normalizeKey(key)) ?? null;
  }

  assign(tabNumber, key, songId) {
    const tab = this.#getTab(tabNumber);
    const normalizedKey = normalizeKey(key);
    const normalizedSongId = normalizeSongId(songId);
    const currentSongId = tab.assignments.get(normalizedKey);
    if (currentSongId === normalizedSongId) return false;

    const duplicate = [...tab.assignments].find(([, id]) => id === normalizedSongId);
    if (duplicate) {
      const [duplicateKey] = duplicate;
      if (currentSongId === undefined) tab.assignments.delete(duplicateKey);
      else tab.assignments.set(duplicateKey, currentSongId);
    }
    tab.assignments.set(normalizedKey, normalizedSongId);
    this.#changed();
    return true;
  }

  clear(tabNumber, key) {
    const changed = this.#getTab(tabNumber).assignments.delete(normalizeKey(key));
    if (changed) this.#changed();
    return changed;
  }

  clearTab(tabNumber) {
    const tab = this.#getTab(tabNumber);
    if (tab.assignments.size === 0) return false;
    tab.assignments.clear();
    this.#changed();
    return true;
  }

  clearSong(songId) {
    const normalizedSongId = normalizeSongId(songId);
    let changed = false;
    for (const tab of this.tabs) {
      for (const [key, assignedSongId] of tab.assignments) {
        if (assignedSongId === normalizedSongId) {
          tab.assignments.delete(key);
          changed = true;
        }
      }
    }
    if (changed) this.#changed();
    return changed;
  }

  renameTab(tabNumber, tabName) {
    const tab = this.#getTab(tabNumber);
    const normalizedName = tabName === null || tabName === undefined || String(tabName).trim() === ''
      ? null
      : String(tabName).trim();
    if (tab.tabName === normalizedName) return false;
    tab.tabName = normalizedName;
    this.#changed();
    return true;
  }

  loadFromSnapshot(snapshot, { notify = true } = {}) {
    if (!Array.isArray(snapshot)) throw new TypeError('snapshot must be an array');
    const nextTabs = Array.from({ length: TAB_COUNT }, (_, index) => createTab(index + 1));

    for (const tabSnapshot of snapshot) {
      if (!tabSnapshot || typeof tabSnapshot !== 'object') continue;
      const tabNumber = Number(tabSnapshot.tabNumber);
      if (!Number.isInteger(tabNumber) || tabNumber < 1 || tabNumber > TAB_COUNT) continue;
      const tab = nextTabs[tabNumber - 1];
      tab.tabName = tabSnapshot.tabName === null || tabSnapshot.tabName === undefined
        ? null
        : String(tabSnapshot.tabName);

      const hotkeys = tabSnapshot.hotkeys;
      if (!hotkeys || typeof hotkeys !== 'object' || Array.isArray(hotkeys)) continue;
      for (let keyNumber = 1; keyNumber <= KEY_COUNT; keyNumber++) {
        const key = `f${keyNumber}`;
        const songId = hotkeys[key];
        if (songId !== null && songId !== undefined && String(songId).trim() !== '') {
          tab.assignments.set(key, String(songId));
        }
      }
    }

    this.tabs = nextTabs;
    if (notify) this.#changed();
    return this;
  }

  toSnapshot() {
    return this.tabs.map(({ tabNumber, tabName, assignments }) => ({
      tabNumber,
      tabName,
      hotkeys: Object.fromEntries(assignments)
    }));
  }

  #getTab(tabNumber) {
    assertTabNumber(tabNumber);
    return this.tabs[tabNumber - 1];
  }

  #changed() {
    if (this.batchDepth > 0) this.batchChanged = true;
    else this.#notify();
  }

  #notify() {
    const snapshot = this.toSnapshot();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (error) {
        // A renderer or persistence subscriber must not prevent the remaining
        // subscribers from observing the same completed mutation.
        globalThis.window?.debugLog?.error('Hotkey state subscriber failed', {
          module: 'hotkey-state',
          function: 'notify',
          error: error.message
        });
      }
    }
  }
}

export default HotkeyState;
