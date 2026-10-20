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
