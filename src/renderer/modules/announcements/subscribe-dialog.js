/**
 * Email subscribe dialog. Validates email format, calls Mailgun via IPC,
 * handles success / already-subscribed / network error states.
 */
import { safeShowModal, safeHideModal } from '../ui/bootstrap-helpers.js';
import { buildResultAlert } from './dom-utils.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function createSubscribeDialog({ fetcher, trackEvent, appVersion, platform }) {
  const emailInput = document.getElementById('announcements-subscribe-email');
  const metadataCheck = document.getElementById('announcements-subscribe-metadata');
  const resultEl = document.getElementById('announcements-subscribe-result');
  const submitBtn = document.getElementById('announcements-subscribe-submit');
  const form = document.getElementById('announcements-subscribe-form');

  function reset() {
    if (emailInput) { emailInput.value = ''; emailInput.classList.remove('is-invalid'); }
    if (metadataCheck) metadataCheck.checked = false;
    if (resultEl) {
      resultEl.classList.add('d-none');
      resultEl.replaceChildren();
    }
    if (submitBtn) submitBtn.disabled = false;
  }

  function showResult(kind, message) {
    if (!resultEl) return;
    resultEl.classList.remove('d-none');
    resultEl.replaceChildren(buildResultAlert(kind, message));
  }

  if (submitBtn) {
    submitBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const email = (emailInput?.value || '').trim();
      if (!EMAIL_RE.test(email)) {
        emailInput?.classList.add('is-invalid');
        return;
      }
      emailInput?.classList.remove('is-invalid');
      submitBtn.disabled = true;

      const includedMetadata = !!metadataCheck?.checked;
      const vars = includedMetadata ? { version: appVersion, platform } : {};

      const result = await fetcher.subscribe(email, vars);
      if (!result) {
        showResult('error', 'Could not reach the subscription server. Try again?');
        submitBtn.disabled = false;
        return;
      }
      if (result.ok && result.code === 'subscribed') {
        showResult('success', 'Check your email to confirm your subscription.');
        trackEvent('announcement_subscribe_completed', { result: 'new', included_metadata: includedMetadata });
        setTimeout(() => safeHideModal('#announcementsSubscribeDialog'), 2000);
      } else if (result.ok && result.code === 'already_subscribed') {
        showResult('info', "You're already subscribed. Check your inbox if you haven't confirmed yet.");
        trackEvent('announcement_subscribe_completed', { result: 'already_subscribed', included_metadata: includedMetadata });
        setTimeout(() => safeHideModal('#announcementsSubscribeDialog'), 2000);
      } else if (result.code === 'network_error') {
        showResult('error', 'Could not reach the subscription server. Try again?');
        submitBtn.disabled = false;
      } else {
        showResult('error', 'Something went wrong. Email support@mxvoice.app if this keeps happening.');
        submitBtn.disabled = false;
      }
    });
  }

  if (form) {
    form.addEventListener('submit', (e) => { e.preventDefault(); });
  }

  function open() {
    reset();
    safeShowModal('#announcementsSubscribeDialog');
  }

  return { open };
}
