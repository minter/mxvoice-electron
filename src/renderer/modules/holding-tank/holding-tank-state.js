const TAB_COUNT = 5;

function createTab(tabNumber) {
  return { tabNumber, tabName: null, songIds: [] };
}

function getValidTab(tabs, tabNumber) {
  if (!Number.isInteger(tabNumber) || tabNumber < 1 || tabNumber > TAB_COUNT) {
    throw new RangeError(`tabNumber must be between 1 and ${TAB_COUNT}`);
  }
  return tabs[tabNumber - 1];
}

function normalizeSongId(songId) {
  if (songId === null || songId === undefined || String(songId).trim() === '') {
    throw new TypeError('songId must be a non-empty value');
  }
  return String(songId);
}

export class HoldingTankState {
  constructor(snapshot = []) {
    this.tabs = Array.from({ length: TAB_COUNT }, (_, index) => createTab(index + 1));
    this.listeners = new Set();
    this.loadFromSnapshot(snapshot, { notify: false });
  }

  subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('listener must be a function');
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  add(tabNumber, songId, index) {
    const songs = getValidTab(this.tabs, tabNumber).songIds;
    const normalizedSongId = normalizeSongId(songId);
    const insertionIndex = index === undefined ? songs.length : index;
    if (!Number.isInteger(insertionIndex) || insertionIndex < 0 || insertionIndex > songs.length) {
      throw new RangeError('index must be a valid insertion position');
    }
    songs.splice(insertionIndex, 0, normalizedSongId);
    this.#notify();
  }

  removeAt(tabNumber, index) {
    const songs = getValidTab(this.tabs, tabNumber).songIds;
    if (!Number.isInteger(index) || index < 0 || index >= songs.length) return null;
    const [removed] = songs.splice(index, 1);
    this.#notify();
    return removed;
  }

  replaceTab(tabNumber, songIds) {
    if (!Array.isArray(songIds)) throw new TypeError('songIds must be an array');
    const tab = getValidTab(this.tabs, tabNumber);
    const normalized = songIds.map(normalizeSongId);
    if (normalized.length === tab.songIds.length && normalized.every((id, index) => id === tab.songIds[index])) return false;
    tab.songIds = normalized;
    this.#notify();
    return true;
  }

  clearTab(tabNumber) {
    const tab = getValidTab(this.tabs, tabNumber);
    if (tab.songIds.length === 0) return false;
    tab.songIds = [];
    this.#notify();
    return true;
  }

  clearSong(songId) {
    const normalizedSongId = normalizeSongId(songId);
    let changed = false;
    for (const tab of this.tabs) {
      const filtered = tab.songIds.filter(id => id !== normalizedSongId);
      if (filtered.length !== tab.songIds.length) {
        tab.songIds = filtered;
        changed = true;
      }
    }
    if (changed) this.#notify();
    return changed;
  }

  renameTab(tabNumber, tabName) {
    const tab = getValidTab(this.tabs, tabNumber);
    const normalizedName = tabName === null || tabName === undefined || String(tabName).trim() === ''
      ? null
      : String(tabName).trim();
    if (tab.tabName === normalizedName) return false;
    tab.tabName = normalizedName;
    this.#notify();
    return true;
  }

  loadFromSnapshot(snapshot, { notify = true } = {}) {
    if (!Array.isArray(snapshot)) throw new TypeError('snapshot must be an array');
    const tabs = Array.from({ length: TAB_COUNT }, (_, index) => createTab(index + 1));
    for (const source of snapshot) {
      const tabNumber = Number(source?.tabNumber);
      if (!Number.isInteger(tabNumber) || tabNumber < 1 || tabNumber > TAB_COUNT) continue;
      const tab = tabs[tabNumber - 1];
      tab.tabName = source.tabName === null || source.tabName === undefined ? null : String(source.tabName);
      tab.songIds = Array.isArray(source.songIds)
        ? source.songIds.filter(id => id !== null && id !== undefined && String(id).trim() !== '').map(String)
        : [];
    }
    this.tabs = tabs;
    if (notify) this.#notify();
    return this;
  }

  toSnapshot() {
    return this.tabs.map(tab => ({
      tabNumber: tab.tabNumber,
      tabName: tab.tabName,
      songIds: [...tab.songIds]
    }));
  }

  #notify() {
    const snapshot = this.toSnapshot();
    for (const listener of this.listeners) listener(snapshot);
  }
}

export default HoldingTankState;
