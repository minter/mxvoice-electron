/**
 * Shared DOM helpers for the announcements UI.
 *
 * For markdown rendering, we use DOMPurify to sanitize the marked-parsed HTML,
 * then insert via Range.createContextualFragment + element.replaceChildren.
 * No code in this file assigns to the DOM element's HTML property — all DOM
 * construction goes through createElement / textContent / appendChild.
 *
 * `window.marked` and `window.DOMPurify` are loaded via <script> tags in
 * index.html (the project has no bundler).
 */

/**
 * Strip YAML frontmatter if present, then render markdown to a sanitized
 * DocumentFragment and replace the element's children with it.
 *
 * @param {HTMLElement} element - target element
 * @param {string} markdownText - raw markdown (may have frontmatter header)
 */
export function renderMarkdownInto(element, markdownText) {
  if (!element) return;
  const stripped = (markdownText || '').replace(/^---\n[\s\S]*?\n---\n/, '');
  const rawHtml = window.marked
    ? window.marked.parse(stripped)
    : escapeForFallback(stripped);
  const cleanHtml = window.DOMPurify
    ? window.DOMPurify.sanitize(rawHtml, {
        ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'a', 'code', 'pre', 'blockquote'],
        ALLOWED_ATTR: ['href', 'target', 'rel'],
      })
    : escapeForFallback(rawHtml);
  const range = document.createRange();
  const fragment = range.createContextualFragment(cleanHtml);
  element.replaceChildren(fragment);
}

function escapeForFallback(str) {
  // Fallback used only if marked or DOMPurify are somehow missing at runtime.
  // Never actually hit in production — script tags load them eagerly.
  return String(str || '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

/**
 * Build a list-item DOM node for an announcement. Uses only createElement and
 * textContent — no HTML strings.
 *
 * @param {Object} announcement - manifest entry
 * @param {boolean} isUnread
 * @returns {HTMLDivElement}
 */
export function buildAnnouncementListItem(announcement, isUnread) {
  const item = document.createElement('div');
  item.classList.add('announcement-item');
  if (isUnread) item.classList.add('unread');
  item.dataset.id = announcement.id;
  item.dataset.path = announcement.path;

  const title = document.createElement('div');
  title.classList.add('announcement-item-title');
  title.textContent = announcement.title || '';
  item.appendChild(title);

  const meta = document.createElement('div');
  meta.classList.add('announcement-item-meta');

  const dateSpan = document.createElement('span');
  dateSpan.classList.add('announcement-date');
  dateSpan.textContent = announcement.published
    ? new Date(announcement.published).toLocaleDateString()
    : '';
  meta.appendChild(dateSpan);

  const severitySpan = document.createElement('span');
  severitySpan.classList.add('announcement-severity', `severity-${announcement.severity || 'info'}`);
  severitySpan.textContent = announcement.severity || 'info';
  meta.appendChild(severitySpan);

  item.appendChild(meta);
  return item;
}

/**
 * Build a result alert element for the subscribe dialog.
 *
 * @param {'success'|'info'|'error'} kind
 * @param {string} message
 * @returns {HTMLDivElement}
 */
export function buildResultAlert(kind, message) {
  const alert = document.createElement('div');
  const cls = kind === 'success' ? 'alert-success' : (kind === 'info' ? 'alert-info' : 'alert-danger');
  alert.classList.add('alert', cls, 'py-2', 'mb-0');
  alert.textContent = message;
  return alert;
}
