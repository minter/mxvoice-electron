/**
 * Update Indicator
 *
 * Background update checks run mid-session, possibly mid-show, so instead of
 * opening the release-notes modal they reveal a small toolbar button. Clicking
 * it opens the usual modal (release notes are sanitized by its listener).
 */

/**
 * @param {Object} [options]
 * @param {Document} [options.documentTarget]
 * @param {Window|EventTarget} [options.windowTarget]
 */
export function setupUpdateIndicator({ documentTarget = globalThis.document, windowTarget = globalThis.window } = {}) {
  const button = documentTarget?.getElementById('update_available_button');
  if (!button || !windowTarget) return;

  let pendingUpdate = null;

  windowTarget.addEventListener('mxvoice:update-available-quiet', (event) => {
    pendingUpdate = { name: event.detail?.name ?? '', notes: event.detail?.notes ?? '' };
    const label = `Update ${pendingUpdate.name}`.trim();
    const labelElement = button.querySelector('.update-label');
    if (labelElement) labelElement.textContent = label;
    button.setAttribute('aria-label', `${label} available`);
    button.setAttribute('title', `${label} available`);
    button.classList.remove('d-none');
  });

  button.addEventListener('click', () => {
    if (!pendingUpdate) return;
    windowTarget.dispatchEvent(new CustomEvent('mxvoice:update-release-notes', { detail: pendingUpdate }));
    windowTarget.dispatchEvent(new CustomEvent('mxvoice:show-modal', { detail: { selector: '#newReleaseModal' } }));
  });

  // Once downloaded, the modal's install flow takes over
  windowTarget.addEventListener('mxvoice:update-ready', () => {
    button.classList.add('d-none');
  });
}
