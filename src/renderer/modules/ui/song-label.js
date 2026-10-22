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
  text.append(piece(doc, 'song-label-title', title), piece(doc, 'song-label-artist', artist));
  el.replaceChildren(text, piece(doc, 'song-label-time', time));
  // The whole label, for tooltips and anything that reads it as text
  el.title = `${title} by ${artist}${time ? ` (${time})` : ''}`;
}

/** Swap two labels' contents (a hotkey drag between slots) */
export function swapSongLabels(a, b) {
  const aNodes = [...a.childNodes];
  const bNodes = [...b.childNodes];
  const aTitle = a.title;
  a.replaceChildren(...bNodes);
  b.replaceChildren(...aNodes);
  a.title = b.title;
  b.title = aTitle;
}

export default { formatDuration, setSongLabel, swapSongLabels };
