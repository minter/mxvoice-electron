/**
 * Bell icon + badge. Click opens the announcements panel.
 */
export function createBell({ onClick }) {
  const bell = document.getElementById('announcements-bell');
  const badge = document.getElementById('announcements-badge');
  if (!bell || !badge) return { updateBadge: () => {} };

  bell.addEventListener('click', (e) => {
    e.preventDefault();
    onClick();
  });

  function updateBadge(unreadCount) {
    if (unreadCount > 0) {
      badge.textContent = String(unreadCount);
      badge.classList.remove('d-none');
      bell.classList.add('has-unread');
    } else {
      badge.textContent = '';
      badge.classList.add('d-none');
      bell.classList.remove('has-unread');
    }
  }

  return { updateBadge };
}
