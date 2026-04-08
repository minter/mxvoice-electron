import tourData from './tours.js';
import { TourManager } from './tour-manager.js';

const tourManager = new TourManager(tourData);

// ─── Register helper functions ────────────────────────────────────────

tourManager.registerHelper('openEditForFirstSong', async () => {
  // Search with no filters to get all songs, take the first one
  const result = await window.secureElectronAPI.database.searchSongs({});
  const rows = result?.data || result;
  if (!Array.isArray(rows) || rows.length === 0) return;

  const song = rows[0];
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val ?? '';
  };
  setVal('song-form-songid', song.songid);
  setVal('song-form-title', song.title);
  setVal('song-form-artist', song.artist);
  setVal('song-form-info', song.info);
  setVal('song-form-duration', song.time);

  const volEl = document.getElementById('song-form-volume');
  if (volEl) volEl.value = song.volume ?? 100;
  const volDisplay = document.getElementById('song-form-volume-display');
  if (volDisplay) volDisplay.textContent = song.volume ?? 100;

  const startEl = document.getElementById('song-form-start-time');
  if (startEl) startEl.value = song.start_time || '';
  const endEl = document.getElementById('song-form-end-time');
  if (endEl) {
    endEl.value = song.end_time || '';
    endEl.placeholder = song.time || 'End of track';
  }

  const { safeShowModal } = await import('../ui/bootstrap-helpers.js');
  await safeShowModal('#songFormModal', { module: 'whats-new', function: 'openEditForFirstSong' });
});

tourManager.registerHelper('showContextMenuForFirstSong', async () => {
  const firstRow = document.querySelector('#search_results tbody tr.song');
  if (!firstRow) return;

  firstRow.click();

  const menu = document.getElementById('mxv-context-menu');
  if (menu) {
    const rect = firstRow.getBoundingClientRect();
    menu.style.left = `${rect.left + 50}px`;
    menu.style.top = `${rect.top + rect.height}px`;
    menu.style.display = 'block';
  }
});

tourManager.registerHelper('showFileDropOverlay', async () => {
  const overlay = document.getElementById('file-drop-overlay');
  if (overlay) overlay.classList.add('active');
});

tourManager.registerHelper('hideFileDropOverlay', async () => {
  const overlay = document.getElementById('file-drop-overlay');
  if (overlay) overlay.classList.remove('active');
});

/**
 * Opens the Preferences modal and scrolls to the crossfade control.
 */
tourManager.registerHelper('openPreferencesAndScrollToCrossfade', async () => {
  const { safeShowModal } = await import('../ui/bootstrap-helpers.js');
  await safeShowModal('#preferencesModal', { module: 'whats-new', function: 'openPreferencesAndScrollToCrossfade' });
  // Wait for modal animation to complete
  await new Promise((resolve) => setTimeout(resolve, 400));
  const crossfadeEl = document.getElementById('preferences-crossfade-seconds');
  if (crossfadeEl) {
    crossfadeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
});

// ─── Public API ───────────────────────────────────────────────────────

export async function initWhatsNew() {
  try {
    const shouldRun = await tourManager.shouldAutoTrigger();
    if (shouldRun) {
      const version = await tourManager.getAppVersion();
      window.debugLog?.info(`Auto-triggering What's New tour for ${version}`, {
        module: 'whats-new',
        function: 'initWhatsNew',
      });
      await tourManager.launchTour(version, { markSeen: true });
    }
  } catch (error) {
    window.debugLog?.error('Failed to initialize What\'s New tour', {
      module: 'whats-new',
      function: 'initWhatsNew',
      error: error?.message,
    });
  }
}

export async function showWhatsNew() {
  try {
    const version = await tourManager.getAppVersion();
    const tour = tourManager.getTourForVersion(version);

    if (tour) {
      window.debugLog?.info(`Showing What's New tour for ${version} (on demand)`, {
        module: 'whats-new',
        function: 'showWhatsNew',
      });
      await tourManager.launchTour(version, { markSeen: false });
    } else {
      window.debugLog?.info(`No tour defined for version ${version}`, {
        module: 'whats-new',
        function: 'showWhatsNew',
      });
    }
  } catch (error) {
    window.debugLog?.error('Failed to show What\'s New tour', {
      module: 'whats-new',
      function: 'showWhatsNew',
      error: error?.message,
    });
  }
}

export { tourManager };

export default { initWhatsNew, showWhatsNew, tourManager };
