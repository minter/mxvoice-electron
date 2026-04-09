/**
 * Announcements panel. Lists items (built via createElement), shows detail
 * view (sanitized markdown via renderMarkdownInto), handles subscribe CTA click.
 *
 * All DOM construction uses createElement + textContent + appendChild.
 * No innerHTML assignments.
 */
import { safeShowModal, safeHideModal } from '../ui/bootstrap-helpers.js';
import { renderMarkdownInto, buildAnnouncementListItem } from './dom-utils.js';

export function createPanel({ fetcher, seenTracking, onCtaClick, trackEvent, refreshBadge }) {
  const listEl = document.getElementById('announcements-list');
  const detailEl = document.getElementById('announcements-detail');
  const emptyEl = document.getElementById('announcements-empty');
  const ctaEl = document.getElementById('announcements-subscribe-cta');

  if (ctaEl) {
    ctaEl.addEventListener('click', (e) => {
      e.preventDefault();
      trackEvent('announcement_cta_clicked', { source: 'panel_footer' });
      onCtaClick();
    });
  }

  async function render(items, seenIds) {
    if (!listEl) return;
    listEl.replaceChildren();
    if (!items || items.length === 0) {
      if (emptyEl) emptyEl.classList.remove('d-none');
      return;
    }
    if (emptyEl) emptyEl.classList.add('d-none');

    items.forEach(item => {
      const isUnread = !seenIds.includes(item.id);
      const node = buildAnnouncementListItem(item, isUnread);
      node.addEventListener('click', async () => {
        await showDetail(item);
        await seenTracking.markSeen(item.id);
        node.classList.remove('unread');
        if (refreshBadge) await refreshBadge();
        trackEvent('announcement_viewed', { id: item.id, severity: item.severity, source: 'panel' });
      });
      listEl.appendChild(node);
    });
  }

  async function showDetail(item) {
    if (!detailEl) return;
    detailEl.replaceChildren();

    const backBtn = document.createElement('button');
    backBtn.classList.add('btn', 'btn-sm', 'btn-link');
    backBtn.textContent = '← Back';
    backBtn.addEventListener('click', () => {
      detailEl.classList.add('d-none');
      if (listEl) listEl.classList.remove('d-none');
    });
    detailEl.appendChild(backBtn);

    const titleEl = document.createElement('h5');
    titleEl.textContent = item.title || '';
    detailEl.appendChild(titleEl);

    const bodyContainer = document.createElement('div');
    bodyContainer.classList.add('announcement-body');
    const body = await fetcher.getBody(item.path);
    if (body) {
      renderMarkdownInto(bodyContainer, body);
    } else {
      bodyContainer.textContent = 'Could not load announcement body.';
    }
    detailEl.appendChild(bodyContainer);

    detailEl.classList.remove('d-none');
    if (listEl) listEl.classList.add('d-none');
  }

  function open() {
    if (detailEl) {
      detailEl.classList.add('d-none');
      detailEl.replaceChildren();
    }
    if (listEl) listEl.classList.remove('d-none');
    safeShowModal('#announcementsPanel');
  }
  function close() { safeHideModal('#announcementsPanel'); }

  return { render, open, close };
}
