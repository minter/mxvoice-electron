/**
 * Song label: one shape for a song wherever it's listed (hotkey slot,
 * holding tank row): title, then artist, then the duration on its own.
 * Text only, so names can never become markup.
 */

/**
 * "00:21" → "0:21", "4:20" → "4:20", "66:45" → "1:06:45". Anything that
 * isn't minutes:seconds is returned as it is.
 * @param {string} time
 * @returns {string}
 */
export function formatDuration(time) {
  const match = /^(\d+):(\d{1,2})$/.exec(String(time ?? '').trim());
  if (!match) return String(time ?? '');
  const totalMinutes = Number(match[1]);
  const seconds = match[2].padStart(2, '0');
  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = String(totalMinutes % 60).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }
  return `${totalMinutes}:${seconds}`;
}

function piece(doc, className, text) {
  const span = doc.createElement('span');
  span.className = className;
  span.textContent = text;
  return span;
}

/**
 * Fill an element with a song's title, artist and duration.
 * @param {Element} el
 * @param {{ title?: string, artist?: string, time?: string }} row
 */
export function setSongLabel(el, row, doc = globalThis.document) {
  const title = row?.title || '[Unknown Title]';
  const artist = row?.artist || '[Unknown Artist]';
  const time = row?.time ? formatDuration(row.time) : '';
  const text = doc.createElement('span');
  text.className = 'song-label-text';
  // The separators are hidden on screen but stay in the text, so the row
  // still reads "Title by Artist (0:21)" to anything that reads it as text
  text.append(
    piece(doc, 'song-label-title', title),
    piece(doc, 'song-label-sep', ' by '),
    piece(doc, 'song-label-artist', artist)
  );
  // The tooltip lives on the label's own pieces, so clearing the slot
  // (textContent = '') or swapping labels takes it along
  const full = `${title} by ${artist} (${time || '[??:??]'})`;
  text.title = full;
  const timePiece = piece(doc, 'song-label-time', time || '[??:??]');
  timePiece.title = full;
  el.removeAttribute?.('title');
  el.replaceChildren(
    text,
    piece(doc, 'song-label-sep', ' ('),
    timePiece,
    piece(doc, 'song-label-sep', ')')
  );
}

/** Swap two labels' contents (a hotkey drag between slots); tooltips go with them */
export function swapSongLabels(a, b) {
  const aNodes = [...a.childNodes];
  const bNodes = [...b.childNodes];
  a.replaceChildren(...bNodes);
  b.replaceChildren(...aNodes);
}

export default { formatDuration, setSongLabel, swapSongLabels };
