/**
 * Announcements module orchestration. Wires together fetcher, seen tracking,
 * audience filter, bell, panel, banner, urgent modal, subscribe dialog.
 * Exposes `initAnnouncements()` for the renderer entry point.
 */
import { fetcher } from './fetcher.js';
import { createSeenTracking } from './seen-tracking.js';
import { passesAudienceFilter, isExpired } from './audience.js';
import { createBell } from './bell.js';
import { createPanel } from './panel.js';
import { createBanner } from './banner.js';
import { createUrgentModal } from './urgent-modal.js';
import { createSubscribeDialog } from './subscribe-dialog.js';

function trackEvent(name, properties) {
  window.secureElectronAPI?.analytics?.trackEvent?.(name, properties || {});
}

function unwrap(response) {
  if (response && typeof response === 'object') {
    if ('data' in response) return response.data;
    if ('value' in response) return response.value;
  }
  return response;
}

export async function initAnnouncements() {
  try {
    const seenTracking = createSeenTracking();

    // Resolve app version and platform
    const versionResponse = await window.secureElectronAPI?.app?.getVersion?.();
    const appVersion = (typeof versionResponse === 'string' ? versionResponse : unwrap(versionResponse)) || '0.0.0';
    const platform = window.secureElectronAPI?.platform || 'unknown';
    const ctx = { version: appVersion, platform };

    // Construct components
    const subscribeDialog = createSubscribeDialog({ fetcher, trackEvent, appVersion, platform });
    let panel; // forward declared so bell's onClick can reference it
    const bell = createBell({ onClick: () => panel?.open() });

    // Recompute the bell badge based on current seen state. Called by components
    // after marking items seen so the badge updates immediately instead of waiting
    // for the next 6h refresh cycle.
    async function refreshBadge() {
      const manifest = await fetcher.getManifest();
      if (!manifest || !Array.isArray(manifest.announcements)) {
        bell.updateBadge(0);
        return;
      }
      const now = new Date();
      const visible = manifest.announcements.filter(a =>
        passesAudienceFilter(a, ctx) && !isExpired(a, now)
      );
      const seenIds = await seenTracking.getSeen();
      const unread = visible.filter(a => !seenIds.includes(a.id));
      bell.updateBadge(unread.length);
    }

    const banner = createBanner({
      seenTracking,
      onClick: () => panel?.open(),
      trackEvent,
      refreshBadge,
    });
    const urgentModal = createUrgentModal({ fetcher, seenTracking, trackEvent, refreshBadge });
    panel = createPanel({
      fetcher,
      seenTracking,
      onCtaClick: () => subscribeDialog.open(),
      trackEvent,
      refreshBadge,
    });

    // Expose public API for other modules (help menu IPC, tour, release modal CTA)
    window.mxvoiceAnnouncements = {
      openPanel: () => panel.open(),
      openSubscribe: () => subscribeDialog.open(),
    };

    // Wire the "open subscribe" IPC event from the main process (Help menu item)
    window.secureElectronAPI?.events?.onOpenSubscribe?.(() => {
      trackEvent('announcement_cta_clicked', { source: 'help_menu' });
      subscribeDialog.open();
    });

    // Initial refresh
    await refresh(ctx, seenTracking, bell, panel, banner, urgentModal);

    // Periodic refresh every 6 hours
    setInterval(() => {
      refresh(ctx, seenTracking, bell, panel, banner, urgentModal).catch(() => {});
    }, 6 * 60 * 60 * 1000);
  } catch (err) {
    console.warn('Announcements init failed', err);
  }
}

async function refresh(ctx, seenTracking, bell, panel, banner, urgentModal) {
  const manifest = await fetcher.getManifest();
  if (!manifest || !Array.isArray(manifest.announcements)) {
    bell.updateBadge(0);
    await panel.render([], []);
    return;
  }
  const now = new Date();
  const visible = manifest.announcements.filter(a =>
    passesAudienceFilter(a, ctx) && !isExpired(a, now)
  );
  const seenIds = await seenTracking.getSeen();

  const unread = visible.filter(a => !seenIds.includes(a.id));
  const unreadFeature = unread.filter(a => a.severity === 'feature');
  const unreadUrgent = unread.filter(a => a.severity === 'urgent');

  bell.updateBadge(unread.length);
  await panel.render(visible, seenIds);

  // Feature banner: newest unread feature (manifest is sorted newest-first)
  if (unreadFeature.length > 0) {
    banner.show(unreadFeature[0]);
  } else {
    banner.hide();
  }

  // Urgent modal queue
  if (unreadUrgent.length > 0) {
    urgentModal.enqueue(unreadUrgent);
  }
}
