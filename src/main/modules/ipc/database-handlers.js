/**
 * Database IPC handlers.
 * Bodies moved verbatim from ipc-handlers.js — see that file's git history.
 */

import electron from 'electron';
const { ipcMain } = electron;
import ipcChannels from '../../../shared/ipc-channels.cjs';
const { IPC } = ipcChannels;

export function register(deps) {
  const { getDb, debugLog, getMainWindow } = deps;

  // Named database API handlers
  ipcMain.handle(IPC.DATABASE.GET_CATEGORIES, async () => {
    try {
      if (!getDb()) {
        throw new Error('Database not initialized');
      }

      // For node-sqlite3-wasm, use prepare/all for consistent results
      const sql = 'SELECT * FROM categories ORDER BY description ASC';
      debugLog?.info('Executing categories query', {
        module: 'ipc-handlers',
        function: 'get-categories',
        sql
      });

      const stmt = getDb().prepare(sql);
      const result = stmt.all([]);
      stmt.finalize();

      debugLog?.info('Raw categories result', {
        module: 'ipc-handlers',
        function: 'get-categories',
        resultType: typeof result,
        resultLength: Array.isArray(result) ? result.length : 'not array',
        result: result
      });

      return { success: true, data: result || [] };
    } catch (error) {
      debugLog?.error('Get categories error', {
        module: 'ipc-handlers',
        function: 'get-categories',
        error: error.message
      });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.DATABASE.ADD_SONG, async (event, songData) => {
    try {
      if (!getDb()) {
        throw new Error('Database not initialized');
      }

      debugLog?.info('Adding song to database:', {
        module: 'ipc-handlers',
        function: 'add-song',
        songData
      });

      // For node-sqlite3-wasm, use prepare/run for parameterized statements
      const stmt = getDb().prepare(`
        INSERT INTO mrvoice (title, artist, category, info, filename, time, modtime, volume, start_time, end_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run([songData.title, songData.artist, songData.category,
                              songData.info || '', songData.filename, songData.duration || '00:00', Math.floor(Date.now() / 1000),
                              songData.volume ?? 100, songData.start_time ?? null, songData.end_time ?? null]);

      stmt.finalize();

      debugLog?.info('Raw database result:', {
        module: 'ipc-handlers',
        function: 'add-song',
        result,
        resultType: typeof result,
        hasChanges: 'changes' in result,
        hasLastInsertRowid: 'lastInsertRowid' in result,
        changes: result.changes,
        lastInsertRowid: result.lastInsertRowid
      });

      return { success: true, data: { changes: result.changes || 0, lastInsertRowid: result.lastInsertRowid || 0 } };
    } catch (error) {
      debugLog?.error('Add song error:', { module: 'ipc-handlers', function: 'add-song', error: error.message });
      return { success: false, error: error.message };
    }
  });

  // Enhanced database operations for secure API
  ipcMain.handle(IPC.DATABASE.GET_SONG_BY_ID, async (event, songId) => {
    try {
      if (!getDb()) {
        throw new Error('Database not initialized');
      }
      if (!songId) {
        throw new Error('Song ID is required');
      }
      // For node-sqlite3-wasm, use prepare/get for parameterized queries
      const stmt = getDb().prepare('SELECT * FROM mrvoice WHERE id = ?');
      const result = stmt.get(songId);
      stmt.finalize();

      // Convert result to expected format
      const data = result ? [result] : [];
      return { success: true, data: data };
    } catch (error) {
      debugLog?.error('Get song by ID error:', { module: 'ipc-handlers', function: 'get-song-by-id', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.DATABASE.DELETE_SONG, async (event, songId) => {
    try {
      if (!getDb()) {
        throw new Error('Database not initialized');
      }
      if (!songId) {
        throw new Error('Song ID is required');
      }
      // For node-sqlite3-wasm, use prepare/run for parameterized statements
      const stmt = getDb().prepare('DELETE FROM mrvoice WHERE id = ?');
      const result = stmt.run(songId);
      stmt.finalize();

      return { success: true, data: { changes: result.changes || 0 } };
    } catch (error) {
      debugLog?.error('Delete song error:', { module: 'ipc-handlers', function: 'delete-song', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.DATABASE.DELETE_SELECTED_SONG, async () => {
    try {
      // This handler sends a message to the renderer to trigger deletion
      // The actual deletion logic is handled in the renderer
      getMainWindow().webContents.send('delete_selected_song');
      return { success: true };
    } catch (error) {
      debugLog?.error('Delete selected song error:', { module: 'ipc-handlers', function: 'delete-selected-song', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.DATABASE.EDIT_SELECTED_SONG, async () => {
    try {
      // This handler sends a message to the renderer to trigger editing
      // The actual editing logic is handled in the renderer
      getMainWindow().webContents.send('edit_selected_song');
      return { success: true };
    } catch (error) {
      debugLog?.error('Edit selected song error:', { module: 'ipc-handlers', function: 'edit-selected-song', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.DATABASE.UPDATE_SONG, async (event, songData) => {
    try {
      if (!getDb()) {
        throw new Error('Database not initialized');
      }
      if (!songData || !songData.id) {
        throw new Error('Song data with ID is required');
      }
      // Build UPDATE dynamically to only set provided fields
      const setClauses = [];
      const params = [];

      if (songData.title !== undefined) { setClauses.push('title = ?'); params.push(songData.title); }
      if (songData.artist !== undefined) { setClauses.push('artist = ?'); params.push(songData.artist); }
      if (songData.category !== undefined) { setClauses.push('category = ?'); params.push(songData.category); }
      if (songData.info !== undefined) { setClauses.push('info = ?'); params.push(songData.info); }
      if (songData.filename !== undefined) { setClauses.push('filename = ?'); params.push(songData.filename); }
      if (songData.duration !== undefined) { setClauses.push('time = ?'); params.push(songData.duration); }
      if (songData.volume !== undefined) { setClauses.push('volume = ?'); params.push(songData.volume); }
      if (songData.start_time !== undefined) { setClauses.push('start_time = ?'); params.push(songData.start_time); }
      if (songData.end_time !== undefined) { setClauses.push('end_time = ?'); params.push(songData.end_time); }

      if (setClauses.length === 0) {
        throw new Error('No fields to update');
      }

      params.push(songData.id);
      const stmt = getDb().prepare(`UPDATE mrvoice SET ${setClauses.join(', ')} WHERE id = ?`);
      const result = stmt.run(params);

      stmt.finalize();

      return { success: true, data: { changes: result.changes || 0 } };
    } catch (error) {
      debugLog?.error('Update song error:', { module: 'ipc-handlers', function: 'update-song', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.DATABASE.ADD_CATEGORY, async (event, categoryData) => {
    try {
      if (!getDb()) {
        throw new Error('Database not initialized');
      }

      if (!categoryData || !categoryData.code || !categoryData.description) {
        throw new Error('Category code and description are required');
      }

      // For node-sqlite3-wasm, use prepare/run for parameterized statements
      const stmt = getDb().prepare('INSERT INTO categories (code, description) VALUES (?, ?)');
      const result = stmt.run([categoryData.code, categoryData.description]);
      stmt.finalize();

      return { success: true, data: { changes: result.changes || 0, lastInsertRowid: result.lastInsertRowid || 0 } };
    } catch (error) {
      debugLog?.error('Add category error:', { module: 'ipc-handlers', function: 'add-category', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.DATABASE.UPDATE_CATEGORY, async (event, code, description) => {
    try {
      if (!getDb()) {
        throw new Error('Database not initialized');
      }
      if (!code || !description) {
        throw new Error('Category code and description are required');
      }
      // For node-sqlite3-wasm, use prepare/run for parameterized statements
      const stmt = getDb().prepare('UPDATE categories SET description = ? WHERE code = ?');
      const result = stmt.run([description, code]);
      stmt.finalize();

      return { success: true, data: { changes: result.changes || 0 } };
    } catch (error) {
      debugLog?.error('Update category error:', { module: 'ipc-handlers', function: 'update-category', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.DATABASE.DELETE_CATEGORY, async (event, code, _description) => {
    try {
      if (!getDb()) {
        throw new Error('Database not initialized');
      }
      if (!code) {
        throw new Error('Category code is required');
      }
      if (code === 'UNC') {
        throw new Error('Cannot delete the Uncategorized (UNC) category');
      }

      // Ensure the UNC (Uncategorized) category exists
      const upsertStmt = getDb().prepare('INSERT OR REPLACE INTO categories VALUES(?, ?)');
      upsertStmt.run(['UNC', 'Uncategorized']);
      upsertStmt.finalize();

      // Move all songs from the deleted category to UNC
      const updateStmt = getDb().prepare('UPDATE mrvoice SET category = ? WHERE category = ?');
      updateStmt.run(['UNC', code]);
      updateStmt.finalize();

      // Then delete the category
      const deleteStmt = getDb().prepare('DELETE FROM categories WHERE code = ?');
      const result = deleteStmt.run([code]);
      deleteStmt.finalize();

      return { success: true, data: { changes: result.changes || 0 } };
    } catch (error) {
      debugLog?.error('Delete category error:', { module: 'ipc-handlers', function: 'delete-category', error: error.message });
      return { success: false, error: error.message };
    }
  });

  // Named database operations — search, batch, and category helpers

  ipcMain.handle(IPC.DATABASE.SEARCH_SONGS, async (event, searchParams) => {
    try {
      if (!getDb()) {
        throw new Error('Database not initialized');
      }
      if (!searchParams || typeof searchParams !== 'object') {
        throw new Error('Search parameters object is required');
      }

      const querySegments = [];
      const queryParams = [];

      // Category filter
      if (searchParams.category && searchParams.category !== '*') {
        querySegments.push('category = ?');
        queryParams.push(searchParams.category);
      }

      if (searchParams.advancedFilters) {
        // Advanced search mode
        const { title, artist, info, since } = searchParams.advancedFilters;
        if (title && title.length) {
          querySegments.push('title LIKE ?');
          queryParams.push(`%${title}%`);
        }
        if (artist && artist.length) {
          querySegments.push('artist LIKE ?');
          queryParams.push(`%${artist}%`);
        }
        if (info && info.length) {
          querySegments.push('info LIKE ?');
          queryParams.push(`%${info}%`);
        }
        if (since && since.length) {
          let thresholdSeconds = null;
          if (/^\d+$/.test(since)) {
            const days = parseInt(since, 10);
            thresholdSeconds = Math.floor(Date.now() / 1000) - (days * 86400);
          } else {
            const parsed = Date.parse(since);
            if (!Number.isNaN(parsed)) {
              thresholdSeconds = Math.floor(parsed / 1000);
            }
          }
          if (thresholdSeconds !== null) {
            querySegments.push('modtime >= ?');
            queryParams.push(thresholdSeconds);
          }
        }
      } else if (searchParams.searchTerm && searchParams.searchTerm.length) {
        // Basic omni-search mode
        querySegments.push('(title LIKE ? OR artist LIKE ? OR info LIKE ?)');
        const term = `%${searchParams.searchTerm}%`;
        queryParams.push(term, term, term);
      }

      let queryString = '';
      if (querySegments.length > 0) {
        queryString = ' WHERE ' + querySegments.join(' AND ');
      }

      const sql = 'SELECT * FROM mrvoice' + queryString + ' ORDER BY category,info,title,artist';
      const stmt = getDb().prepare(sql);
      const result = stmt.all(queryParams);
      stmt.finalize();

      return { success: true, data: result || [] };
    } catch (error) {
      debugLog?.error('Search songs error:', { module: 'ipc-handlers', function: 'search-songs', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.DATABASE.GET_CATEGORY_BY_CODE, async (event, code) => {
    try {
      if (!getDb()) {
        throw new Error('Database not initialized');
      }
      if (!code) {
        throw new Error('Category code is required');
      }
      const stmt = getDb().prepare('SELECT * FROM categories WHERE code = ?');
      const result = stmt.get(code);
      stmt.finalize();
      return { success: true, data: result ? [result] : [] };
    } catch (error) {
      debugLog?.error('Get category by code error:', { module: 'ipc-handlers', function: 'get-category-by-code', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.DATABASE.GET_SONGS_BY_IDS, async (event, ids) => {
    try {
      if (!getDb()) {
        throw new Error('Database not initialized');
      }
      if (!Array.isArray(ids) || ids.length === 0) {
        return { success: true, data: [] };
      }
      // Validate all IDs are numbers to prevent injection
      const validIds = ids.filter(id => Number.isFinite(Number(id)));
      if (validIds.length === 0) {
        return { success: true, data: [] };
      }
      const placeholders = validIds.map(() => '?').join(',');
      const stmt = getDb().prepare(`SELECT * FROM mrvoice WHERE id IN (${placeholders})`);
      const result = stmt.all(validIds);
      stmt.finalize();
      return { success: true, data: result || [] };
    } catch (error) {
      debugLog?.error('Get songs by IDs error:', { module: 'ipc-handlers', function: 'get-songs-by-ids', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.DATABASE.REASSIGN_SONG_CATEGORY, async (event, fromCode, toCode) => {
    try {
      if (!getDb()) {
        throw new Error('Database not initialized');
      }
      if (!fromCode || !toCode) {
        throw new Error('Both source and target category codes are required');
      }
      const stmt = getDb().prepare('UPDATE mrvoice SET category = ? WHERE category = ?');
      const result = stmt.run([toCode, fromCode]);
      stmt.finalize();
      return { success: true, data: { changes: result.changes || 0 } };
    } catch (error) {
      debugLog?.error('Reassign song category error:', { module: 'ipc-handlers', function: 'reassign-song-category', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.DATABASE.FIND_CATEGORY_CODES_LIKE, async (event, code, pattern) => {
    try {
      if (!getDb()) {
        throw new Error('Database not initialized');
      }
      if (!code) {
        throw new Error('Category code is required');
      }
      const stmt = getDb().prepare('SELECT code FROM categories WHERE code = ? OR code LIKE ?');
      const result = stmt.all([code, pattern || `${code}%`]);
      stmt.finalize();
      return { success: true, data: result || [] };
    } catch (error) {
      debugLog?.error('Find category codes error:', { module: 'ipc-handlers', function: 'find-category-codes-like', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.DATABASE.COUNT_SONGS, async () => {
    try {
      if (!getDb()) {
        throw new Error('Database not initialized');
      }
      const stmt = getDb().prepare('SELECT count(*) as count FROM mrvoice');
      const result = stmt.get();
      stmt.finalize();
      return { success: true, data: [result] };
    } catch (error) {
      debugLog?.error('Count songs error:', { module: 'ipc-handlers', function: 'count-songs', error: error.message });
      return { success: false, error: error.message };
    }
  });
}
