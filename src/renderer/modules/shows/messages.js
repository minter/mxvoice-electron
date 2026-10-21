/**
 * Show messages shared by startup and the Shows menu commands.
 */

export const TOAST_MS = 6000;

/** "N song(s) in this show aren't in the library.", or null for none. */
export function droppedSongsMessage(dropped) {
  if (!dropped) return null;
  return dropped === 1
    ? "1 song in this show isn't in the library."
    : `${dropped} songs in this show aren't in the library.`;
}

/** "N song(s) in this file aren't in your library.", or null for none. */
export function droppedSongsFileMessage(dropped) {
  if (!dropped) return null;
  return dropped === 1
    ? "1 song in this file isn't in your library."
    : `${dropped} songs in this file aren't in your library.`;
}

export const IMPORT_NOT_READY_MESSAGE = 'Wait for the show to finish loading, then try again.';
export const NO_SONGS_MESSAGE = 'This file has no songs to import.';

export const LOAD_FAILED_MESSAGE = "Mx. Voice couldn't load this show. Your saved shows were not changed.";
