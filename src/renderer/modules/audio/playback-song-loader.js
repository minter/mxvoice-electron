async function loadSongForPlayback(songId, database) {
  try {
    const result = await database.getSongById(songId);
    const row = result?.success && Array.isArray(result.data) ? result.data[0] : null;
    if (!row) {
      return { success: false, error: result?.error || 'Song not found', result };
    }
    if (!row.filename) {
      return { success: false, error: 'Song has no filename', row, result };
    }
    return { success: true, filename: row.filename, row };
  } catch (error) {
    return { success: false, error: error.message, cause: error };
  }
}

export { loadSongForPlayback };
export default loadSongForPlayback;
