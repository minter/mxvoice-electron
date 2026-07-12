async function showAnalyticsBannerIfNeeded({
  electronAPI,
  testEnvironment,
  documentTarget = globalThis.document
}) {
  if (testEnvironment?.isE2E || !electronAPI?.store) return;

  const result = await electronAPI.store.get('analytics_banner_shown');
  if (result.success && result.value) return;

  const banner = documentTarget.getElementById('analytics-consent-banner');
  if (!banner) return;

  banner.classList.remove('d-none');
  banner.classList.add('show');

  documentTarget.getElementById('analytics-consent-ok')?.addEventListener('click', async () => {
    banner.classList.add('d-none');
    await electronAPI.store.set('analytics_banner_shown', true);
  });

  documentTarget.getElementById('analytics-consent-disable')?.addEventListener('click', async () => {
    banner.classList.add('d-none');
    await electronAPI.store.set('analytics_banner_shown', true);
    await electronAPI.analytics?.setOptOut(true);
  });
}

function setupUpdateDeferralTracking({ electronAPI, documentTarget = globalThis.document }) {
  documentTarget.getElementById('updateLaterBtn')?.addEventListener('click', () => {
    electronAPI?.analytics?.trackEvent?.('auto_update_action', { action: 'deferred' });
  });
}

export { setupUpdateDeferralTracking, showAnalyticsBannerIfNeeded };
export default showAnalyticsBannerIfNeeded;
