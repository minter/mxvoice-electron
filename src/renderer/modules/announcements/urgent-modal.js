/**
 * Urgent-severity blocking modal. Queue one at a time.
 */
import { safeShowModal, safeHideModal } from '../ui/bootstrap-helpers.js';
import { renderMarkdownInto } from './dom-utils.js';

export function createUrgentModal({ fetcher, seenTracking, trackEvent, refreshBadge }) {
  const titleEl = document.getElementById('announcements-urgent-title');
  const bodyEl = document.getElementById('announcements-urgent-body');
  const okBtn = document.getElementById('announcements-urgent-ok');
  let queue = [];

  async function showNext() {
    if (queue.length === 0) return;
    const item = queue[0];
    if (titleEl) titleEl.textContent = item.title || '';
    const body = await fetcher.getBody(item.path);
    if (bodyEl) {
      if (body) {
        renderMarkdownInto(bodyEl, body);
      } else {
        bodyEl.textContent = 'Could not load announcement body.';
      }
    }
    safeShowModal('#announcementsUrgentModal');
    trackEvent('announcement_viewed', { id: item.id, severity: item.severity, source: 'urgent_modal' });
  }

  if (okBtn) {
    okBtn.addEventListener('click', async () => {
      const item = queue.shift();
      if (item) {
        await seenTracking.markSeen(item.id);
        if (refreshBadge) await refreshBadge();
        trackEvent('announcement_dismissed', { id: item.id, severity: item.severity, source: 'urgent_got_it' });
      }
      safeHideModal('#announcementsUrgentModal');
      if (queue.length > 0) setTimeout(() => showNext(), 300);
    });
  }

  function enqueue(items) {
    queue = [...items];
    if (queue.length > 0) showNext();
  }

  return { enqueue };
}
