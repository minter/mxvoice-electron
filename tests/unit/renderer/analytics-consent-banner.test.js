import { describe, expect, it, vi } from 'vitest';
import {
  setupUpdateDeferralTracking,
  showAnalyticsBannerIfNeeded
} from '../../../src/renderer/modules/analytics/consent-banner.js';

function createElement() {
  const handlers = {};
  return {
    classList: { add: vi.fn(), remove: vi.fn() },
    addEventListener: (name, handler) => { handlers[name] = handler; },
    handlers
  };
}

describe('analytics consent banner', () => {
  it('shows an unseen banner and persists acceptance', async () => {
    const banner = createElement();
    const ok = createElement();
    const store = { get: vi.fn().mockResolvedValue({ success: true, value: false }), set: vi.fn() };
    const documentTarget = {
      getElementById: (id) => ({
        'analytics-consent-banner': banner,
        'analytics-consent-ok': ok
      })[id] || null
    };

    await showAnalyticsBannerIfNeeded({ electronAPI: { store }, documentTarget });
    expect(banner.classList.remove).toHaveBeenCalledWith('d-none');
    await ok.handlers.click();
    expect(store.set).toHaveBeenCalledWith('analytics_banner_shown', true);
  });

  it('does not read preferences in the E2E environment', async () => {
    const store = { get: vi.fn() };
    await showAnalyticsBannerIfNeeded({ electronAPI: { store }, testEnvironment: { isE2E: true } });
    expect(store.get).not.toHaveBeenCalled();
  });

  it('tracks update deferral independently of consent visibility', () => {
    const button = createElement();
    const trackEvent = vi.fn();
    setupUpdateDeferralTracking({
      electronAPI: { analytics: { trackEvent } },
      documentTarget: { getElementById: () => button }
    });
    button.handlers.click();
    expect(trackEvent).toHaveBeenCalledWith('auto_update_action', { action: 'deferred' });
  });
});
