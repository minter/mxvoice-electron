/**
 * Board messages shared by startup and the Board menu commands.
 */

export const TOAST_MS = 6000;

/** "N song(s) in this board aren't in the library.", or null for none. */
export function droppedSongsMessage(dropped) {
  if (!dropped) return null;
  return dropped === 1
    ? "1 song in this board isn't in the library."
    : `${dropped} songs in this board aren't in the library.`;
}

/** "N song(s) in this file aren't in your library.", or null for none. */
export function droppedSongsFileMessage(dropped) {
  if (!dropped) return null;
  return dropped === 1
    ? "1 song in this file isn't in your library."
    : `${dropped} songs in this file aren't in your library.`;
}

export const IMPORT_NOT_READY_MESSAGE = 'Wait for the board to finish loading, then import again.';
