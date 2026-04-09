/**
 * Feature-severity top banner. One at a time, dismissible.
 */
export function createBanner({ seenTracking, onClick, trackEvent }) {
  const bannerEl = document.getElementById('announcements-banner');
  const textEl = document.getElementById('announcements-banner-text');
  const closeBtn = document.getElementById('announcements-banner-close');

  let currentItem = null;

  function show(item) {
    if (!bannerEl || !textEl) return;
    currentItem = item;
    textEl.textContent = item.title || '';
    bannerEl.classList.remove('d-none');
  }

  function hide() {
    if (!bannerEl) return;
    bannerEl.classList.add('d-none');
    currentItem = null;
  }

  if (bannerEl) {
    bannerEl.addEventListener('click', (e) => {
      if (e.target === closeBtn || (closeBtn && closeBtn.contains(e.target))) return;
      if (currentItem) {
        trackEvent('announcement_viewed', { id: currentItem.id, severity: currentItem.severity, source: 'banner_click' });
        onClick(currentItem);
      }
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (currentItem) {
        await seenTracking.markSeen(currentItem.id);
        trackEvent('announcement_dismissed', { id: currentItem.id, severity: currentItem.severity, source: 'banner_x' });
      }
      hide();
    });
  }

  return { show, hide };
}
