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
    // Persist both parts of the affirmative decision before enabling the sink.
    const optInResult = await electronAPI.analytics?.setOptOut(false);
    if (!optInResult || optInResult.success === false) return;
    const result = await electronAPI.store.set('analytics_banner_shown', true);
    if (result?.success !== false) banner.classList.add('d-none');
  });

  documentTarget.getElementById('analytics-consent-disable')?.addEventListener('click', async () => {
    // Persist opt-out first so no event can observe a completed decision as consent.
    const optOutResult = await electronAPI.analytics?.setOptOut(true);
    if (!optOutResult || optOutResult.success === false) return;
    const bannerResult = await electronAPI.store.set('analytics_banner_shown', true);
    if (bannerResult?.success !== false) banner.classList.add('d-none');
  });
}

function setupUpdateDeferralTracking({ electronAPI, documentTarget = globalThis.document }) {
  documentTarget.getElementById('updateLaterBtn')?.addEventListener('click', () => {
    electronAPI?.analytics?.trackEvent?.('auto_update_action', { action: 'deferred' });
  });
}

export { setupUpdateDeferralTracking, showAnalyticsBannerIfNeeded };
export default showAnalyticsBannerIfNeeded;
